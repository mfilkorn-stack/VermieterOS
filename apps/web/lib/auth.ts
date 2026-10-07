import { legeMandantAn, schema, withMandant } from '@vermieteros/db'
import { EigentuemerschaftArt } from '@vermieteros/schema'
import { betterAuth } from 'better-auth'
import { APIError } from 'better-auth/api'
import { and, asc, desc, eq, gt, isNotNull, sql } from 'drizzle-orm'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { magicLink, organization, twoFactor } from 'better-auth/plugins'
import { v7 as uuidv7 } from 'uuid'
import { db } from './db'
import { sendeMail } from './mail'
import { ac, roles } from './rechte'
import { erlaubteAdressen, registrierungErlaubt, registrierungsModus } from './registrierung'

const BASIS_URL = process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3000'
const REGISTRIERUNG = registrierungsModus(process.env)
const ERLAUBT = erlaubteAdressen(process.env['REGISTRIERUNG_ERLAUBT'])

async function offeneEinladung(email: string): Promise<boolean> {
  const [e] = await db
    .select({ id: schema.auth.invitation.id })
    .from(schema.auth.invitation)
    .where(
      and(
        sql`lower(${schema.auth.invitation.email}) = ${email.trim().toLowerCase()}`,
        eq(schema.auth.invitation.status, 'pending'),
        gt(schema.auth.invitation.expiresAt, new Date()),
      ),
    )
    .limit(1)
  return e != null
}

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
      await sendeMail({
        art: 'bestaetigung',
        an: user.email,
        betreff: 'Vermieter.OS: E-Mail-Adresse bestätigen',
        text: `Bitte bestätige deine E-Mail-Adresse:\n\n${url}\n\nDer Link gilt 24 Stunden.`,
      })
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Kein offenes Anlegen von Konten in Produktion (lib/registrierung.ts).
        async before(nutzer) {
          const erlaubt = registrierungErlaubt(nutzer.email, {
            modus: REGISTRIERUNG,
            erlaubt: ERLAUBT,
            eingeladen: REGISTRIERUNG === 'offen' ? false : await offeneEinladung(nutzer.email),
          })
          if (!erlaubt)
            throw new APIError('FORBIDDEN', {
              message: 'Registrierung nur mit Einladung. Bitte beim Eigentümer melden.',
            })
        },
      },
    },
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
        // Ohne Mailversand zeigt die Mitgliederseite den Link zum Weitergeben.
        await sendeMail({
          art: 'einladung',
          an: email,
          betreff: `Einladung zu ${org.name} in Vermieter.OS`,
          text: `Du bist zu „${org.name}“ eingeladen:\n\n${BASIS_URL}/einladungen/${id}\n\nDie Einladung gilt 7 Tage.`,
        })
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
        await sendeMail({
          art: 'magic-link',
          an: email,
          betreff: 'Vermieter.OS: Anmeldelink',
          text: `Hier ist dein Anmeldelink:\n\n${url}\n\nEr gilt 15 Minuten.`,
        })
      },
    }),
    nextCookies(),
  ],
})

export type Auth = typeof auth

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
