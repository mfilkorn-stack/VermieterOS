import { z } from 'zod'
import type { Aufgabe } from '../aufgabe'
import type { DokumentKontextDaten } from '../kontext/dokument'
import { vergleichsform } from '../pdf'

const Fundstelle = z
  .object({
    wert: z.string().describe('Der Wert genau so, wie er im Vertrag steht'),
    seite: z.number().int().describe('Seite im PDF, beginnend bei 1'),
    zitat: z.string().describe('Wörtliches Zitat von dieser Seite, das den Wert enthält'),
  })
  .nullable()
export type Fundstelle = z.infer<typeof Fundstelle>

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
  pruefung: 'belegt' | 'nicht_belegt' | 'scan'
  /** Cent, ISO-Datum oder Monate; null, wenn der Wert nicht lesbar ist */
  normiert: number | string | null
}

const MONATE: Record<string, number> = {
  januar: 1,
  februar: 2,
  märz: 3,
  maerz: 3,
  april: 4,
  mai: 5,
  juni: 6,
  juli: 7,
  august: 8,
  september: 9,
  oktober: 10,
  november: 11,
  dezember: 12,
}
const ZAHLWOERTER: Record<string, number> = {
  ein: 1,
  eins: 1,
  einen: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  fünf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
  elf: 11,
  zwölf: 12,
}

export function datumAus(t: string): string | null {
  const iso = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const de = t.match(/\b(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})\b/)
  if (de) return `${de[3]}-${de[2]!.padStart(2, '0')}-${de[1]!.padStart(2, '0')}`
  const lang = t.toLowerCase().match(/\b(\d{1,2})\.\s*([a-zäöü]+)\s+(\d{4})\b/)
  const monat = lang ? MONATE[lang[2]!] : undefined
  if (lang && monat)
    return `${lang[3]}-${String(monat).padStart(2, '0')}-${lang[1]!.padStart(2, '0')}`
  return null
}

/** „1.234,56 €“ → 123456 Cent; „650 €“ → 65000. */
export function centAus(t: string): number | null {
  const m = t.match(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?/)
  if (!m) return null
  const euro = Number(m[1]!.replace(/\./g, ''))
  const cent = m[2] ? Number(m[2].padEnd(2, '0')) : 0
  return euro * 100 + cent
}

export function monateAus(t: string): number | null {
  const z = t.match(/\d+/)
  if (z) return Number(z[0])
  const w = t
    .toLowerCase()
    .match(/[a-zäöü]+/g)
    ?.find((x) => x in ZAHLWOERTER)
  return w ? ZAHLWOERTER[w]! : null
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
    let pruefung: Auswertung['pruefung']
    if (seiten.length === 0 || seiten.every((s) => !s.trim())) {
      pruefung = 'scan'
    } else {
      const seite = seiten[f.seite - 1] ?? ''
      const zitat = vergleichsform(f.zitat)
      pruefung =
        zitat.length > 0 &&
        vergleichsform(seite).includes(zitat) &&
        zitat.includes(vergleichsform(f.wert)) &&
        normiert !== null
          ? 'belegt'
          : 'nicht_belegt'
    }
    out.push({ feld, wert: f.wert, seite: f.seite, zitat: f.zitat, pruefung, normiert })
  }
  return out
}
