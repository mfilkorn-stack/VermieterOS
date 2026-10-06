import type { DokumentStatus, DokumentTyp } from '@vermieteros/schema'
import { bigint, date, integer, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { mietverhaeltnisse } from './mietverhaeltnisse'
import { objekte } from './objekte'
import { identitaetsSpalten, versionsSpalten } from './versionierung'

/**
 * Die Datei ist Teil der Identität: unveränderlich, mit Prüfsumme, im Object Storage.
 * Versioniert wird der fachliche Status (gültig, ersetzt, abgelaufen) und die Einordnung.
 * Check-Constraint (Migration): objekt_id oder mietverhaeltnis_id muss gesetzt sein.
 */
export const dokumente = pgTable('dokumente', {
  ...identitaetsSpalten,
  objektId: uuid('objekt_id').references(() => objekte.id),
  mietverhaeltnisId: uuid('mietverhaeltnis_id').references(() => mietverhaeltnisse.id),
  dateiHash: text('datei_hash').notNull(),
  speicherSchluessel: text('speicher_schluessel').notNull(),
  dateiname: text('dateiname').notNull(),
  mime: text('mime').notNull(),
  groesseBytes: bigint('groesse_bytes', { mode: 'number' }).notNull(),
})

export const dokumentVersionen = pgTable(
  'dokument_versionen',
  {
    ...versionsSpalten,
    dokumentId: uuid('dokument_id')
      .notNull()
      .references(() => dokumente.id),
    typ: text('typ').$type<DokumentTyp>().notNull(),
    status: text('status').$type<DokumentStatus>().notNull().default('gueltig'),
    titel: text('titel').notNull(),
    dokumentdatum: date('dokumentdatum', { mode: 'string' }),
    gueltigBis: date('gueltig_bis', { mode: 'string' }),
    ersetztDurch: uuid('ersetzt_durch'),
    seiten: integer('seiten'),
    notizen: text('notizen'),
  },
  (t) => [uniqueIndex('dokument_versionen_dokument_nr_uq').on(t.dokumentId, t.versionNr)],
)
