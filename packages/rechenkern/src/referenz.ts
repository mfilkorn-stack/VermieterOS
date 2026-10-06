import { cent, type Cent } from './geld'

/**
 * Referenzdaten auswerten (PLAN.md 3.5): welcher Wert gilt am Stichtag, und darf man ihm trauen?
 * Abgelaufene oder überfällige Werte werden nicht still weiterverwendet, sondern als Status gemeldet.
 */

export type ReferenzEintrag<W = unknown> = {
  id: string
  /** null = globaler Wert; sonst Wert des Mandanten, der den globalen überdeckt */
  mandantId: string | null
  wert: W
  gueltigVon: string
  gueltigBis: string | null
  quelle: string
  hinweis?: string | null
  geprueftAm: string
  pruefenBis: string
  erfasstAm: string
}

/**
 * - `gueltig`: Wert gilt am Stichtag und ist geprüft.
 * - `ungeprueft`: Wert gilt, aber die Prüffrist ist abgelaufen.
 * - `abgelaufen`: Für den Stichtag gibt es keinen Wert mehr, nur einen älteren (Mietspiegel ausgelaufen).
 * - `fehlt`: Kein Wert für diesen Schlüssel und Stichtag.
 */
export type ReferenzStatus = 'gueltig' | 'ungeprueft' | 'abgelaufen' | 'fehlt'

export type ReferenzErgebnis<W> = { status: ReferenzStatus; eintrag: ReferenzEintrag<W> | null }

export function referenzwert<W>(
  eintraege: readonly ReferenzEintrag<W>[],
  stichtag: string,
  heute: string,
): ReferenzErgebnis<W> {
  const passend = eintraege
    .filter((e) => e.gueltigVon <= stichtag && (e.gueltigBis === null || e.gueltigBis >= stichtag))
    .sort(vorrang)
  const treffer = passend[0]
  if (treffer)
    return { status: heute > treffer.pruefenBis ? 'ungeprueft' : 'gueltig', eintrag: treffer }

  const frueher = eintraege
    .filter((e) => e.gueltigBis !== null && e.gueltigBis < stichtag)
    .sort((a, b) =>
      b.gueltigBis! < a.gueltigBis! ? -1 : b.gueltigBis! > a.gueltigBis! ? 1 : vorrang(a, b),
    )
  return frueher[0]
    ? { status: 'abgelaufen', eintrag: frueher[0] }
    : { status: 'fehlt', eintrag: null }
}

/** Mandantenwert vor globalem, dann späterer Beginn, dann spätere Erfassung (Korrektur). */
function vorrang(a: ReferenzEintrag<unknown>, b: ReferenzEintrag<unknown>): number {
  if ((a.mandantId === null) !== (b.mandantId === null)) return a.mandantId === null ? 1 : -1
  if (a.gueltigVon !== b.gueltigVon) return a.gueltigVon > b.gueltigVon ? -1 : 1
  return a.erfasstAm > b.erfasstAm ? -1 : a.erfasstAm < b.erfasstAm ? 1 : 0
}

/** Grunderwerbsteuer: Satz auf die Gegenleistung, auf volle Euro abgerundet (§ 11 Abs. 2 GrEStG). */
export function grunderwerbsteuer(gegenleistung: Cent, satzPromille: number): Cent {
  if (!Number.isInteger(satzPromille) || satzPromille < 0)
    throw new RangeError(`ungültiger Satz: ${satzPromille}`)
  // Ganzzahlig rechnen: Cent × Promille ist exakt; volle Euro = Vielfache von 100 Cent.
  return cent(Math.floor((gegenleistung * satzPromille) / 100_000) * 100)
}
