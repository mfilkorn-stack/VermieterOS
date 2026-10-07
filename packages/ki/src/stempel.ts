import {
  aenderungenSeit,
  gueltigeDokumentHashes,
  ledgerStand,
  type Referenz,
  type Tx,
} from '@vermieteros/db'
import { z } from 'zod'

/** Versionsstempel (PLAN 4.1): worauf ein Vorschlag beruht. */
export const Versionsstempel = z.object({
  mandantId: z.string(),
  /** Höchste Ledger-Sequenz zum Zeitpunkt des Lesens */
  ledgerSeq: z.number().int().nonnegative(),
  referenzen: z.array(z.object({ entitaet: z.string(), id: z.string() })),
  dokumentHashes: z.record(z.string(), z.string()),
  promptVersion: z.string(),
  modell: z.string(),
  erzeugtAm: z.string(),
})
export type Versionsstempel = z.infer<typeof Versionsstempel>

/** Stempel im selben Lesevorgang wie der Kontext erzeugen, damit beide zum selben Stand gehören. */
export async function erstelleStempel(
  tx: Tx,
  p: {
    mandantId: string
    referenzen: Referenz[]
    dokumentIds: string[]
    promptVersion: string
    modell: string
  },
): Promise<Versionsstempel> {
  const dokumentHashes = await gueltigeDokumentHashes(tx, p.dokumentIds)
  const fehlend = p.dokumentIds.filter((id) => !(id in dokumentHashes))
  if (fehlend.length) {
    throw new Error(`Dokumente nicht gültig oder nicht vorhanden: ${fehlend.join(', ')}`)
  }
  return {
    mandantId: p.mandantId,
    ledgerSeq: await ledgerStand(tx),
    referenzen: p.referenzen,
    dokumentHashes,
    promptVersion: p.promptVersion,
    modell: p.modell,
    erzeugtAm: new Date().toISOString(),
  }
}

export type StempelPruefung = { aktuell: true } | { aktuell: false; gruende: string[] }

/**
 * Prüft, ob sich seit dem Stempel etwas geändert hat, worauf der Vorschlag beruht (PLAN 4.2):
 * ein Ledger-Ereignis zu einer referenzierten Entität oder ein Dokument, das nicht mehr gültig ist.
 */
export async function pruefeStempel(tx: Tx, s: Versionsstempel): Promise<StempelPruefung> {
  const gruende: string[] = []
  for (const a of await aenderungenSeit(tx, s.ledgerSeq, s.referenzen)) {
    gruende.push(`${a.entitaet} ${a.id}: ${a.typ} (seq ${a.seq})`)
  }
  const ids = Object.keys(s.dokumentHashes)
  const jetzt = await gueltigeDokumentHashes(tx, ids)
  for (const id of ids) {
    if (jetzt[id] !== s.dokumentHashes[id]) gruende.push(`dokument ${id}: nicht mehr gültig`)
  }
  return gruende.length ? { aktuell: false, gruende } : { aktuell: true }
}
