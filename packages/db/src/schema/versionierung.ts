import { date, integer, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { ereignisse } from './ereignisse'

import type { Herkunft } from '@vermieteros/schema'
export type { Herkunft, HerkunftEintrag, HerkunftQuelle } from '@vermieteros/schema'

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
