import type { DokumentStatus, DokumentTyp } from '@vermieteros/schema'
import { sql } from 'drizzle-orm'
import type { Tx } from './client'

/**
 * Dokumente am Objekt oder Mietverhältnis (WP 1.7). Die Datei ist Teil der Identität
 * (Prüfsumme, Schlüssel im Object Storage), versioniert werden Status und Einordnung.
 */
export type DokumentZeile = {
  id: string
  objektId: string | null
  mietverhaeltnisId: string | null
  dateiHash: string
  speicherSchluessel: string
  dateiname: string
  mime: string
  groesseBytes: number
  typ: DokumentTyp
  status: DokumentStatus
  titel: string
  dokumentdatum: string | null
  gueltigBis: string | null
  ersetztDurch: string | null
  notizen: string | null
  gueltigAb: string
  erstelltAm: string
}

const SELECT = sql`
  SELECT d.id, d.objekt_id AS "objektId", d.mietverhaeltnis_id AS "mietverhaeltnisId",
         d.datei_hash AS "dateiHash", d.speicher_schluessel AS "speicherSchluessel",
         d.dateiname, d.mime, d.groesse_bytes::int AS "groesseBytes",
         a.typ, a.status, a.titel, a.dokumentdatum::text AS dokumentdatum,
         a.gueltig_bis::text AS "gueltigBis", a.ersetzt_durch AS "ersetztDurch", a.notizen,
         a.gueltig_ab::text AS "gueltigAb", d.erstellt_am AS "erstelltAm"
  FROM dokumente d JOIN dokumente_aktuell a ON a.dokument_id = d.id`

export async function ladeDokument(tx: Tx, id: string): Promise<DokumentZeile | null> {
  const [r] = await tx.execute<DokumentZeile>(sql`${SELECT} WHERE d.id = ${id}`)
  return r ?? null
}

/** Dokumente am Objekt (auch die seiner Mietverhältnisse) oder an einem Mietverhältnis. */
export async function listeDokumente(
  tx: Tx,
  o: { objektId?: string; mietverhaeltnisId?: string },
): Promise<DokumentZeile[]> {
  const bed = o.mietverhaeltnisId
    ? sql`d.mietverhaeltnis_id = ${o.mietverhaeltnisId}`
    : sql`(d.objekt_id = ${o.objektId ?? null} OR d.mietverhaeltnis_id IN (
           SELECT m.id FROM mietverhaeltnisse m JOIN einheiten e ON e.id = m.einheit_id
           WHERE e.objekt_id = ${o.objektId ?? null}))`
  return tx.execute<DokumentZeile>(sql`${SELECT} WHERE ${bed}
    ORDER BY CASE a.status WHEN 'gueltig' THEN 0 ELSE 1 END, a.dokumentdatum DESC NULLS LAST, d.erstellt_am DESC`)
}

/** Anhang einer Mail für die Ablage als Dokument: dieselbe Datei, kein zweiter Upload. */
export async function anhangFuerDokument(
  tx: Tx,
  anhangId: string,
): Promise<{
  schluessel: string
  sha256: string
  dateiname: string
  mimeTyp: string
  groesse: number
  nachrichtId: string
} | null> {
  const [r] = await tx.execute<{
    schluessel: string
    sha256: string
    dateiname: string
    mimeTyp: string
    groesse: number
    nachrichtId: string
  }>(sql`
    SELECT schluessel, sha256, dateiname, mime_typ AS "mimeTyp", groesse::int AS groesse,
           nachricht_id AS "nachrichtId"
    FROM anhaenge WHERE id = ${anhangId}`)
  return r ?? null
}
