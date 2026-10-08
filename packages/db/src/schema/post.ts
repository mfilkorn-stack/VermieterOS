import type { AkteurArt } from './ereignisse'
import type { GespraechRichtung, PostfachZweck, ZuordnungArt } from '@vermieteros/schema'
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'

/**
 * Mail-Eingang (WP 1.1). Postfächer sind Konfiguration (änderbar, nie gelöscht, nur deaktiviert).
 * Nachrichten, Anhänge und Zuordnungen sind append-only. Die aktuelle Zuordnung ist der jüngste
 * Eintrag je Nachricht (Sicht `nachrichten_zuordnung_aktuell`).
 */
export const postfaecher = pgTable('postfaecher', {
  id: uuid('id').primaryKey(),
  mandantId: uuid('mandant_id').notNull(),
  bezeichnung: text('bezeichnung').notNull(),
  host: text('host').notNull(),
  port: integer('port').notNull().default(993),
  /** false nur für lokale Tests; Produktion verlangt TLS. */
  tls: boolean('tls').notNull().default(true),
  benutzer: text('benutzer').notNull(),
  /** AES-256-GCM, siehe packages/post/src/geheimnis.ts. Die App-Rolle darf die Spalte nicht lesen. */
  passwortChiffre: text('passwort_chiffre').notNull(),
  ordner: text('ordner').notNull().default('INBOX'),
  /** Beim ersten Abruf nur Nachrichten ab diesem Datum, damit kein Altbestand einläuft. */
  abrufAb: date('abruf_ab', { mode: 'string' }).notNull(),
  aktiv: boolean('aktiv').notNull().default(true),
  /** `belege`: eigene Adresse für Rechnungen; Anhänge landen im Belegeingang, nicht im Posteingang. */
  zweck: text('zweck').$type<PostfachZweck>().notNull().default('post'),
  uidValidity: bigint('uid_validity', { mode: 'number' }),
  letzteUid: bigint('letzte_uid', { mode: 'number' }).notNull().default(0),
  letzterAbruf: timestamp('letzter_abruf', { withTimezone: true, mode: 'string' }),
  letzterFehler: text('letzter_fehler'),
  angelegtAm: timestamp('angelegt_am', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
})

export const nachrichten = pgTable(
  'nachrichten',
  {
    id: uuid('id').primaryKey(),
    mandantId: uuid('mandant_id').notNull(),
    postfachId: uuid('postfach_id')
      .notNull()
      .references(() => postfaecher.id),
    uidValidity: bigint('uid_validity', { mode: 'number' }),
    imapUid: bigint('imap_uid', { mode: 'number' }),
    messageId: text('message_id'),
    inReplyTo: text('in_reply_to'),
    referenzen: text('referenzen').array().notNull().default([]),
    vonAdresse: text('von_adresse').notNull(),
    vonName: text('von_name'),
    an: text('an').array().notNull().default([]),
    betreff: text('betreff').notNull().default(''),
    gesendetAm: timestamp('gesendet_am', { withTimezone: true, mode: 'string' }),
    empfangenAm: timestamp('empfangen_am', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    /** Textteil für Anzeige und Suche; die vollständige Mail liegt als .eml im Object Storage. */
    text: text('text').notNull().default(''),
    rohSchluessel: text('roh_schluessel').notNull(),
    rohSha256: text('roh_sha256').notNull(),
    rohGroesse: integer('roh_groesse').notNull(),
  },
  (t) => [
    // Dieselbe Mail zweimal abgerufen (z. B. nach neuer UIDVALIDITY) wird nicht doppelt angelegt.
    uniqueIndex('nachrichten_postfach_roh_uq').on(t.postfachId, t.rohSha256),
    index('nachrichten_mandant_message_id_idx').on(t.mandantId, t.messageId),
    index('nachrichten_mandant_empfangen_idx').on(t.mandantId, t.empfangenAm),
  ],
)

export const anhaenge = pgTable('anhaenge', {
  id: uuid('id').primaryKey(),
  mandantId: uuid('mandant_id').notNull(),
  nachrichtId: uuid('nachricht_id')
    .notNull()
    .references(() => nachrichten.id),
  dateiname: text('dateiname').notNull(),
  mimeTyp: text('mime_typ').notNull(),
  groesse: integer('groesse').notNull(),
  sha256: text('sha256').notNull(),
  schluessel: text('schluessel').notNull(),
})

export const nachrichtZuordnungen = pgTable(
  'nachricht_zuordnungen',
  {
    id: uuid('id').primaryKey(),
    mandantId: uuid('mandant_id').notNull(),
    nachrichtId: uuid('nachricht_id')
      .notNull()
      .references(() => nachrichten.id),
    /** null bei `aufgehoben` */
    mietverhaeltnisId: uuid('mietverhaeltnis_id'),
    art: text('art').$type<ZuordnungArt>().notNull(),
    begruendung: text('begruendung'),
    akteurArt: text('akteur_art').$type<AkteurArt>().notNull(),
    akteurId: text('akteur_id').notNull(),
    erfasstAm: timestamp('erfasst_am', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('nachricht_zuordnungen_nachricht_idx').on(t.nachrichtId, t.erfasstAm)],
)

/**
 * Antworten aus der App auf eingegangene Mails, append-only. Versand über den zentralen SMTP mit
 * Reply-To auf das Postfach, damit die Rückantwort wieder im Posteingang landet. Der Text bleibt
 * hier, damit der Verlauf des Mietverhältnisses beide Richtungen zeigt.
 */
export const antworten = pgTable(
  'antworten',
  {
    id: uuid('id').primaryKey(),
    mandantId: uuid('mandant_id').notNull(),
    nachrichtId: uuid('nachricht_id')
      .notNull()
      .references(() => nachrichten.id),
    /** Zuordnung der Mail zum Zeitpunkt des Versands; null bei einer nicht zugeordneten Mail */
    mietverhaeltnisId: uuid('mietverhaeltnis_id'),
    an: text('an').array().notNull(),
    betreff: text('betreff').notNull(),
    text: text('text').notNull(),
    messageId: text('message_id').notNull(),
    gesendetAm: timestamp('gesendet_am', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    akteurArt: text('akteur_art').$type<AkteurArt>().notNull(),
    akteurId: text('akteur_id').notNull(),
  },
  (t) => [
    index('antworten_nachricht_idx').on(t.nachrichtId, t.gesendetAm),
    index('antworten_mv_gesendet_idx').on(t.mietverhaeltnisId, t.gesendetAm),
  ],
)

/**
 * Telefonnotizen (WP 1.2), append-only. Eine Korrektur ist eine neue Notiz mit `ersetzt_id`;
 * die ersetzte fällt aus dem Verlauf (Sicht `telefonnotizen_aktuell`), bleibt aber nachvollziehbar.
 */
export const telefonnotizen = pgTable(
  'telefonnotizen',
  {
    id: uuid('id').primaryKey(),
    mandantId: uuid('mandant_id').notNull(),
    mietverhaeltnisId: uuid('mietverhaeltnis_id').notNull(),
    zeitpunkt: timestamp('zeitpunkt', { withTimezone: true, mode: 'string' }).notNull(),
    richtung: text('richtung').$type<GespraechRichtung>().notNull(),
    gespraechspartner: text('gespraechspartner').notNull(),
    betreff: text('betreff').notNull(),
    inhalt: text('inhalt').notNull(),
    ersetztId: uuid('ersetzt_id').references((): AnyPgColumn => telefonnotizen.id),
    akteurArt: text('akteur_art').$type<AkteurArt>().notNull(),
    akteurId: text('akteur_id').notNull(),
    erfasstAm: timestamp('erfasst_am', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('telefonnotizen_mv_zeitpunkt_idx').on(t.mietverhaeltnisId, t.zeitpunkt),
    // Eine Notiz wird höchstens einmal ersetzt: Korrekturen bilden eine Kette, keinen Baum.
    uniqueIndex('telefonnotizen_ersetzt_uq').on(t.ersetztId),
  ],
)
