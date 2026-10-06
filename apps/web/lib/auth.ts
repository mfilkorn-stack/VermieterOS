import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { magicLink, organization, twoFactor } from 'better-auth/plugins'
import { schema } from '@vermieteros/db'
import { db } from './db'

/**
 * Better Auth (ADR 0004). Eine Organization ist ein Mandant (Eigentümerschaft, ADR 0002).
 * Rollen pro Mitgliedschaft: eigentuemer (owner), miteigentuemer, mitverwalter, steuerberater.
 * Mieter und Handwerker kommen per Magic-Link und sind keine Mitglieder.
 */
export const auth = betterAuth({
  appName: 'Vermieter.OS',
  baseURL: process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3000',
  secret: process.env['BETTER_AUTH_SECRET'],
  database: drizzleAdapter(db, { provider: 'pg', schema: schema.auth, schemaName: 'auth' }),
  advanced: {
    database: { generateId: 'uuid' },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
  },
  session: {
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
  },
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      creatorRole: 'owner',
      organizationLimit: 20,
    }),
    twoFactor({
      issuer: 'Vermieter.OS',
    }),
    magicLink({
      expiresIn: 15 * 60,
      disableSignUp: true,
      async sendMagicLink({ email, url }) {
        // Phase 1: Versand über den Mail-Worker. Bis dahin nur Protokoll in der Entwicklung.
        if (process.env.NODE_ENV !== 'production') console.log(`[magic-link] ${email}: ${url}`)
      },
    }),
    nextCookies(),
  ],
})

export type Auth = typeof auth
