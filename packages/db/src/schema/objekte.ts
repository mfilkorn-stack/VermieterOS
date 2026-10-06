import {
  bigint,
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { identitaetsSpalten, versionsSpalten } from './versionierung'

import type {
  Bundesland,
  GrundbuchEintrag,
  NebenkostenPosition,
  ObjektArt,
} from '@vermieteros/schema'

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
    bundesland: text('bundesland').$type<Bundesland>(),
    art: text('art').$type<ObjektArt>().notNull(),
    baujahr: integer('baujahr'),
    /** Eigentumswohnung mit WEG-Hausgeldabrechnung als Nebenkosten-Hauptquelle */
    weg: boolean('weg').notNull().default(false),

    grundbuch: jsonb('grundbuch').$type<GrundbuchEintrag[]>(),

    // Steuerliche Grunddaten (Anlage V, AfA)
    /** Beurkundung; Spekulationsfrist § 23 EStG */
    kaufvertragDatum: date('kaufvertrag_datum', { mode: 'string' }),
    /** Übergang von Nutzen und Lasten; AfA-Beginn, 15-%-Grenze */
    anschaffungsdatum: date('anschaffungsdatum', { mode: 'string' }),
    kaufpreisCent: bigint('kaufpreis_cent', { mode: 'number' }),
    anschaffungsnebenkosten: jsonb('anschaffungsnebenkosten').$type<NebenkostenPosition[]>(),
    /** Anteil Gebäude am Kaufpreis in Promille (Rest = Grund und Boden) */
    gebaeudeanteilPromille: integer('gebaeudeanteil_promille'),
    /** AfA-Satz in Promille pro Jahr, z. B. 20 = 2,0 % */
    afaSatzPromille: integer('afa_satz_promille'),
    afaBeginn: date('afa_beginn', { mode: 'string' }),
  },
  (t) => [uniqueIndex('objekt_versionen_objekt_nr_uq').on(t.objektId, t.versionNr)],
)
