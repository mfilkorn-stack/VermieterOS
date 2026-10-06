import { formatEuro, type Cent } from '@vermieteros/rechenkern'

export function euroText(cent: number | null | undefined): string {
  return cent == null ? '' : formatEuro(cent as Cent, false)
}

export function euroAnzeige(cent: number | null | undefined): string {
  return cent == null ? '–' : formatEuro(cent as Cent)
}

/** Ganzzahl mit `stellen` Nachkommastellen als deutscher Text: 7250, 2 → „72,50“. */
export function dezimalText(wert: number | null | undefined, stellen: number): string {
  if (wert == null) return ''
  return (wert / 10 ** stellen).toLocaleString('de-DE', {
    minimumFractionDigits: stellen,
    maximumFractionDigits: stellen,
    useGrouping: false,
  })
}

export function prozentText(promille: number | null | undefined): string {
  return promille == null ? '' : dezimalText(promille, 1)
}

export function datumAnzeige(iso: string | null | undefined): string {
  if (!iso) return '–'
  const [j, m, t] = iso.slice(0, 10).split('-')
  return `${t}.${m}.${j}`
}

/**
 * Bruch zur Anzeige als Zähler und Nenner, bevorzugt auf 1000 (üblich bei MEA):
 * 8889/100000 → „88,89“ / „1000“; 1/2 → „1“ / „2“.
 */
export function bruchText(
  b: { zaehler: number; nenner: number } | null | undefined,
): [string, string] {
  if (!b) return ['', '']
  for (const ziel of [1000, 10000, 100]) {
    if (b.nenner % ziel !== 0) continue
    const faktor = b.nenner / ziel
    const d = Math.log10(faktor)
    if (Number.isInteger(d) && d > 0) return [dezimalText(b.zaehler, d), String(ziel)]
  }
  return [String(b.zaehler), String(b.nenner)]
}
