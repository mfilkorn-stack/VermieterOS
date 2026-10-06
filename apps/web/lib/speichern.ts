import 'server-only'
import {
  fachdaten,
  letzteVersion,
  neueVersion,
  type EntitaetName,
  type IdentitaetsDaten,
  type Tx,
  type VersionsDaten,
} from '@vermieteros/db'
import type { Herkunft } from '@vermieteros/schema'
import { Eingabefehler } from './eingabe'
import type { MandantKontext } from './sitzung'

export type SpeicherErgebnis = { identId: string; geschrieben: boolean }

/**
 * Schreibt eine neue Version, wenn sich etwas geändert hat (PLAN.md 2.3).
 *
 * - Ohne Änderung entsteht keine Version.
 * - Neuer Stand mit späterem `gueltigAb` (Umbau, Mieterhöhung): Begründung optional, sonst automatisch.
 * - Gleicher Zeitpunkt, nur leere Felder gefüllt: Ergänzung, Begründung automatisch.
 * - Gleicher Zeitpunkt, vorhandener Wert geändert: Korrektur, Begründung ist Pflicht.
 * - `gueltigAb` darf nicht vor der letzten Version liegen; rückwirkende Korrekturen über
 *   mehrere Stände hinweg kommen später mit eigener Oberfläche.
 */
export async function speichere<E extends EntitaetName>(
  tx: Tx,
  k: MandantKontext,
  p: {
    entitaet: E
    daten: VersionsDaten<E>
    gueltigAb?: string | null
    begruendung?: string | null
  } & ({ identId: string } | { identitaet: IdentitaetsDaten<E> }),
): Promise<SpeicherErgebnis> {
  const akteur = { art: 'nutzer' as const, id: k.nutzerId }

  if (!('identId' in p)) {
    if (!p.gueltigAb) throw new Eingabefehler('Gültig-ab-Datum fehlt.')
    const r = await neueVersion(tx, {
      entitaet: p.entitaet,
      mandantId: k.mandantId,
      akteur,
      gueltigAb: p.gueltigAb,
      identitaet: p.identitaet,
      herkunft: herkunftFuer(Object.keys(sauber(p.daten))),
      daten: p.daten,
    } as Parameters<typeof neueVersion<E>>[1])
    return { identId: r.identId, geschrieben: true }
  }

  const letzte = await letzteVersion(tx, p.entitaet, p.identId)
  if (!letzte) throw new Eingabefehler('Datensatz nicht gefunden.')
  const alt = fachdaten(p.entitaet, letzte as Record<string, unknown>) as Record<string, unknown>
  const neu = p.daten as Record<string, unknown>

  const geaendert = Object.keys(neu).filter((f) => gleich(neu[f], alt[f]) === false)
  const gueltigAb = p.gueltigAb || (letzte as { gueltigAb: string }).gueltigAb
  const letztesAb = (letzte as { gueltigAb: string }).gueltigAb
  if (geaendert.length === 0) return { identId: p.identId, geschrieben: false }
  if (gueltigAb < letztesAb) {
    throw new Eingabefehler(
      `„Gilt ab“ liegt vor dem letzten Stand (${letztesAb}). Rückwirkende Korrekturen über mehrere Stände sind noch nicht möglich.`,
    )
  }

  let begruendung = p.begruendung?.trim() || null
  if (gueltigAb > letztesAb) {
    begruendung ??= `Änderung ab ${gueltigAb}: ${geaendert.join(', ')}`
  } else {
    const korrigiert = geaendert.filter((f) => !leer(alt[f]))
    if (korrigiert.length > 0 && !begruendung) {
      throw new Eingabefehler(`Bitte begründen, warum sich ${korrigiert.join(', ')} ändert.`)
    }
    begruendung ??= `Ergänzt: ${geaendert.join(', ')}`
  }

  await neueVersion(tx, {
    entitaet: p.entitaet,
    mandantId: k.mandantId,
    akteur,
    gueltigAb,
    identId: p.identId,
    begruendung,
    herkunft: herkunftFuer(geaendert),
    daten: { ...alt, ...neu } as VersionsDaten<E>,
  } as Parameters<typeof neueVersion<E>>[1])
  return { identId: p.identId, geschrieben: true }
}

function herkunftFuer(felder: string[]): Herkunft {
  return Object.fromEntries(felder.map((f) => [f, { quelle: 'manuell' as const }]))
}

function sauber(d: unknown): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(d as Record<string, unknown>).filter(([, v]) => !leer(v)),
  )
}

/** Leer im Sinne von „noch nicht erfasst“: auch `false` (Voreinstellung eines Häkchens). */
function leer(v: unknown): boolean {
  return v === null || v === undefined || v === false || (Array.isArray(v) && v.length === 0)
}

/** Vergleich unabhängig von Schlüsselreihenfolge (jsonb sortiert um) und null/undefined. */
function gleich(a: unknown, b: unknown): boolean {
  return kanonisch(a) === kanonisch(b)
}

function kanonisch(v: unknown): string {
  return JSON.stringify(v ?? null, (_, x: unknown) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(
          Object.entries(x as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
        )
      : (x ?? null),
  )
}
