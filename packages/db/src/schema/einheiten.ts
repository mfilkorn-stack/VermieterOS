import { integer, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { objekte } from './objekte'
import { identitaetsSpalten, versionsSpalten } from './versionierung'

import type { EinheitTyp } from '@vermieteros/schema'

/** Identität einer Einheit. Die Zugehörigkeit zum Objekt ist Teil der Identität. */
export const einheiten = pgTable('einheiten', {
  ...identitaetsSpalten,
  objektId: uuid('objekt_id')
    .notNull()
    .references(() => objekte.id),
})

export const einheitVersionen = pgTable(
  'einheit_versionen',
  {
    ...versionsSpalten,
    einheitId: uuid('einheit_id')
      .notNull()
      .references(() => einheiten.id),

    bezeichnung: text('bezeichnung').notNull(),
    lage: text('lage'),
    typ: text('typ').$type<EinheitTyp>().notNull().default('wohnung'),
    /** Wohnfläche in Hundertstel-m² (72,50 m² = 7250), nach WoFlV */
    wohnflaecheQm100: integer('wohnflaeche_qm100'),
    /** Zimmer in Zehnteln (2,5 Zimmer = 25) */
    zimmerX10: integer('zimmer_x10'),
    /** Miteigentumsanteil als Bruch, z. B. 123/10000 */
    miteigentumsanteilZaehler: integer('miteigentumsanteil_zaehler'),
    miteigentumsanteilNenner: integer('miteigentumsanteil_nenner'),
  },
  (t) => [uniqueIndex('einheit_versionen_einheit_nr_uq').on(t.einheitId, t.versionNr)],
)
