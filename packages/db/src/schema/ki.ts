import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import type { AkteurArt } from './ereignisse'

export const KI_STATUS = ['offen', 'bestaetigt', 'verworfen', 'veraltet'] as const
export type KiStatus = (typeof KI_STATUS)[number]
/** Was als Entscheidung gespeichert wird; `offen` ist der Zustand ohne Entscheidung. */
export type KiEntscheidung = Exclude<KiStatus, 'offen'>

/**
 * KI-Vorschläge (WP 1.4, PLAN 4.2). Append-only: Inhalt, Stempel und Ablauf ändern sich nie.
 * Der Status ergibt sich aus `ki_vorschlag_entscheidungen` und dem Ablaufdatum
 * (Sicht `ki_vorschlaege_aktuell`). Nur ein bestätigter Vorschlag fließt in eine Version.
 */
export const kiVorschlaege = pgTable(
  'ki_vorschlaege',
  {
    id: uuid('id').primaryKey(),
    mandantId: uuid('mandant_id').notNull(),
    /** Aufgabe aus dem Prompt-Register, z. B. `antwortvorschlag` */
    aufgabe: text('aufgabe').notNull(),
    /** Worauf sich der Vorschlag bezieht, z. B. `nachricht` + ID */
    bezugEntitaet: text('bezug_entitaet').notNull(),
    bezugId: uuid('bezug_id').notNull(),
    /** Versionsstempel: Ledger-Stand, Referenzen, Dokument-Prüfsummen, Prompt-Version, Modell */
    stempel: jsonb('stempel').$type<Record<string, unknown>>().notNull(),
    /** Gegen das Zod-Schema der Aufgabe validierte Ausgabe des Modells */
    ausgabe: jsonb('ausgabe').$type<Record<string, unknown>>().notNull(),
    /** Request-ID und Token-Verbrauch, für Kosten und Support */
    aufruf: jsonb('aufruf').$type<Record<string, unknown>>().notNull().default({}),
    ablaufAm: timestamp('ablauf_am', { withTimezone: true, mode: 'string' }).notNull(),
    akteurArt: text('akteur_art').$type<AkteurArt>().notNull(),
    akteurId: text('akteur_id').notNull(),
    erfasstAm: timestamp('erfasst_am', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('ki_vorschlaege_bezug_idx').on(t.bezugEntitaet, t.bezugId, t.erfasstAm)],
)

/** Höchstens eine Entscheidung pro Vorschlag, append-only. */
export const kiVorschlagEntscheidungen = pgTable('ki_vorschlag_entscheidungen', {
  vorschlagId: uuid('vorschlag_id')
    .primaryKey()
    .references(() => kiVorschlaege.id),
  mandantId: uuid('mandant_id').notNull(),
  status: text('status').$type<KiEntscheidung>().notNull(),
  grund: text('grund'),
  akteurArt: text('akteur_art').$type<AkteurArt>().notNull(),
  akteurId: text('akteur_id').notNull(),
  erfasstAm: timestamp('erfasst_am', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
})
