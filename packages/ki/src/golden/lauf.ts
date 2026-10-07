import { z } from 'zod'
import type { Aufgabe } from '../aufgabe'
import type { KiClient } from '../client'
import { pruefeEntwurf, type PlatzhalterKatalog } from '../platzhalter'

/** Ein Golden-Set-Fall: geschwärzter Kontext und die erwarteten Werte der Ausgabe. */
export const GoldenFall = z.object({
  beschreibung: z.string(),
  /** true für ausgedachte Fälle; echte, geschwärzte Fälle haben Vorrang */
  synthetisch: z.boolean().default(false),
  daten: z.unknown(),
  platzhalter: z.record(z.string(), z.string()).default({}),
  /** Felder der Ausgabe, die genau so stimmen müssen (Teilmenge, rekursiv) */
  erwartet: z.record(z.string(), z.unknown()).default({}),
})
export type GoldenFall = z.infer<typeof GoldenFall>

export type FallErgebnis = { name: string; bestanden: boolean; befunde: string[] }
export type LaufErgebnis = {
  aufgabe: string
  gesamt: number
  bestanden: number
  quote: number
  schwelle: number
  ok: boolean
  faelle: FallErgebnis[]
}

/** Teilmengen-Vergleich: jedes erwartete Feld muss in der Ausgabe denselben Wert haben. */
function abweichungen(erwartet: unknown, ist: unknown, pfad = ''): string[] {
  if (erwartet !== null && typeof erwartet === 'object' && !Array.isArray(erwartet)) {
    if (ist === null || typeof ist !== 'object') return [`${pfad || 'Ausgabe'}: kein Objekt`]
    return Object.entries(erwartet).flatMap(([k, v]) =>
      abweichungen(v, (ist as Record<string, unknown>)[k], pfad ? `${pfad}.${k}` : k),
    )
  }
  return JSON.stringify(erwartet) === JSON.stringify(ist)
    ? []
    : [`${pfad}: erwartet ${JSON.stringify(erwartet)}, erhalten ${JSON.stringify(ist)}`]
}

/**
 * Lässt eine Aufgabe über ihre Golden-Set-Fälle laufen (PLAN 4.5). Pflicht-Prüfungen:
 * Ausgabe passt zum Schema, Entwürfe ohne Zahlen und nur mit bekannten Platzhaltern,
 * erwartete Felder stimmen.
 */
export async function laufeGoldenSet<D, A>(
  aufgabe: Aufgabe<D, A>,
  faelle: Array<{ name: string; fall: GoldenFall }>,
  client: KiClient,
  modell: string,
): Promise<LaufErgebnis> {
  const ergebnisse: FallErgebnis[] = []
  for (const { name, fall } of faelle) {
    const befunde: string[] = []
    try {
      const katalog: PlatzhalterKatalog = fall.platzhalter
      const r = await client.erzeuge({
        modell,
        system: aufgabe.system,
        nachricht: aufgabe.nachricht(fall.daten as D, katalog),
        schema: aufgabe.ausgabe,
        maxTokens: aufgabe.maxTokens ?? 16_000,
      })
      const a = aufgabe.ausgabe.safeParse(r.ausgabe)
      if (!a.success) {
        befunde.push(`Schema: ${a.error.message}`)
      } else {
        for (const t of aufgabe.entwuerfe?.(a.data) ?? []) {
          for (const b of pruefeEntwurf(t, katalog)) {
            befunde.push(
              b.art === 'zahl'
                ? `Zahl im Entwurf: „${b.auszug}“`
                : `Platzhalter unbekannt: ${b.schluessel}`,
            )
          }
        }
        befunde.push(...abweichungen(fall.erwartet, a.data))
      }
    } catch (e) {
      befunde.push(`Aufruf: ${e instanceof Error ? e.message : String(e)}`)
    }
    ergebnisse.push({ name, bestanden: befunde.length === 0, befunde })
  }
  const bestanden = ergebnisse.filter((e) => e.bestanden).length
  const quote = ergebnisse.length ? bestanden / ergebnisse.length : 1
  const schwelle = aufgabe.goldenSchwelle ?? 1
  return {
    aufgabe: `${aufgabe.name}@${aufgabe.version}`,
    gesamt: ergebnisse.length,
    bestanden,
    quote,
    schwelle,
    ok: quote >= schwelle,
    faelle: ergebnisse,
  }
}
