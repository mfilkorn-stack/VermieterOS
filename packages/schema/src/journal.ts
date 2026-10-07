import { z } from 'zod'
import {
  BetrkvKostenart,
  JournalRichtung,
  STEUERKATEGORIEN_EINNAHME,
  Steuerkategorie,
  type JournalRichtung as Richtung,
} from './enums'
import { Cent, CentNichtNegativ, Datum, Notiz, Text, Uuid } from './gemeinsam'

/*
 * Journal (WP 1.8). Jeder Euro, der für ein Objekt rein- oder rausgeht, hat genau einen Eintrag;
 * Einträge sind unveränderlich, Korrektur per Storno und Neubuchung.
 */

/** Anteil eines Eintrags an einem Objekt (Aufteilung z. B. von Steuerberatung, Kontoführung). */
export const JournalAnteil = z.object({
  objektId: Uuid,
  einheitId: Uuid.nullish(),
  betragCent: Cent.positive(),
})
export type JournalAnteil = z.infer<typeof JournalAnteil>

export function richtungVon(k: Steuerkategorie): Richtung {
  return (STEUERKATEGORIEN_EINNAHME as readonly string[]).includes(k) ? 'einnahme' : 'ausgabe'
}

/**
 * Steuerliche Behandlung, abgeleitet statt frei gewählt, damit keine widersprüchlichen Paare
 * entstehen: Herstellungs- und Anschaffungskosten laufen über die AfA, Erhaltungsaufwand ist
 * sofort abziehbar oder auf 2 bis 5 Jahre verteilt (§ 82b EStDV), Privates zählt nicht.
 */
export type Behandlung = 'einnahme' | 'sofort' | 'verteilt' | 'afa' | 'privat'
export function behandlung(k: Steuerkategorie, verteilungJahre?: number | null): Behandlung {
  if (richtungVon(k) === 'einnahme') return 'einnahme'
  if (k === 'herstellungskosten' || k === 'anschaffungskosten') return 'afa'
  if (k === 'nicht_abziehbar') return 'privat'
  if (k === 'erhaltungsaufwand' && verteilungJahre) return 'verteilt'
  return 'sofort'
}

export const JournalEintragDaten = z
  .object({
    richtung: JournalRichtung,
    /** Lieferant bei Ausgaben, Zahler bei Einnahmen */
    gegenpartei: Text,
    beschreibung: Notiz.nullish(),
    rechnungsnummer: z.string().trim().min(1).max(100).nullish(),
    rechnungsdatum: Datum.nullish(),
    /** Für die Steuer zählt der Zahlungstag (Zu- und Abflussprinzip, § 11 EStG). */
    zahlungsdatum: Datum,
    /** Für die Nebenkosten zählt der Leistungszeitraum. */
    leistungVon: Datum.nullish(),
    leistungBis: Datum.nullish(),
    bruttoCent: Cent.positive(),
    umsatzsteuerCent: CentNichtNegativ.nullish(),
    steuerkategorie: Steuerkategorie,
    /** Nur Erhaltungsaufwand: Verteilung auf 2 bis 5 Jahre; leer = sofort abziehbar. */
    verteilungJahre: z.number().int().min(2).max(5).nullish(),
    kostenart: BetrkvKostenart.nullish(),
    umlagefaehig: z.boolean().default(false),
    anteile: z.array(JournalAnteil).min(1, 'Mindestens ein Objekt'),
  })
  .superRefine((e, ctx) => {
    const fehler = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message })
    if (richtungVon(e.steuerkategorie) !== e.richtung) {
      fehler('steuerkategorie', 'Kategorie passt nicht zu Einnahme oder Ausgabe')
    }
    if (e.verteilungJahre && e.steuerkategorie !== 'erhaltungsaufwand') {
      fehler('verteilungJahre', 'Verteilen lässt sich nur Erhaltungsaufwand')
    }
    if (e.kostenart && e.steuerkategorie !== 'betriebskosten') {
      fehler('kostenart', 'Kostenart nach BetrKV nur bei Betriebskosten')
    }
    if (e.umlagefaehig) {
      if (e.steuerkategorie !== 'betriebskosten') {
        fehler('umlagefaehig', 'Umlagefähig sind nur Betriebskosten')
      }
      if (!e.kostenart) fehler('kostenart', 'Umlagefähige Kosten brauchen eine Kostenart')
      if (!e.leistungVon || !e.leistungBis) {
        fehler('leistungVon', 'Umlagefähige Kosten brauchen den Leistungszeitraum')
      }
    }
    if (Boolean(e.leistungVon) !== Boolean(e.leistungBis)) {
      fehler('leistungBis', 'Leistungszeitraum: von und bis angeben')
    } else if (e.leistungVon && e.leistungBis && e.leistungVon > e.leistungBis) {
      fehler('leistungBis', 'Leistungszeitraum endet vor dem Beginn')
    }
    if (e.umsatzsteuerCent != null && e.umsatzsteuerCent >= e.bruttoCent) {
      fehler('umsatzsteuerCent', 'Umsatzsteuer muss kleiner als der Bruttobetrag sein')
    }
    const summe = e.anteile.reduce((s, a) => s + a.betragCent, 0)
    if (summe !== e.bruttoCent) {
      fehler('anteile', 'Die Anteile müssen zusammen den Bruttobetrag ergeben')
    }
    const orte = new Set(e.anteile.map((a) => `${a.objektId}|${a.einheitId ?? ''}`))
    if (orte.size !== e.anteile.length) fehler('anteile', 'Ein Objekt ist doppelt aufgeteilt')
  })
export type JournalEintragDaten = z.infer<typeof JournalEintragDaten>

/**
 * Teilt einen Betrag in n Anteile auf, deren Summe exakt stimmt; der Rest-Cent geht an die
 * ersten Anteile.
 */
export function gleichAufteilen(bruttoCent: number, n: number): number[] {
  const basis = Math.floor(bruttoCent / n)
  const rest = bruttoCent - basis * n
  return Array.from({ length: n }, (_, i) => basis + (i < rest ? 1 : 0))
}
