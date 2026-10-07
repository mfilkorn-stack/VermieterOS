import { z } from 'zod'
import type { Aufgabe } from '../aufgabe'
import type { NachrichtDaten } from '../kontext/nachricht'

export const KATEGORIEN = [
  'schaden',
  'heizung_wasser',
  'nebenkosten',
  'miete_zahlung',
  'vertrag_kuendigung',
  'schluessel_zugang',
  'nachbarn_hausordnung',
  'handwerker_termin',
  'behoerde_verwaltung',
  'sonstiges',
] as const
export type Kategorie = (typeof KATEGORIEN)[number]

export const KATEGORIE_TEXT: Record<Kategorie, string> = {
  schaden: 'Schaden oder Mangel',
  heizung_wasser: 'Heizung oder Wasser',
  nebenkosten: 'Nebenkosten',
  miete_zahlung: 'Miete und Zahlung',
  vertrag_kuendigung: 'Vertrag oder Kündigung',
  schluessel_zugang: 'Schlüssel und Zugang',
  nachbarn_hausordnung: 'Nachbarn und Hausordnung',
  handwerker_termin: 'Handwerker und Termine',
  behoerde_verwaltung: 'Behörde oder Hausverwaltung',
  sonstiges: 'Sonstiges',
}

export const DRINGLICHKEITEN = ['notfall', 'hoch', 'normal', 'niedrig'] as const
export type Dringlichkeit = (typeof DRINGLICHKEITEN)[number]

export const Sortierung = z.object({
  kategorie: z.enum(KATEGORIEN),
  dringlichkeit: z.enum(DRINGLICHKEITEN),
  /** Nur eine Frist, die in der Mail steht, mit wörtlichem Beleg */
  frist: z
    .object({
      datum: z.string().describe('Datum im Format JJJJ-MM-TT'),
      beleg: z.string().describe('Wörtliches Zitat aus der Mail, aus dem die Frist hervorgeht'),
    })
    .nullable(),
  zusammenfassung: z.string().describe('Ein Satz: worum es geht'),
  begruendung: z.string().describe('Kurz: warum diese Kategorie und Dringlichkeit'),
})
export type Sortierung = z.infer<typeof Sortierung>

const ISO_DATUM = /^\d{4}-\d{2}-\d{2}$/

function normalisiert(t: string): string {
  return t.replace(/\s+/g, ' ').trim().toLowerCase()
}

/**
 * Sortiert eine eingegangene Mail: Kategorie, Dringlichkeit, Frist (PLAN 6, WP 1.5).
 * Läuft automatisch im Worker. Die Frist muss wörtlich belegt sein, sonst wird verworfen.
 */
export const SORTIERUNG: Aufgabe<NachrichtDaten, Sortierung> = {
  name: 'sortierung',
  version: 1,
  maxTokens: 4_000,
  aufwand: 'low',
  // Kategorie und Dringlichkeit sind Ermessen; einzelne Abweichungen im Golden-Set sind zulässig.
  goldenSchwelle: 0.9,
  // Einschätzungen veralten schneller als Entwürfe: nach einer Woche neu sortieren lassen.
  ablaufTage: 7,
  system: [
    'Du hilfst privaten Vermietern, ihren Posteingang zu sortieren.',
    'Du erhältst eine eingegangene E-Mail als JSON (Betreff, Text, Absender, Eingangszeit, Anhänge, Zuordnung zu Wohnung und Objekt, falls bekannt).',
    '',
    'Bestimme:',
    '1. kategorie: die passendste aus der vorgegebenen Liste.',
    '   - schaden: Mängel an Wohnung oder Gebäude (Feuchtigkeit, Schimmel, defekte Fenster, Türen, Geräte), außer Heizung und Wasser.',
    '   - heizung_wasser: Heizung, Warmwasser, Wasserrohre, Abfluss, Wasserschaden.',
    '   - nebenkosten: Betriebskostenabrechnung, Vorauszahlungen, Zählerstände.',
    '   - miete_zahlung: Mietzahlung, Rückstand, Kaution, Kontoverbindung, Mieterhöhung.',
    '   - vertrag_kuendigung: Kündigung, Vertragsänderung, Untervermietung, Auszug, Übergabe.',
    '   - schluessel_zugang: Schlüssel, Schließanlage, ausgesperrt, Zugang für Dritte.',
    '   - nachbarn_hausordnung: Lärm, Streit, Müll, Treppenhaus, Hausordnung.',
    '   - handwerker_termin: Terminabsprachen mit Handwerkern oder Dienstleistern, Angebote, Rechnungen von Handwerkern.',
    '   - behoerde_verwaltung: Behörden, Hausverwaltung, WEG, Versicherung, Grundsteuer.',
    '   - sonstiges: alles andere, auch Werbung.',
    '2. dringlichkeit:',
    '   - notfall: Gefahr für Personen oder Gebäude oder Folgeschäden jetzt (Wasser läuft aus, Gasgeruch, Heizungsausfall bei Kälte, Einbruch, ausgesperrt).',
    '   - hoch: innerhalb weniger Tage handeln (Heizung eingeschränkt, Fristen in Kürze, Kündigung, Zahlungsprobleme).',
    '   - normal: übliche Anliegen.',
    '   - niedrig: Information ohne Handlungsbedarf, Werbung.',
    '3. frist: nur wenn die Mail selbst eine Frist oder einen Termin nennt, bis zu dem der Vermieter reagieren soll. Rechne relative Angaben ("bis Freitag", "innerhalb von zwei Wochen") vom Eingangsdatum aus in ein Datum um. Das Feld beleg ist ein wörtliches Zitat aus Betreff oder Text, aus dem die Frist hervorgeht. Gibt es keine solche Angabe, ist frist null. Erfinde keine Fristen, auch keine gesetzlichen.',
    '4. zusammenfassung: ein sachlicher Satz auf Deutsch.',
    '5. begruendung: ein kurzer Satz, warum Kategorie und Dringlichkeit.',
    '',
    'Bewerte nur, was in der Mail steht. Gib keine rechtliche Einschätzung ab.',
  ].join('\n'),
  // Für die Sortierung genügt die Mail; die Wissensbasis kostet hier nur Tokens.
  nachricht: ({ wissen: _, ...mail }) => JSON.stringify({ mail }, null, 2),
  ausgabe: Sortierung,
  pruefe: (a, d) => {
    if (!a.frist) return []
    const befunde: string[] = []
    if (!ISO_DATUM.test(a.frist.datum) || Number.isNaN(Date.parse(a.frist.datum))) {
      befunde.push(`Frist ist kein Datum: ${a.frist.datum}`)
    }
    const quelle = normalisiert(`${d.betreff}\n${d.text}`)
    if (!a.frist.beleg.trim() || !quelle.includes(normalisiert(a.frist.beleg))) {
      befunde.push('Beleg der Frist steht nicht wörtlich in der Mail')
    }
    return befunde
  },
}
