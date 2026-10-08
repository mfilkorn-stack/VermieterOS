import { GRUNDBUCH_ARTEN, GrundbuchEintrag, type Bruch } from '@vermieteros/schema'
import { z } from 'zod'
import type { Aufgabe } from '../aufgabe'
import type { DokumentKontextDaten } from '../kontext/dokument'
import { centAus, datumAus, Fundstelle, pruefeFundstelle, type Pruefergebnis } from '../fundstelle'

const FlurstueckAuszug = z.object({
  nummer: Fundstelle.describe('Gemarkung, Flur und Flurstück, wie im Vertrag geschrieben'),
  flaeche: Fundstelle.describe('Größe des Flurstücks, z. B. "464 m²"'),
})

const GrundbuchAuszug = z.object({
  art: z.enum(GRUNDBUCH_ARTEN),
  amtsgericht: Fundstelle,
  blatt: Fundstelle,
  miteigentumsanteil: Fundstelle.describe(
    'Nur bei Wohnungs- oder Teileigentum: der Bruchteil, z. B. "88,89/1.000"',
  ),
  flurstuecke: z.array(FlurstueckAuszug),
})

export const KaufvertragAuszug = z.object({
  kaufvertrag_datum: Fundstelle.describe('Tag der Beurkundung'),
  uebergang_nutzen_lasten: Fundstelle.describe(
    'Nur wenn der Vertrag dafür ein festes Datum nennt; sonst null und Hinweis',
  ),
  kaufpreis: Fundstelle.describe('Gesamtkaufpreis'),
  anteil_grund_boden: Fundstelle.describe(
    'Nur wenn der Vertrag den Kaufpreis ausdrücklich aufteilt: Betrag für Grund und Boden',
  ),
  grundbuch: z.array(GrundbuchAuszug).describe('Ein Eintrag je Grundbuchblatt'),
  hinweise: z.array(z.string()),
})
export type KaufvertragAuszug = z.infer<typeof KaufvertragAuszug>

export const KAUFVERTRAG_FELDER = [
  'kaufvertrag_datum',
  'uebergang_nutzen_lasten',
  'kaufpreis',
  'anteil_grund_boden',
] as const
export type KaufvertragFeld = (typeof KAUFVERTRAG_FELDER)[number]

/**
 * Liest Eckdaten aus einem notariellen Kaufvertrag: Daten für Spekulationsfrist und AfA,
 * Kaufpreis, eine ausdrückliche Aufteilung auf Grund und Boden und die Grundbuchangaben.
 * Wie beim Mietvertrag trägt jede Angabe Seite und Zitat, die die Software am PDF prüft.
 * Namen von Verkäufern und Käufern werden bewusst nicht ausgelesen.
 */
export const KAUFVERTRAG_EXTRAKTION: Aufgabe<DokumentKontextDaten, KaufvertragAuszug> = {
  name: 'kaufvertrag_extraktion',
  version: 1,
  maxTokens: 8_000,
  aufwand: 'high',
  ablaufTage: 30,
  goldenSchwelle: 0.95,
  system: [
    'Du liest notarielle Immobilienkaufverträge für private Vermieter und gibst Eckdaten strukturiert zurück.',
    'Der Vertrag liegt als PDF bei. Für jede Angabe:',
    '- wert: genau so, wie er im Vertrag steht (z. B. "187.000,00 €", "30.04.2021", "88,89/1.000").',
    '- seite: die Seite im PDF, auf der er steht (erste Seite = 1).',
    '- zitat: ein kurzes wörtliches Zitat von genau dieser Seite, das den Wert enthält, ohne Auslassungen.',
    'Steht eine Angabe nicht im Vertrag oder ist sie unklar, gib null zurück. Rechne nichts aus und ergänze nichts.',
    'kaufvertrag_datum ist der Tag der Beurkundung, nicht der Tag einer Genehmigung oder Eintragung.',
    'uebergang_nutzen_lasten nur, wenn ein festes Datum genannt ist. Hängt der Übergang an einer Bedingung (z. B. Zahlung des Kaufpreises), gib null zurück und nenne die Bedingung als Hinweis.',
    'kaufpreis ist der Gesamtkaufpreis. anteil_grund_boden nur, wenn der Vertrag den Kaufpreis ausdrücklich aufteilt; nicht schätzen.',
    'grundbuch: ein Eintrag je Grundbuchblatt (z. B. Wohnung und separat gekaufter Stellplatz). art: wohnungsgrundbuch, teileigentumsgrundbuch oder grundbuch. amtsgericht nur der Ort. Je Flurstück die Bezeichnung und die Größe.',
    'Namen von Verkäufern, Käufern oder Notaren nicht ausgeben.',
    'Hinweise: mitverkauftes Inventar mit Betrag, Ratenzahlung, Rücktrittsrechte, Wohnrechte oder Belastungen, die bleiben, vermietete Einheiten, handschriftliche Änderungen.',
  ].join('\n'),
  nachricht: (d) =>
    JSON.stringify(
      { dokument: { titel: d.titel, dateiname: d.dateiname, seiten: d.seiten.length || null } },
      null,
      2,
    ),
  dateien: (d) => [{ mime: d.mime, daten: d.datei }],
  ausgabe: KaufvertragAuszug,
}

/** „88,89/1.000“ → 8889/100000; „125/10.000“ → 125/10000. Gekürzt wird nicht. */
export function bruchAus(t: string): Bruch | null {
  const m = t.match(/(\d[\d.]*(?:,\d+)?)\s*\/\s*(\d[\d.]*(?:,\d+)?)/)
  if (!m) return null
  const zahl = (s: string) => s.replace(/\./g, '')
  const [z, n] = [zahl(m[1]!), zahl(m[2]!)]
  const stellen = Math.max(z.split(',')[1]?.length ?? 0, n.split(',')[1]?.length ?? 0)
  const ganz = (s: string) => {
    const [vor, nach = ''] = s.split(',')
    return Number(vor + nach.padEnd(stellen, '0'))
  }
  const zaehler = ganz(z)
  const nenner = ganz(n)
  if (!Number.isSafeInteger(zaehler) || !nenner || zaehler > nenner) return null
  return { zaehler, nenner }
}

