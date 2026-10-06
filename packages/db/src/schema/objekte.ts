import {
  bigint,
  boolean,
  date,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { identitaetsSpalten, versionsSpalten } from './versionierung'

export const OBJEKT_ARTEN = ['haus', 'etw'] as const
export type ObjektArt = (typeof OBJEKT_ARTEN)[number]

/** Identität eines Objekts (Haus oder Eigentumswohnung). Ändert sich nie. */
export const objekte = pgTable('objekte', {
  ...identitaetsSpalten,
})

/** Versionen eines Objekts. Alle Fachfelder, append-only. */
export const objektVersionen = pgTable(
  'objekt_versionen',
  {
    ...versionsSpalten,
    objektId: uuid('objekt_id')
      .notNull()
      .references(() => objekte.id),

    bezeichnung: text('bezeichnung').notNull(),
    strasse: text('strasse'),
    hausnummer: text('hausnummer'),
    plz: text('plz'),
    ort: text('ort'),
    art: text('art').$type<ObjektArt>().notNull(),
    baujahr: integer('baujahr'),
    /** Eigentumswohnung mit WEG-Hausgeldabrechnung als Nebenkosten-Hauptquelle */
    weg: boolean('weg').notNull().default(false),

    // Steuerliche Grunddaten (Anlage V, AfA)
    anschaffungsdatum: date('anschaffungsdatum', { mode: 'string' }),
    kaufpreisCent: bigint('kaufpreis_cent', { mode: 'number' }),
    anschaffungsnebenkostenCent: bigint('anschaffungsnebenkosten_cent', { mode: 'number' }),
    /** Anteil Gebäude am Kaufpreis in Promille (Rest = Grund und Boden) */
    gebaeudeanteilPromille: integer('gebaeudeanteil_promille'),
    /** AfA-Satz in Promille pro Jahr, z. B. 20 = 2,0 % */
    afaSatzPromille: integer('afa_satz_promille'),
    afaBeginn: date('afa_beginn', { mode: 'string' }),
  },
  (t) => [uniqueIndex('objekt_versionen_objekt_nr_uq').on(t.objektId, t.versionNr)],
)
