/**
 * Fakten setzt der Code ein (PLAN 4.3, ADR 0005). Entwürfe enthalten `{{schluessel}}`,
 * der Renderer füllt sie zum Zeitpunkt des Versands aus dem Ledger.
 */

const PLATZHALTER = /\{\{\s*([a-z0-9_]+(?:\.[a-z0-9_]+)*)\s*\}\}/g

/** Schlüssel → Beschreibung für das Modell, z. B. `mieter.name` → „Name der Mieterin“. */
export type PlatzhalterKatalog = Record<string, string>
/** Schlüssel → Wert aus dem Ledger, zum Zeitpunkt des Renderns gelesen. */
export type Fakten = Record<string, string | null>

export function platzhalterIn(text: string): string[] {
  return [...new Set([...text.matchAll(PLATZHALTER)].map((m) => m[1]!))]
}

export type EntwurfBefund =
  { art: 'zahl'; auszug: string } | { art: 'unbekannter_platzhalter'; schluessel: string }

/**
 * Prüft einen Entwurf: keine Ziffer außerhalb von Platzhaltern (Beträge, Daten, Telefonnummern
 * gehören in Platzhalter) und nur Platzhalter aus dem Katalog.
 */
export function pruefeEntwurf(text: string, katalog: PlatzhalterKatalog): EntwurfBefund[] {
  const befunde: EntwurfBefund[] = []
  for (const s of platzhalterIn(text)) {
    if (!(s in katalog)) befunde.push({ art: 'unbekannter_platzhalter', schluessel: s })
  }
  const ohne = text.replace(PLATZHALTER, ' ')
  for (const m of ohne.matchAll(/[^\s]*\d[^\s]*/g)) {
    befunde.push({ art: 'zahl', auszug: m[0] })
  }
  return befunde
}

export class RenderFehler extends Error {
  constructor(readonly fehlend: string[]) {
    super(`Für diese Platzhalter fehlt ein Wert: ${fehlend.join(', ')}`)
    this.name = 'RenderFehler'
  }
}

/** Setzt die Fakten ein. Fehlt ein Wert, wird nicht geraten, sondern abgebrochen. */
export function rendere(text: string, fakten: Fakten): string {
  const fehlend = platzhalterIn(text).filter((s) => fakten[s] == null || fakten[s] === '')
  if (fehlend.length) throw new RenderFehler(fehlend)
  return text.replace(PLATZHALTER, (_, s: string) => fakten[s]!)
}
