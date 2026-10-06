import { legeMandantAn, schema, withMandant } from '@vermieteros/db'
import { EigentuemerschaftArt } from '@vermieteros/schema'
import { betterAuth } from 'better-auth'
import { and, asc, desc, eq, isNotNull } from 'drizzle-orm'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { magicLink, organization, twoFactor } from 'better-auth/plugins'
import { v7 as uuidv7 } from 'uuid'
import { db } from './db'
import { ac, roles } from './rechte'

const BASIS_URL = process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3000'

/**
 * Better Auth (ADR 0004). Eine Organization ist ein Mandant (ADR 0002) und trägt dieselbe ID.
 * Mieter und Handwerker kommen per Magic-Link und sind keine Mitglieder.
 */
export const auth = betterAuth({
  appName: 'Vermieter.OS',
  baseURL: BASIS_URL,
  secret: process.env['BETTER_AUTH_SECRET'],
  database: drizzleAdapter(db, { provider: 'pg', schema: schema.auth, schemaName: 'auth' }),
  advanced: {
    // UUID v7 für alle Auth-Datensätze; die Organization-ID wird zugleich die mandant_id.
    database: { generateId: () => uuidv7() },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
  },
  // Einladungen gelten nur für bestätigte Adressen (Better-Auth-Standard, bleibt an).
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 24 * 60 * 60,
    async sendVerificationEmail({ user, url }) {
      mailNochNichtEingerichtet('bestaetigung', user.email, url)
    },
  },
  databaseHooks: {
    session: {
      create: {
        // Neue Sitzung startet im zuletzt genutzten Mandanten, sonst im ältesten.
        async before(sitzung) {
          if (sitzung['activeOrganizationId']) return
          const mandantId = await letzterMandant(String(sitzung.userId))
          if (mandantId) return { data: { ...sitzung, activeOrganizationId: mandantId } }
        },
      },
    },
  },
  rateLimit: {
    enabled: process.env['AUTH_RATE_LIMIT'] !== 'aus',
    window: 60,
    max: 30,
  },
  plugins: [
    organization({
      ac,
      roles,
      creatorRole: 'eigentuemer',
      allowUserToCreateOrganization: true,
      organizationLimit: 20,
      // Mandanten werden nie gelöscht (Aufbewahrungspflichten, Ledger).
      disableOrganizationDeletion: true,
      invitationExpiresIn: 7 * 24 * 60 * 60,
      async sendInvitationEmail({ id, email, organization: org }) {
        // Bis der Mailversand steht, zeigt die Mitgliederseite den Link.
        mailNochNichtEingerichtet(`einladung ${org.name}`, email, `${BASIS_URL}/einladungen/${id}`)
      },
      organizationHooks: {
        async afterCreateOrganization({ organization: org, user }) {
          const art = EigentuemerschaftArt.catch('allein').parse(liesMetadata(org.metadata)['art'])
          await withMandant(db, org.id, (tx) =>
            legeMandantAn(tx, {
              id: org.id,
              name: org.name,
              art,
              organisationId: org.id,
              akteur: { art: 'nutzer', id: user.id },
            }),
          )
        },
      },
    }),
    twoFactor({ issuer: 'Vermieter.OS' }),
    magicLink({
      expiresIn: 15 * 60,
      disableSignUp: true,
      async sendMagicLink({ email, url }) {
        mailNochNichtEingerichtet('magic-link', email, url)
      },
    }),
    nextCookies(),
  ],
})

export type Auth = typeof auth

/**
 * Platzhalter bis zum Mail-Worker (Phase 1): Links stehen in der Entwicklung im Server-Log.
 * In Produktion nie Links ins Log, nur ein Hinweis.
 */
function mailNochNichtEingerichtet(art: string, an: string, link: string): void {
  if (process.env.NODE_ENV !== 'production') console.log(`[mail:${art}] ${an}: ${link}`)
  else console.warn(`[mail:${art}] Mailversand nicht eingerichtet, keine Mail an ${an}`)
}

/** Mandant der jüngsten Sitzung mit aktiver Mitgliedschaft, sonst die älteste Mitgliedschaft. */
async function letzterMandant(nutzerId: string): Promise<string | null> {
  const { member, session } = schema.auth
  const [zuletzt] = await db
    .select({ id: session.activeOrganizationId })
    .from(session)
    .innerJoin(
      member,
      and(eq(member.organizationId, session.activeOrganizationId), eq(member.userId, nutzerId)),
    )
    .where(and(eq(session.userId, nutzerId), isNotNull(session.activeOrganizationId)))
    .orderBy(desc(session.updatedAt))
    .limit(1)
  if (zuletzt?.id) return zuletzt.id
  const [erste] = await db
    .select({ id: member.organizationId })
    .from(member)
    .where(eq(member.userId, nutzerId))
    .orderBy(asc(member.createdAt))
    .limit(1)
  return erste?.id ?? null
}

function liesMetadata(m: unknown): Record<string, unknown> {
  if (!m) return {}
  if (typeof m === 'string') {
    try {
      return JSON.parse(m) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return m as Record<string, unknown>
}
