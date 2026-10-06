import { parseDezimal, parseEuro } from '@vermieteros/rechenkern'
import type { ZodError } from 'zod'

/** Fehler in einer Formulareingabe; die Meldung geht unverändert an die Oberfläche. */
export class Eingabefehler extends Error {}

function roh(daten: FormData, name: string): string {
  const v = daten.get(name)
  return typeof v === 'string' ? v.trim() : ''
}

export function text(daten: FormData, name: string): string | null {
  return roh(daten, name) || null
}

export function pflicht(daten: FormData, name: string, label: string): string {
  const v = roh(daten, name)
  if (!v) throw new Eingabefehler(`${label} fehlt.`)
  return v
}

export function euro(daten: FormData, name: string, label: string): number | null {
  const v = roh(daten, name)
  if (!v) return null
  try {
    return parseEuro(v)
  } catch {
    throw new Eingabefehler(`${label}: „${v}“ ist kein Betrag (z. B. 1.234,56).`)
  }
}

export function dezimal(
  daten: FormData,
  name: string,
  label: string,
  stellen: number,
): number | null {
  const v = roh(daten, name)
  if (!v) return null
  try {
    return parseDezimal(v, stellen)
  } catch {
    throw new Eingabefehler(
      `${label}: „${v}“ ist keine Zahl mit höchstens ${stellen} Nachkommastellen.`,
    )
  }
}

export function ganz(daten: FormData, name: string, label: string): number | null {
  return dezimal(daten, name, label, 0)
}

export function datum(daten: FormData, name: string, label: string): string | null {
  const v = roh(daten, name)
  if (!v) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Eingabefehler(`${label}: kein gültiges Datum.`)
  return v
}

export function haken(daten: FormData, name: string): boolean {
  return daten.get(name) === 'on'
}

export function json<T>(daten: FormData, name: string): T | null {
  const v = roh(daten, name)
  if (!v) return null
  try {
    return JSON.parse(v) as T
  } catch {
    throw new Eingabefehler(`${name}: Daten nicht lesbar.`)
  }
}

/**
 * Bruch aus zwei Eingaben, Dezimalstellen im Zähler werden in ganze Zahlen umgerechnet:
 * „88,89“ / „1000“ → 8889 / 100000.
 */
export function bruch(
  zaehlerText: string | null,
  nennerText: string | null,
  label: string,
): { zaehler: number; nenner: number } | null {
  if (!zaehlerText && !nennerText) return null
  if (!zaehlerText || !nennerText) throw new Eingabefehler(`${label}: Zähler und Nenner angeben.`)
  const stellen = (s: string) => s.match(/,(\d+)$/)?.[1]?.length ?? 0
  const d = Math.max(stellen(zaehlerText), stellen(nennerText))
  try {
    const zaehler = parseDezimal(zaehlerText, d)
    const nenner = parseDezimal(nennerText, d)
    if (nenner <= 0 || zaehler < 0 || zaehler > nenner) throw new Error()
    return { zaehler, nenner }
  } catch {
    throw new Eingabefehler(`${label}: „${zaehlerText}/${nennerText}“ ist kein gültiger Anteil.`)
  }
}

/** Zod-Fehler als ein Satz pro Feld. */
export function zodText(e: ZodError, labels: Record<string, string> = {}): string {
  return e.issues
    .map((i) => {
      const feld = String(i.path[0] ?? '')
      return `${labels[feld] ?? feld}: ${i.message}`
    })
    .join(' · ')
}
