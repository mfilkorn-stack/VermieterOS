import {
  bigint,
  index,
  jsonb,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { dokumente } from './dokumente'
import { objekte } from './objekte'
import { identitaetsSpalten, versionsSpalten } from './versionierung'

/** Steuerpaket je Objekt und Jahr (WP 2.6); eines je Objekt und Jahr. */
export const steuerpakete = pgTable(
  'steuerpakete',
  {
    ...identitaetsSpalten,
    objektId: uuid('objekt_id')
      .notNull()
      .references(() => objekte.id),
    jahr: smallint('jahr').notNull(),
  },
  (t) => [
    uniqueIndex('steuerpakete_objekt_jahr_uq').on(t.objektId, t.jahr),
    index('steuerpakete_objekt_idx').on(t.objektId),
  ],
)

export const steuerpaketVersionen = pgTable(
  'steuerpaket_versionen',
  {
    ...versionsSpalten,
    steuerpaketId: uuid('steuerpaket_id')
      .notNull()
      .references(() => steuerpakete.id),
    mietausfallCent: bigint('mietausfall_cent', { mode: 'number' }),
    hausgeld: jsonb('hausgeld').$type<{
      gezahltCent: number
      zufuehrungCent: number
      entnahmeCent: number
    }>(),
    schuldzinsenCent: bigint('schuldzinsen_cent', { mode: 'number' }),
    weitere: jsonb('weitere').$type<Array<{ bezeichnung: string; betragCent: number }>>(),
    notizen: text('notizen'),
    status: text('status').$type<'entwurf' | 'festgeschrieben'>().notNull().default('entwurf'),
    ueberschussCent: bigint('ueberschuss_cent', { mode: 'number' }),
    paketDokumentId: uuid('paket_dokument_id').references(() => dokumente.id),
  },
  (t) => [uniqueIndex('steuerpaket_versionen_nr_uq').on(t.steuerpaketId, t.versionNr)],
)
