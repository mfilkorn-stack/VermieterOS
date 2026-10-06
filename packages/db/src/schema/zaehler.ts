import type { ZaehlerArt, ZaehlerstandQuelle } from '@vermieteros/schema'
import {
  bigint,
  date,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { einheiten } from './einheiten'
import { ereignisse } from './ereignisse'
import { objekte } from './objekte'
import { identitaetsSpalten, versionsSpalten } from './versionierung'

/** Zähler am Objekt (Hauptzähler) oder an einer Einheit. */
export const zaehler = pgTable('zaehler', {
  ...identitaetsSpalten,
  objektId: uuid('objekt_id')
    .notNull()
    .references(() => objekte.id),
  einheitId: uuid('einheit_id').references(() => einheiten.id),
})

export const zaehlerVersionen = pgTable(
  'zaehler_versionen',
  {
    ...versionsSpalten,
    zaehlerId: uuid('zaehler_id')
      .notNull()
      .references(() => zaehler.id),
    art: text('art').$type<ZaehlerArt>().notNull(),
    nummer: text('nummer').notNull(),
    masseinheit: text('masseinheit').notNull(),
    eichungBis: date('eichung_bis', { mode: 'string' }),
    eingebautAm: date('eingebaut_am', { mode: 'string' }),
    ausgebautAm: date('ausgebaut_am', { mode: 'string' }),
    bemerkung: text('bemerkung'),
  },
  (t) => [uniqueIndex('zaehler_versionen_zaehler_nr_uq').on(t.zaehlerId, t.versionNr)],
)

/**
 * Zählerstände sind Ereignisse, keine Versionen: append-only, Korrektur per Storno
 * (stornos.version_id = zaehlerstaende.id, entitaet = 'zaehlerstand').
 */
export const zaehlerstaende = pgTable(
  'zaehlerstaende',
  {
    id: uuid('id').primaryKey(),
    mandantId: uuid('mandant_id').notNull(),
    zaehlerId: uuid('zaehler_id')
      .notNull()
      .references(() => zaehler.id),
    /** Stand in Tausendsteln der Maßeinheit */
    standX1000: bigint('stand_x1000', { mode: 'number' }).notNull(),
    abgelesenAm: date('abgelesen_am', { mode: 'string' }).notNull(),
    quelle: text('quelle').$type<ZaehlerstandQuelle>().notNull(),
    ereignisId: uuid('ereignis_id')
      .notNull()
      .references(() => ereignisse.id),
    erfasstAm: timestamp('erfasst_am', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    erfasstVon: text('erfasst_von').notNull(),
    bemerkung: text('bemerkung'),
  },
  (t) => [index('zaehlerstaende_zaehler_datum_idx').on(t.zaehlerId, t.abgelesenAm)],
)
