import { z } from 'zod'
import { vergleichsform } from './pdf'

/**
 * Eine Angabe aus einem Dokument mit Fundstelle (WP 1.7). Die Citations der API gehen nicht
 * mit strukturierten Ausgaben zusammen; deshalb liefert das Modell Seite und Zitat selbst, und
 * die Software prüft beides am Text des PDFs (`pruefeFundstelle`).
 */
export const Fundstelle = z
  .object({
    wert: z.string().describe('Der Wert genau so, wie er im Dokument steht'),
    seite: z.number().int().describe('Seite im PDF, beginnend bei 1'),
    zitat: z.string().describe('Wörtliches Zitat von dieser Seite, das den Wert enthält'),
  })
  .nullable()
export type Fundstelle = z.infer<typeof Fundstelle>

/** belegt: Zitat steht auf der Seite und enthält den Wert; scan: ohne Textebene, nicht prüfbar */
export type Pruefergebnis = 'belegt' | 'nicht_belegt' | 'scan'

export function pruefeFundstelle(
  f: NonNullable<Fundstelle>,
  seiten: string[],
  normiert: unknown,
): Pruefergebnis {
  if (seiten.length === 0 || seiten.every((s) => !s.trim())) return 'scan'
  const seite = seiten[f.seite - 1] ?? ''
  const zitat = vergleichsform(f.zitat)
  return zitat.length > 0 &&
    vergleichsform(seite).includes(zitat) &&
    zitat.includes(vergleichsform(f.wert)) &&
    normiert !== null
    ? 'belegt'
    : 'nicht_belegt'
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
