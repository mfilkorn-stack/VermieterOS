import type { BkFestschreibung, BkMessdienst, BkPosition, BkStatus } from '@vermieteros/schema'
import { date, index, jsonb, pgTable, smallint, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { einheiten } from './einheiten'
import { identitaetsSpalten, versionsSpalten } from './versionierung'

/** Betriebskostenabrechnung einer Einheit für ein Jahr (WP 2.4); eine je Einheit und Jahr. */
export const bkAbrechnungen = pgTable(
  'bk_abrechnungen',
  {
    ...identitaetsSpalten,
    einheitId: uuid('einheit_id')
      .notNull()
      .references(() => einheiten.id),
    jahr: smallint('jahr').notNull(),
  },
  (t) => [
    uniqueIndex('bk_abrechnungen_einheit_jahr_uq').on(t.einheitId, t.jahr),
    index('bk_abrechnungen_einheit_idx').on(t.einheitId),
  ],
)

export const bkAbrechnungVersionen = pgTable(
  'bk_abrechnung_versionen',
  {
    ...versionsSpalten,
    bkAbrechnungId: uuid('bk_abrechnung_id')
      .notNull()
      .references(() => bkAbrechnungen.id),
    zeitraumVon: date('zeitraum_von', { mode: 'string' }).notNull(),
    zeitraumBis: date('zeitraum_bis', { mode: 'string' }).notNull(),
    positionen: jsonb('positionen').$type<BkPosition[]>().notNull(),
    messdienst: jsonb('messdienst').$type<BkMessdienst>(),
    vorauszahlungen: jsonb('vorauszahlungen').$type<Record<string, number>>(),
    status: text('status').$type<BkStatus>().notNull().default('entwurf'),
    notizen: text('notizen'),
    ergebnis: jsonb('ergebnis').$type<BkFestschreibung[]>(),
  },
  (t) => [uniqueIndex('bk_abrechnung_versionen_nr_uq').on(t.bkAbrechnungId, t.versionNr)],
)
