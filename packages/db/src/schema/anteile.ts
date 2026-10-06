import { integer, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { personen } from './personen'
import { identitaetsSpalten, versionsSpalten } from './versionierung'

/**
 * Eigentumsanteil einer Person am Mandanten (Bruchteil, GbR, Ehepaar). Grundlage der
 * Aufteilung im Steuerpaket (gesonderte und einheitliche Feststellung). Versioniert,
 * weil Anteile sich durch Schenkung, Erbe oder Verkauf ändern.
 */
export const eigentumsanteile = pgTable('eigentumsanteile', {
  ...identitaetsSpalten,
  personId: uuid('person_id')
    .notNull()
    .references(() => personen.id),
})

export const eigentumsanteilVersionen = pgTable(
  'eigentumsanteil_versionen',
  {
    ...versionsSpalten,
    eigentumsanteilId: uuid('eigentumsanteil_id')
      .notNull()
      .references(() => eigentumsanteile.id),
    zaehler: integer('zaehler').notNull(),
    nenner: integer('nenner').notNull(),
  },
  (t) => [uniqueIndex('eigentumsanteil_versionen_nr_uq').on(t.eigentumsanteilId, t.versionNr)],
)
