import { bigint, date, integer, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { objekte } from './objekte'
import { identitaetsSpalten, versionsSpalten } from './versionierung'

/** Darlehen am Objekt. Restschuldverlauf wird gerechnet, nicht gespeichert; Snapshot optional. */
export const darlehen = pgTable('darlehen', {
  ...identitaetsSpalten,
  objektId: uuid('objekt_id')
    .notNull()
    .references(() => objekte.id),
})

export const darlehenVersionen = pgTable(
  'darlehen_versionen',
  {
    ...versionsSpalten,
    darlehenId: uuid('darlehen_id')
      .notNull()
      .references(() => darlehen.id),
    bank: text('bank').notNull(),
    kennzeichen: text('kennzeichen'),
    nominalCent: bigint('nominal_cent', { mode: 'number' }).notNull(),
    auszahlungAm: date('auszahlung_am', { mode: 'string' }),
    /** Sollzins in Basispunkten (350 = 3,50 %) */
    zinsBp: integer('zins_bp').notNull(),
    /** anfängliche Tilgung in Basispunkten */
    tilgungBp: integer('tilgung_bp'),
    rateCent: bigint('rate_cent', { mode: 'number' }).notNull(),
    zinsbindungBis: date('zinsbindung_bis', { mode: 'string' }),
    sondertilgungCentPa: bigint('sondertilgung_cent_pa', { mode: 'number' }),
    restschuldCent: bigint('restschuld_cent', { mode: 'number' }),
    restschuldStand: date('restschuld_stand', { mode: 'string' }),
    bemerkung: text('bemerkung'),
  },
  (t) => [uniqueIndex('darlehen_versionen_darlehen_nr_uq').on(t.darlehenId, t.versionNr)],
)
