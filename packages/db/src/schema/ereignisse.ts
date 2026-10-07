import { bigint, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

export const EREIGNIS_TYPEN = [
  'mandant_angelegt',
  'version_angelegt',
  'version_storniert',
  'zaehlerstand_erfasst',
  'festschreibung',
  'dokument_abgelegt',
  'ki_vorschlag',
  'ki_vorschlag_entschieden',
  'ki_aufruf',
  'integritaet_geprueft',
  'postfach_angelegt',
  'postfach_geaendert',
  'nachricht_eingegangen',
  'nachricht_zugeordnet',
  'telefonnotiz_erfasst',
  'journal_gebucht',
] as const
export type EreignisTyp = (typeof EREIGNIS_TYPEN)[number]

export const AKTEUR_ARTEN = ['nutzer', 'system', 'portal'] as const
export type AkteurArt = (typeof AKTEUR_ARTEN)[number]

export type Akteur = { art: AkteurArt; id: string }

/**
 * Der Ledger. Append-only, eine Zeile pro fachlicher Änderung, SHA-256-Kette pro Mandant.
 * `seq`, `prev_hash`, `hash` und `erfasst_am` setzt der Trigger `ereignis_vor_insert`
 * (Migration 0001), nie die Anwendung. UPDATE und DELETE sind per Recht und Trigger blockiert.
 */
export const ereignisse = pgTable(
  'ereignisse',
  {
    id: uuid('id').primaryKey(),
    mandantId: uuid('mandant_id').notNull(),
    seq: bigint('seq', { mode: 'number' }).notNull().default(0),
    typ: text('typ').$type<EreignisTyp>().notNull(),
    entitaet: text('entitaet'),
    entitaetId: uuid('entitaet_id'),
    versionId: uuid('version_id'),
    akteurArt: text('akteur_art').$type<AkteurArt>().notNull(),
    akteurId: text('akteur_id').notNull(),
    erfasstAm: timestamp('erfasst_am', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    prevHash: text('prev_hash').notNull().default(''),
    hash: text('hash').notNull().default(''),
  },
  (t) => [uniqueIndex('ereignisse_mandant_seq_uq').on(t.mandantId, t.seq)],
)

/**
 * Storno einer Version. Die Version bleibt lesbar, fällt aber aus allen Sichten.
 * Append-only; der Zeitpunkt zählt für `*_stand(..., erfasst_bis)`.
 */
export const stornos = pgTable('stornos', {
  versionId: uuid('version_id').primaryKey(),
  mandantId: uuid('mandant_id').notNull(),
  entitaet: text('entitaet').notNull(),
  ereignisId: uuid('ereignis_id')
    .notNull()
    .references(() => ereignisse.id),
  grund: text('grund').notNull(),
  erfasstAm: timestamp('erfasst_am', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  erfasstVon: text('erfasst_von').notNull(),
})
