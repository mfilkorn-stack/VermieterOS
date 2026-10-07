import type {
  Gewerk,
  NotfallEintrag,
  Prioritaet,
  TicketStatus,
  WissenKategorie,
} from '@vermieteros/schema'
import {
  boolean,
  index,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { einheiten } from './einheiten'
import { mietverhaeltnisse } from './mietverhaeltnisse'
import { objekte } from './objekte'
import { nachrichten } from './post'
import { identitaetsSpalten, versionsSpalten } from './versionierung'

/** Handwerkerverzeichnis des Mandanten (WP 1.6). */
export const handwerker = pgTable('handwerker', { ...identitaetsSpalten })

export const handwerkerVersionen = pgTable(
  'handwerker_versionen',
  {
    ...versionsSpalten,
    handwerkerId: uuid('handwerker_id')
      .notNull()
      .references(() => handwerker.id),
    firma: text('firma').notNull(),
    ansprechpartner: text('ansprechpartner'),
    gewerke: text('gewerke').array().$type<Gewerk[]>().notNull(),
    telefon: text('telefon'),
    notdienstTelefon: text('notdienst_telefon'),
    email: text('email'),
    notdienst: boolean('notdienst').notNull().default(false),
    /** Leer = für alle Objekte */
    objektIds: uuid('objekt_ids').array().notNull().default([]),
    bewertung: smallint('bewertung'),
    notizen: text('notizen'),
  },
  (t) => [uniqueIndex('handwerker_versionen_nr_uq').on(t.handwerkerId, t.versionNr)],
)

/** Notfallkarte: genau eine je Objekt, versioniert als Ganzes. */
export const notfallkarten = pgTable(
  'notfallkarten',
  {
    ...identitaetsSpalten,
    objektId: uuid('objekt_id')
      .notNull()
      .references(() => objekte.id),
  },
  (t) => [uniqueIndex('notfallkarten_objekt_uq').on(t.objektId)],
)

export const notfallkarteVersionen = pgTable(
  'notfallkarte_versionen',
  {
    ...versionsSpalten,
    notfallkarteId: uuid('notfallkarte_id')
      .notNull()
      .references(() => notfallkarten.id),
    eintraege: jsonb('eintraege').$type<NotfallEintrag[]>().notNull(),
  },
  (t) => [uniqueIndex('notfallkarte_versionen_nr_uq').on(t.notfallkarteId, t.versionNr)],
)

/** Wissensbasis: Artikel je Objekt (Hausordnung, Anleitungen, Müll, häufige Fragen). */
export const wissensartikel = pgTable('wissensartikel', {
  ...identitaetsSpalten,
  objektId: uuid('objekt_id')
    .notNull()
    .references(() => objekte.id),
})

export const wissensartikelVersionen = pgTable(
  'wissensartikel_versionen',
  {
    ...versionsSpalten,
    wissensartikelId: uuid('wissensartikel_id')
      .notNull()
      .references(() => wissensartikel.id),
    titel: text('titel').notNull(),
    kategorie: text('kategorie').$type<WissenKategorie>().notNull(),
    inhalt: text('inhalt').notNull(),
    mieterSichtbar: boolean('mieter_sichtbar').notNull().default(true),
  },
  (t) => [uniqueIndex('wissensartikel_versionen_nr_uq').on(t.wissensartikelId, t.versionNr)],
)

/** Ticket: Mangel von der Meldung bis zur Rechnung. Jeder Statuswechsel ist eine Version. */
export const tickets = pgTable(
  'tickets',
  {
    ...identitaetsSpalten,
    objektId: uuid('objekt_id')
      .notNull()
      .references(() => objekte.id),
    einheitId: uuid('einheit_id').references(() => einheiten.id),
    mietverhaeltnisId: uuid('mietverhaeltnis_id').references(() => mietverhaeltnisse.id),
    nachrichtId: uuid('nachricht_id').references(() => nachrichten.id),
  },
  (t) => [index('tickets_objekt_idx').on(t.objektId)],
)

export const ticketVersionen = pgTable(
  'ticket_versionen',
  {
    ...versionsSpalten,
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id),
    titel: text('titel').notNull(),
    beschreibung: text('beschreibung'),
    status: text('status').$type<TicketStatus>().notNull().default('gemeldet'),
    prioritaet: text('prioritaet').$type<Prioritaet>().notNull().default('normal'),
    /** Beauftragter Handwerker (nicht `handwerkerId`: das ist der Schlüssel der Handwerker-Versionen) */
    auftragnehmerId: uuid('auftragnehmer_id').references(() => handwerker.id),
    termin: timestamp('termin', { withTimezone: true, mode: 'string' }),
    notizen: text('notizen'),
  },
  (t) => [uniqueIndex('ticket_versionen_nr_uq').on(t.ticketId, t.versionNr)],
)
