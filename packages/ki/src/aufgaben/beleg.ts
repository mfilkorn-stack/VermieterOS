import { BETRKV_KOSTENARTEN, STEUERKATEGORIEN_AUSGABE } from '@vermieteros/schema'
import { z } from 'zod'
import type { Aufgabe } from '../aufgabe'
import { centAus, datumAus, Fundstelle, pruefeFundstelle, type Pruefergebnis } from '../fundstelle'
import type { BelegKontextDaten } from '../kontext/beleg'

export const BelegAuszug = z.object({
  lieferant: Fundstelle.describe('Rechnungsteller (Firma), nicht der Empfänger'),
  rechnungsnummer: Fundstelle,
  rechnungsdatum: Fundstelle,
  betrag_brutto: Fundstelle.describe('Zu zahlender Gesamtbetrag inklusive Umsatzsteuer'),
  umsatzsteuer: Fundstelle.describe('Ausgewiesene Umsatzsteuer als Betrag; null, wenn keine'),
  leistung_von: Fundstelle.describe('Beginn des Leistungs- oder Abrechnungszeitraums'),
  leistung_bis: Fundstelle.describe('Ende des Leistungs- oder Abrechnungszeitraums'),
  zahlungsdatum: Fundstelle.describe(
    'Nur wenn der Beleg sagt, wann bezahlt oder abgebucht wurde bzw. wird; sonst null',
  ),
  einordnung: z.object({
    objekt_id: z
      .string()
      .nullable()
      .describe('ID aus der Objektliste; null, wenn nicht eindeutig oder für alle Objekte'),
    steuerkategorie: z.enum(STEUERKATEGORIEN_AUSGABE),
    kostenart: z
      .enum(BETRKV_KOSTENARTEN)
      .nullable()
      .describe('Nur bei Betriebskosten: Nummer des § 2 BetrKV als Schlüssel'),
    umlagefaehig: z.boolean().describe('Auf Mieter umlegbar nach BetrKV'),
    begruendung: z.string().describe('Ein bis zwei Sätze, warum diese Einordnung'),
  }),
  hinweise: z
    .array(z.string())
    .describe(
      'Auffälligkeiten: Mahnung, Gutschrift, Teilrechnung, Mischung aus Arbeit und Material',
    ),
})
export type BelegAuszug = z.infer<typeof BelegAuszug>

export const BELEG_FELDER = [
  'lieferant',
  'rechnungsnummer',
  'rechnungsdatum',
  'betrag_brutto',
  'umsatzsteuer',
  'leistung_von',
  'leistung_bis',
  'zahlungsdatum',
] as const
export type BelegFeld = (typeof BELEG_FELDER)[number]

/**
 * Liest einen Beleg aus und schlägt die Einordnung vor (WP 1.8). Jede Angabe mit Seite und Zitat;
 * die Software prüft die Zitate am PDF-Text. Die Einordnung ist ein Vorschlag, den ein Mensch
 * bestätigt; die steuerliche Behandlung (AfA, Verteilung) folgt aus der Kategorie.
 */
