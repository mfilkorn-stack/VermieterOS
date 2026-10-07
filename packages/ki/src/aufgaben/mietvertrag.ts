import { z } from 'zod'
import type { Aufgabe } from '../aufgabe'
import type { DokumentKontextDaten } from '../kontext/dokument'
import {
  centAus,
  datumAus,
  Fundstelle,
  monateAus,
  pruefeFundstelle,
  type Pruefergebnis,
} from '../fundstelle'

export { centAus, datumAus, monateAus } from '../fundstelle'

export const MietvertragAuszug = z.object({
  mietbeginn: Fundstelle,
  kaltmiete: Fundstelle,
  vorauszahlung_betriebskosten: Fundstelle,
  vorauszahlung_heizkosten: Fundstelle,
  kaution: Fundstelle,
  kuendigungsfrist_monate: Fundstelle,
  mieter: z.array(z.string()).describe('Namen der Mieter laut Vertrag'),
  hinweise: z.array(z.string()).describe('Auffälligkeiten, z. B. Staffel- oder Indexmiete'),
})
export type MietvertragAuszug = z.infer<typeof MietvertragAuszug>

export const MIETVERTRAG_FELDER = [
  'mietbeginn',
  'kaltmiete',
  'vorauszahlung_betriebskosten',
  'vorauszahlung_heizkosten',
  'kaution',
  'kuendigungsfrist_monate',
] as const
export type MietvertragFeld = (typeof MIETVERTRAG_FELDER)[number]

/**
 * Liest Eckdaten aus einem Mietvertrag (WP 1.7). Jede Angabe trägt Seite und Zitat; die Software
 * prüft beides am Text des PDFs, bevor etwas übernommen werden kann (`werteMietvertragAus`).
 */
export const MIETVERTRAG_EXTRAKTION: Aufgabe<DokumentKontextDaten, MietvertragAuszug> = {
  name: 'mietvertrag_extraktion',
  version: 1,
  maxTokens: 8_000,
  aufwand: 'high',
  ablaufTage: 30,
  goldenSchwelle: 0.95,
  system: [
    'Du liest Wohnraummietverträge für private Vermieter und gibst Eckdaten strukturiert zurück.',
    'Der Vertrag liegt als PDF bei. Für jede Angabe:',
    '- wert: genau so, wie er im Vertrag steht (z. B. "650,00 €", "01.09.2021", "drei Monate").',
    '- seite: die Seite im PDF, auf der er steht (erste Seite = 1).',
    '- zitat: ein kurzes wörtliches Zitat von genau dieser Seite, das den Wert enthält, ohne Auslassungen.',
    'Steht eine Angabe nicht im Vertrag oder ist sie unklar, gib null zurück. Rechne nichts aus und ergänze nichts.',
    'kaltmiete ist die Nettokaltmiete ohne Vorauszahlungen. Betriebs- und Heizkosten nur, wenn getrennt als Vorauszahlung genannt; eine Pauschale ist keine Vorauszahlung, dann Hinweis.',
    'kuendigungsfrist_monate: die Frist für den Mieter; nur wenn der Vertrag sie nennt.',
    'Hinweise: Staffel- oder Indexmiete, befristeter Vertrag, Kündigungsverzicht, Pauschalen, handschriftliche Änderungen.',
  ].join('\n'),
  nachricht: (d) =>
    JSON.stringify(
      {
        dokument: { titel: d.titel, dateiname: d.dateiname, seiten: d.seiten.length || null },
        bekannt: d.mietverhaeltnis,
      },
      null,
      2,
    ),
  dateien: (d) => [{ mime: d.mime, daten: d.datei }],
  ausgabe: MietvertragAuszug,
}

export type Auswertung = {
  feld: MietvertragFeld
  wert: string
  seite: number
  zitat: string
  /** belegt: Zitat steht auf der Seite und enthält den Wert; scan: PDF ohne Text, nicht prüfbar */
  pruefung: Pruefergebnis
  /** Cent, ISO-Datum oder Monate; null, wenn der Wert nicht lesbar ist */
  normiert: number | string | null
}

/**
 * Prüft jede Fundstelle am Seitentext: steht das Zitat auf der genannten Seite und enthält es den
 * Wert? Nur belegte Werte lassen sich übernehmen. Bei Scans ohne Text bleibt nur der Hinweis.
 */
export function werteMietvertragAus(a: MietvertragAuszug, seiten: string[]): Auswertung[] {
  const out: Auswertung[] = []
  for (const feld of MIETVERTRAG_FELDER) {
    const f = a[feld]
    if (!f) continue
    const normiert =
      feld === 'mietbeginn'
        ? datumAus(f.wert)
        : feld === 'kuendigungsfrist_monate'
          ? monateAus(f.wert)
          : centAus(f.wert)
    const pruefung = pruefeFundstelle(f, seiten, normiert)
    out.push({ feld, wert: f.wert, seite: f.seite, zitat: f.zitat, pruefung, normiert })
  }
  return out
}
