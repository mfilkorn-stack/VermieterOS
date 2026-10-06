import type { ReferenzArt } from '@vermieteros/schema'
import { date, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/**
 * Referenzdaten (PLAN.md 3.5): Werte von außen mit Gültigkeit, Quelle und Prüffrist.
 * `mandant_id` NULL = global (per Migration gepflegt, für alle lesbar); sonst nur für den Mandanten.
 * Append-only: eine Korrektur ist ein neuer Eintrag mit späterem `erfasst_am`.
 */
export const referenzdaten = pgTable(
  'referenzdaten',
  {
    id: uuid('id').primaryKey(),
    mandantId: uuid('mandant_id'),
    art: text('art').$type<ReferenzArt>().notNull(),
    /** z. B. Bundesland „BY“, später Gemeindeschlüssel für Mietspiegel */
    schluessel: text('schluessel').notNull(),
    wert: jsonb('wert').$type<Record<string, unknown>>().notNull(),
    gueltigVon: date('gueltig_von', { mode: 'string' }).notNull(),
    gueltigBis: date('gueltig_bis', { mode: 'string' }),
    quelle: text('quelle').notNull(),
    quelleUrl: text('quelle_url'),
    hinweis: text('hinweis'),
    geprueftAm: date('geprueft_am', { mode: 'string' }).notNull(),
    /** Bis wann der Wert erneut geprüft sein muss; danach warnt die Software. */
    pruefenBis: date('pruefen_bis', { mode: 'string' }).notNull(),
    erfasstAm: timestamp('erfasst_am', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    erfasstVon: text('erfasst_von').notNull(),
  },
  (t) => [index('referenzdaten_art_schluessel_idx').on(t.art, t.schluessel, t.gueltigVon)],
)
