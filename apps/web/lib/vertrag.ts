import 'server-only'
import { ladeDokument, letzteVersion, type Tx } from '@vermieteros/db'
import { seitenTexte } from '@vermieteros/ki'
import { sql } from 'drizzle-orm'
import { objektSpeicher } from './speicher'

/** Seitentexte eines PDF-Dokuments aus dem Object Storage, für die Prüfung der Fundstellen. */
export async function dokumentSeiten(tx: Tx, dokumentId: string): Promise<string[]> {
  const d = await ladeDokument(tx, dokumentId)
  if (!d || d.mime !== 'application/pdf') return []
  return seitenTexte(new Uint8Array(await objektSpeicher().holen(d.speicherSchluessel)))
}

/** Aktuelle Angaben eines Mietverhältnisses zum Vergleich mit dem Vertrag. */
export async function aktuelleVertragsdaten(tx: Tx, mietverhaeltnisId: string) {
  const mv = await letzteVersion(tx, 'mietverhaeltnis', mietverhaeltnisId)
  const [k] = await tx.execute<{ id: string }>(
    sql`SELECT id FROM mietkonditionen WHERE mietverhaeltnis_id = ${mietverhaeltnisId} ORDER BY erstellt_am LIMIT 1`,
  )
  const kondition = k ? await letzteVersion(tx, 'mietkondition', k.id) : null
  return { mv, konditionId: k?.id ?? null, kondition }
}
