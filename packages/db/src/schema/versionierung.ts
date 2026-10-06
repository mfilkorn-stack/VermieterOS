import { date, integer, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { ereignisse } from './ereignisse'

/** Erlaubte Quellen eines Feldwerts (docs/PLAN.md 3.3). */
export const HERKUNFT_QUELLEN = [
  'manuell',
  'dokument',
  'bank_csv',
  'kalkulation',
  'ki_vorschlag',
] as const
export type HerkunftQuelle = (typeof HERKUNFT_QUELLEN)[number]

export type HerkunftEintrag = {
  quelle: HerkunftQuelle
  /** Quelle `dokument`: Dokument und Seite */
  dokumentId?: string
  seite?: number
  /** Quelle `bank_csv`: Import und Zeile */
  importId?: string
  zeile?: number
  /** Quelle `kalkulation`: Ankaufsprüfungs-Fall */
  fallId?: string
  /** Quelle `ki_vorschlag`: Vorschlag, aus dem der Wert bestätigt wurde */
  vorschlagId?: string
  hinweis?: string
}

/** Herkunft pro geändertem Feld, Schlüssel = Spaltenname in camelCase. */
export type Herkunft = Record<string, HerkunftEintrag>

/**
 * Gemeinsame Spalten jeder `*_versionen`-Tabelle. Zwei Zeitachsen:
 * `gueltigAb` fachlich (Datum), `erfasstAm` technisch (Zeitpunkt, von der DB gesetzt).
 */
export const versionsSpalten = {
  id: uuid('id').primaryKey(),
  mandantId: uuid('mandant_id').notNull(),
  versionNr: integer('version_nr').notNull(),
  gueltigAb: date('gueltig_ab', { mode: 'string' }).notNull(),
  erfasstAm: timestamp('erfasst_am', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  erfasstVon: text('erfasst_von').notNull(),
  ereignisId: uuid('ereignis_id')
    .notNull()
    .references(() => ereignisse.id),
  /** Pflicht ab version_nr > 1 (Check-Constraint in Migration 0001). */
  begruendung: text('begruendung'),
  herkunft: jsonb('herkunft').$type<Herkunft>().notNull().default({}),
}

/** Gemeinsame Spalten jeder Identitätstabelle. */
export const identitaetsSpalten = {
  id: uuid('id').primaryKey(),
  mandantId: uuid('mandant_id').notNull(),
  erstelltAm: timestamp('erstellt_am', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
}
