import type {
  BetrkvKostenart,
  Herkunft,
  JournalRichtung,
  Steuerkategorie,
} from '@vermieteros/schema'
import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { tickets } from './betrieb'
import { dokumente } from './dokumente'
import { einheiten } from './einheiten'
import { ereignisse } from './ereignisse'
import { kiVorschlaege } from './ki'
import { objekte } from './objekte'

/**
 * Journal (WP 1.8). Append-only wie Zählerstände: eine Zeile je Buchung, Korrektur per Storno
 * (stornos.version_id = journal_eintraege.id, entitaet = 'journaleintrag') und Neubuchung.
 *
 * `lfd_nr` vergibt der Trigger `journal_vor_insert` fortlaufend je Mandant und Zahlungsjahr;
 * `jahr` und `belegnummer` (2026-0042) rechnet die Datenbank. Ein Constraint-Trigger prüft am
 * Ende der Transaktion, dass die Anteile genau den Bruttobetrag ergeben.
 */
export const journalEintraege = pgTable(
  'journal_eintraege',
  {
    id: uuid('id').primaryKey(),
    mandantId: uuid('mandant_id').notNull(),
    jahr: integer('jahr').generatedAlwaysAs(sql`(EXTRACT(YEAR FROM zahlungsdatum))::int`),
    lfdNr: integer('lfd_nr').notNull().default(0),
    belegnummer: text('belegnummer').generatedAlwaysAs(
      sql`((EXTRACT(YEAR FROM zahlungsdatum))::int)::text || '-' || lpad(lfd_nr::text, 4, '0')`,
    ),
    richtung: text('richtung').$type<JournalRichtung>().notNull(),
    gegenpartei: text('gegenpartei').notNull(),
    beschreibung: text('beschreibung'),
    rechnungsnummer: text('rechnungsnummer'),
    rechnungsdatum: date('rechnungsdatum', { mode: 'string' }),
    zahlungsdatum: date('zahlungsdatum', { mode: 'string' }).notNull(),
    leistungVon: date('leistung_von', { mode: 'string' }),
    leistungBis: date('leistung_bis', { mode: 'string' }),
    bruttoCent: bigint('brutto_cent', { mode: 'number' }).notNull(),
    umsatzsteuerCent: bigint('umsatzsteuer_cent', { mode: 'number' }),
    steuerkategorie: text('steuerkategorie').$type<Steuerkategorie>().notNull(),
    verteilungJahre: integer('verteilung_jahre'),
    kostenart: text('kostenart').$type<BetrkvKostenart>(),
    umlagefaehig: boolean('umlagefaehig').notNull().default(false),
    /** Der Beleg (Dokument); leer bei Einnahmen oder Ausgaben ohne Beleg */
    dokumentId: uuid('dokument_id').references(() => dokumente.id),
    ticketId: uuid('ticket_id').references(() => tickets.id),
    /** KI-Vorschlag, aus dem die Buchung bestätigt wurde */
    vorschlagId: uuid('vorschlag_id').references(() => kiVorschlaege.id),
    /** Herkunft je Feld, wie bei Versionen (Dokument mit Seite, manuell) */
    herkunft: jsonb('herkunft').$type<Herkunft>().notNull().default({}),
    ereignisId: uuid('ereignis_id')
      .notNull()
      .references(() => ereignisse.id),
    erfasstAm: timestamp('erfasst_am', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    erfasstVon: text('erfasst_von').notNull(),
  },
  (t) => [
    uniqueIndex('journal_eintraege_nummer_uq').on(t.mandantId, t.jahr, t.lfdNr),
    index('journal_eintraege_zahlung_idx').on(t.mandantId, t.zahlungsdatum),
    index('journal_eintraege_dokument_idx').on(t.dokumentId),
  ],
)

/** Aufteilung eines Eintrags auf Objekte (und ggf. Einheiten). Summe = Bruttobetrag. */
export const journalAnteile = pgTable(
  'journal_anteile',
  {
    id: uuid('id').primaryKey(),
    mandantId: uuid('mandant_id').notNull(),
    eintragId: uuid('eintrag_id')
      .notNull()
      .references(() => journalEintraege.id),
    objektId: uuid('objekt_id')
      .notNull()
      .references(() => objekte.id),
    einheitId: uuid('einheit_id').references(() => einheiten.id),
    betragCent: bigint('betrag_cent', { mode: 'number' }).notNull(),
  },
  (t) => [
    index('journal_anteile_eintrag_idx').on(t.eintragId),
    index('journal_anteile_objekt_idx').on(t.objektId),
  ],
)
