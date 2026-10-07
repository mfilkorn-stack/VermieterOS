import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { mietverhaeltnisse } from './mietverhaeltnisse'
import { personen } from './personen'

/**
 * Mieterportal (WP 1.10, ADR 0010). Eigene Identität, getrennt von Better Auth: Mieter sind
 * keine Mitglieder eines Mandanten und kommen nie an die Vermieteroberfläche.
 *
 * Ein Zugang gehört zu genau einem Mietverhältnis und einer Person. Der Vermieter legt ihn an
 * und kann ihn widerrufen. Anmeldung per Einmal-Link; Tokens und Sitzungen liegen nur als
 * SHA-256 vor und sind für die App-Rolle unsichtbar, Zugriff ausschließlich über die
 * SECURITY-DEFINER-Funktionen der Migration 0024.
 */
export const portalZugaenge = pgTable(
  'portal_zugaenge',
  {
    id: uuid('id').primaryKey(),
    mandantId: uuid('mandant_id').notNull(),
    mietverhaeltnisId: uuid('mietverhaeltnis_id')
      .notNull()
      .references(() => mietverhaeltnisse.id),
    personId: uuid('person_id')
      .notNull()
      .references(() => personen.id),
    email: text('email').notNull(),
    erstelltAm: timestamp('erstellt_am', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    erstelltVon: text('erstellt_von').notNull(),
    widerrufenAm: timestamp('widerrufen_am', { withTimezone: true, mode: 'string' }),
    widerrufenVon: text('widerrufen_von'),
  },
  (t) => [
    uniqueIndex('portal_zugaenge_aktiv_uq')
      .on(t.mietverhaeltnisId, t.email)
      .where(sql`widerrufen_am IS NULL`),
    index('portal_zugaenge_email_idx').on(t.email),
  ],
)

export const portalTokens = pgTable('portal_tokens', {
  hash: text('hash').primaryKey(),
  zugangId: uuid('zugang_id')
    .notNull()
    .references(() => portalZugaenge.id),
  ablaufAm: timestamp('ablauf_am', { withTimezone: true, mode: 'string' }).notNull(),
  erstelltAm: timestamp('erstellt_am', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
  verwendetAm: timestamp('verwendet_am', { withTimezone: true, mode: 'string' }),
})

export const portalSitzungen = pgTable('portal_sitzungen', {
  hash: text('hash').primaryKey(),
  zugangId: uuid('zugang_id')
    .notNull()
    .references(() => portalZugaenge.id),
  ablaufAm: timestamp('ablauf_am', { withTimezone: true, mode: 'string' }).notNull(),
  erstelltAm: timestamp('erstellt_am', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
  beendetAm: timestamp('beendet_am', { withTimezone: true, mode: 'string' }),
})

/** Nachrichten aus dem Portal an den Vermieter, append-only, erscheinen im Verlauf. */
export const portalNachrichten = pgTable(
  'portal_nachrichten',
  {
    id: uuid('id').primaryKey(),
    mandantId: uuid('mandant_id').notNull(),
    mietverhaeltnisId: uuid('mietverhaeltnis_id')
      .notNull()
      .references(() => mietverhaeltnisse.id),
    zugangId: uuid('zugang_id')
      .notNull()
      .references(() => portalZugaenge.id),
    betreff: text('betreff').notNull(),
    text: text('text').notNull(),
    erstelltAm: timestamp('erstellt_am', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('portal_nachrichten_mv_idx').on(t.mietverhaeltnisId, t.erstelltAm)],
)