export const BELEG_EXTRAKTION: Aufgabe<BelegKontextDaten, BelegAuszug> = {
  name: 'beleg_extraktion',
  version: 1,
  maxTokens: 6_000,
  aufwand: 'medium',
  ablaufTage: 30,
  goldenSchwelle: 0.95,
  system: [
    'Du liest Rechnungen und Bescheide für private Vermieter und gibst Eckdaten strukturiert zurück.',
    'Der Beleg liegt als PDF oder Foto bei. Für jede Angabe:',
    '- wert: genau so, wie er auf dem Beleg steht (z. B. "481,50 €", "15.01.2026", "Stadtwerke Musterstadt GmbH").',
    '- seite: die Seite im PDF (erste Seite = 1); bei Fotos 1.',
    '- zitat: ein kurzes wörtliches Zitat von genau dieser Seite, das den Wert enthält, ohne Auslassungen.',
    'Steht eine Angabe nicht auf dem Beleg, gib null zurück. Rechne nichts aus und ergänze nichts.',
    '',
    'Einordnung (Vorschlag, ein Mensch bestätigt):',
    '- objekt_id: nur eine ID aus der mitgeschickten Objektliste. Passt die Lieferanschrift oder Verbrauchsstelle zu genau einem Objekt, nimm es. Ist die Rechnung einem Ticket zugeordnet, gilt dessen Objekt. Sonst null.',
    '- steuerkategorie: erhaltungsaufwand (Reparatur, Instandhaltung, Ersatz gleichwertiger Teile), betriebskosten (laufende Kosten nach BetrKV: Grundsteuer, Wasser, Müll, Versicherung, Hausstrom, Wartung, Schornsteinfeger …), verwaltungskosten (Hausverwaltung, Steuerberatung, Kontoführung), schuldzinsen, geldbeschaffungskosten, herstellungskosten (Neues, Erweiterung, deutliche Verbesserung), anschaffungskosten (Kauf, Notar und Grundbuch beim Erwerb), sonstige_werbungskosten, nicht_abziehbar (privat).',
    '- kostenart: nur bei betriebskosten, sonst null.',
    '- umlagefaehig: true nur für Betriebskosten, die nach § 2 BetrKV umlegbar sind. Reparaturen und Verwaltung sind nie umlagefähig.',
    'Bei Handwerkerrechnungen mit Wartung und Reparatur: Kategorie nach dem überwiegenden Teil, Mischung als Hinweis.',
  ].join('\n'),
  nachricht: (d) =>
    JSON.stringify(
      {
        beleg: { titel: d.titel, dateiname: d.dateiname, seiten: d.seiten.length || null },
        objekte: d.objekte.map((o) => ({
          id: o.id,
          bezeichnung: o.bezeichnung,
          anschrift: o.anschrift,
        })),
        vorgewaehltes_objekt: d.objektId,
        ticket: d.ticket,
      },
      null,
      2,
    ),
  dateien: (d) => [{ mime: d.mime, daten: d.datei }],
  ausgabe: BelegAuszug,
  pruefe: (a, d) => {
    const befunde: string[] = []
    const e = a.einordnung
    if (e.objekt_id && !d.objekte.some((o) => o.id === e.objekt_id)) {
      befunde.push(`Objekt ${e.objekt_id} steht nicht in der Objektliste`)
    }
    if (e.kostenart && e.steuerkategorie !== 'betriebskosten') {
      befunde.push('Kostenart ohne Betriebskosten')
    }
    if (e.umlagefaehig && (e.steuerkategorie !== 'betriebskosten' || !e.kostenart)) {
      befunde.push('Umlagefähig nur für Betriebskosten mit Kostenart')
    }
    return befunde
  },
}

export type BelegAuswertung = {
  feld: BelegFeld
  wert: string
  seite: number
  zitat: string
  pruefung: Pruefergebnis
  /** Cent, ISO-Datum oder Text; null, wenn der Wert nicht lesbar ist */
  normiert: number | string | null
}

/** Prüft jede Fundstelle am Seitentext; nur belegte Werte werden ins Buchungsformular übernommen. */
export function werteBelegAus(a: BelegAuszug, seiten: string[]): BelegAuswertung[] {
  const out: BelegAuswertung[] = []
  for (const feld of BELEG_FELDER) {
    const f = a[feld]
    if (!f) continue
    const normiert =
      feld === 'betrag_brutto' || feld === 'umsatzsteuer'
        ? centAus(f.wert)
        : feld === 'lieferant' || feld === 'rechnungsnummer'
          ? f.wert.trim() || null
          : datumAus(f.wert)
    out.push({
      feld,
      wert: f.wert,
      seite: f.seite,
      zitat: f.zitat,
      pruefung: pruefeFundstelle(f, seiten, normiert),
      normiert,
    })
  }
  return out
}