/** „464 m²“, „464 qm“ → 464; Nachkommastellen werden gerundet. */
export function flaecheAus(t: string): number | null {
  const m = t.match(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?\s*(?:m²|m2|qm)/i)
  if (!m) return null
  const qm = Math.round(Number(`${m[1]!.replace(/\./g, '')}.${m[2] ?? '0'}`))
  return qm > 0 ? qm : null
}

/** „Amtsgericht Musterstadt“ → „Musterstadt“ (so erfasst die Objektakte das Amtsgericht). */
function amtsgerichtAus(t: string): string | null {
  const ort = t.replace(/^\s*Amtsgericht(es)?\s+/i, '').trim()
  return ort || null
}

/** „Blatt W-1“, „Blatt Nr. 1234“ → „W-1“, „1234“. */
function blattAus(t: string): string | null {
  const b = t.replace(/^\s*Blatt\s*(Nr\.?\s*)?/i, '').trim()
  return b && b.length <= 50 ? b : null
}

export type KaufvertragAuswertung = {
  feld: KaufvertragFeld
  wert: string
  seite: number
  zitat: string
  pruefung: Pruefergebnis
  /** Cent oder ISO-Datum; null, wenn der Wert nicht lesbar ist */
  normiert: number | string | null
}

export type GrundbuchAuswertung = {
  index: number
  /** belegt nur, wenn jede einzelne Fundstelle des Blatts belegt ist */
  pruefung: Pruefergebnis
  /** Fertiger Eintrag für die Objektakte; null, wenn etwas fehlt oder nicht lesbar ist */
  eintrag: GrundbuchEintrag | null
  fundstellen: Array<{ name: string; wert: string; seite: number; pruefung: Pruefergebnis }>
}

function schlechteste(p: Pruefergebnis[]): Pruefergebnis {
  if (p.includes('nicht_belegt')) return 'nicht_belegt'
  if (p.includes('scan')) return 'scan'
  return 'belegt'
}

/**
 * Prüft jede Fundstelle am Seitentext (wie `werteMietvertragAus`). Ein Grundbuchblatt ist nur
 * übernehmbar, wenn alle seine Angaben belegt und lesbar sind.
 */
export function werteKaufvertragAus(
  a: KaufvertragAuszug,
  seiten: string[],
): { felder: KaufvertragAuswertung[]; grundbuch: GrundbuchAuswertung[] } {
  const felder: KaufvertragAuswertung[] = []
  for (const feld of KAUFVERTRAG_FELDER) {
    const f = a[feld]
    if (!f) continue
    const normiert =
      feld.endsWith('datum') || feld === 'uebergang_nutzen_lasten'
        ? datumAus(f.wert)
        : centAus(f.wert)
    felder.push({
      feld,
      wert: f.wert,
      seite: f.seite,
      zitat: f.zitat,
      pruefung: pruefeFundstelle(f, seiten, normiert),
      normiert,
    })
  }

  const grundbuch = a.grundbuch.map((g, index): GrundbuchAuswertung => {
    const fundstellen: GrundbuchAuswertung['fundstellen'] = []
    const pruefe = <T>(name: string, f: Fundstelle, lies: (t: string) => T | null): T | null => {
      if (!f) return null
      const wert = lies(f.wert)
      fundstellen.push({
        name,
        wert: f.wert,
        seite: f.seite,
        pruefung: pruefeFundstelle(f, seiten, wert),
      })
      return wert
    }
    const amtsgericht = pruefe('Amtsgericht', g.amtsgericht, amtsgerichtAus)
    const blatt = pruefe('Blatt', g.blatt, blattAus)
    const miteigentumsanteil = pruefe('Miteigentumsanteil', g.miteigentumsanteil, bruchAus)
    const flurstuecke = g.flurstuecke.map((f, i) => ({
      nummer: pruefe(`Flurstück ${i + 1}`, f.nummer, (t) => t.trim() || null),
      flaecheQm: pruefe(`Fläche ${i + 1}`, f.flaeche, flaecheAus),
    }))
    const kandidat = GrundbuchEintrag.safeParse({
      art: g.art,
      amtsgericht,
      blatt,
      miteigentumsanteil,
      flurstuecke,
    })
    const vollstaendig =
      amtsgericht !== null &&
      blatt !== null &&
      flurstuecke.length > 0 &&
      flurstuecke.every((f) => f.nummer !== null && f.flaecheQm !== null) &&
      (g.art === 'grundbuch' || miteigentumsanteil !== null)
    return {
      index,
      pruefung: fundstellen.length
        ? schlechteste(fundstellen.map((f) => f.pruefung))
        : 'nicht_belegt',
      eintrag: vollstaendig && kandidat.success ? kandidat.data : null,
      fundstellen,
    }
  })
  return { felder, grundbuch }
}

/**
 * Gebäudeanteil in Promille aus einer ausdrücklichen Aufteilung im Vertrag:
 * (Kaufpreis − Grund und Boden) / Kaufpreis.
 */
export function gebaeudeanteilAus(kaufpreisCent: number, bodenCent: number): number | null {
  if (kaufpreisCent <= 0 || bodenCent < 0 || bodenCent > kaufpreisCent) return null
  return Math.round(((kaufpreisCent - bodenCent) * 1000) / kaufpreisCent)
}
