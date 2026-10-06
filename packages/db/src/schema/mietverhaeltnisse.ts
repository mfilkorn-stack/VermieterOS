import type { KautionArt, KonditionGrund, Mietart, Staffelstufe } from '@vermieteros/schema'
import { bigint, date, integer, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { einheiten } from './einheiten'
import { identitaetsSpalten, versionsSpalten } from './versionierung'

/** Mietverhältnis: Vertrag über eine Einheit. Die Einheit ist Teil der Identität. */
export const mietverhaeltnisse = pgTable('mietverhaeltnisse', {
  ...identitaetsSpalten,
  einheitId: uuid('einheit_id')
    .notNull()
    .references(() => einheiten.id),
})

export const mietverhaeltnisVersionen = pgTable(
  'mietverhaeltnis_versionen',
  {
    ...versionsSpalten,
    mietverhaeltnisId: uuid('mietverhaeltnis_id')
      .notNull()
      .references(() => mietverhaeltnisse.id),
    beginn: date('beginn', { mode: 'string' }).notNull(),
    ende: date('ende', { mode: 'string' }),
    kuendigungsfristMonate: integer('kuendigungsfrist_monate').notNull().default(3),
    kautionCent: bigint('kaution_cent', { mode: 'number' }),
    kautionArt: text('kaution_art').$type<KautionArt>().notNull().default('keine'),
    /** Personen (personen.id) als Vertragspartner */
    mieterIds: uuid('mieter_ids').array().notNull(),
    notizen: text('notizen'),
  },
  (t) => [uniqueIndex('mietverhaeltnis_versionen_mv_nr_uq').on(t.mietverhaeltnisId, t.versionNr)],
)

/**
 * Mietkondition: Sollmiete, Vorauszahlungen, Mietart, Belegung. Eigene Entität, weil
 * Mieterhöhungen und Vorauszahlungsanpassungen hier neue Versionen mit `gueltig_ab` erzeugen.
 */
export const mietkonditionen = pgTable('mietkonditionen', {
  ...identitaetsSpalten,
  mietverhaeltnisId: uuid('mietverhaeltnis_id')
    .notNull()
    .references(() => mietverhaeltnisse.id),
})

export const mietkonditionVersionen = pgTable(
  'mietkondition_versionen',
  {
    ...versionsSpalten,
    mietkonditionId: uuid('mietkondition_id')
      .notNull()
      .references(() => mietkonditionen.id),
    kaltmieteCent: bigint('kaltmiete_cent', { mode: 'number' }).notNull(),
    vorauszahlungBkCent: bigint('vorauszahlung_bk_cent', { mode: 'number' }).notNull().default(0),
    vorauszahlungHkCent: bigint('vorauszahlung_hk_cent', { mode: 'number' }).notNull().default(0),
    mietart: text('mietart').$type<Mietart>().notNull().default('vergleich'),
    staffel: jsonb('staffel').$type<Staffelstufe[]>(),
    personenzahl: integer('personenzahl').notNull().default(1),
    grund: text('grund').$type<KonditionGrund>().notNull().default('vertrag'),
  },
  (t) => [uniqueIndex('mietkondition_versionen_mk_nr_uq').on(t.mietkonditionId, t.versionNr)],
)
