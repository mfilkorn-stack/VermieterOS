import { sql } from 'drizzle-orm'
import { bkFristen } from './betriebskosten'
import type { Tx } from './client'

/**
 * Rohdaten für den Jahresabschluss (WP 2.7) je Objekt; die Checkliste baut `jahresabschluss`
 * im Rechenkern.
 */
export type AbschlussRoh = {
  objektId: string
  objekt: string
  weg: boolean
  belegeOffen: number
  buchungen: number
  letzteBuchung: string | null
  bk: Array<{
    einheit: string
    abrechnungId: string | null
    status: 'fehlt' | 'entwurf' | 'festgeschrieben'
    versendet: boolean
  }>
  dokumente: Array<{ typ: string; datum: string | null; gueltigBis: string | null }>
  darlehen: boolean
  steuerpaket: 'offen' | 'entwurf' | 'festgeschrieben'
}

const ABSCHLUSS_TYPEN = ['grundsteuer', 'hausgeldabrechnung', 'zinsbescheinigung', 'kreditvertrag']

export async function abschlussDaten(tx: Tx, jahr: number): Promise<AbschlussRoh[]> {
  const objekte = await tx.execute<{ id: string; bezeichnung: string; weg: boolean }>(sql`
    SELECT objekt_id AS id, bezeichnung, weg FROM objekte_aktuell ORDER BY bezeichnung`)
  if (objekte.length === 0) return []
  const [ohneObjekt] = await tx.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM dokumente d JOIN dokumente_aktuell a ON a.dokument_id = d.id
    WHERE a.typ = 'beleg' AND a.status = 'gueltig' AND d.objekt_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM journal_gueltig g WHERE g.dokument_id = d.id)`)
  const fristen = await bkFristen(tx, [jahr])
  const out: AbschlussRoh[] = []
  for (const o of objekte) {
    const [belege] = await tx.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM dokumente d JOIN dokumente_aktuell a ON a.dokument_id = d.id
      WHERE a.typ = 'beleg' AND a.status = 'gueltig' AND d.objekt_id = ${o.id}
        AND NOT EXISTS (SELECT 1 FROM journal_gueltig g WHERE g.dokument_id = d.id)`)
    const [j] = await tx.execute<{ n: number; letzte: string | null; zinsen: boolean }>(sql`
      SELECT count(DISTINCT e.id)::int AS n, max(e.zahlungsdatum)::text AS letzte,
             coalesce(bool_or(e.steuerkategorie = 'schuldzinsen'), false) AS zinsen
      FROM journal_gueltig e JOIN journal_anteile an ON an.eintrag_id = e.id
      WHERE an.objekt_id = ${o.id} AND e.jahr = ${jahr}`)
    const dokumente = await tx.execute<{
      typ: string
      datum: string | null
      gueltigBis: string | null
    }>(sql`
      SELECT a.typ, a.dokumentdatum::text AS datum, a.gueltig_bis::text AS "gueltigBis"
      FROM dokumente d JOIN dokumente_aktuell a ON a.dokument_id = d.id
      WHERE a.status = 'gueltig'
        AND a.typ IN (${sql.join(
          ABSCHLUSS_TYPEN.map((t) => sql`${t}`),
          sql`, `,
        )})
        AND (d.objekt_id = ${o.id} OR d.mietverhaeltnis_id IN (
          SELECT m.id FROM mietverhaeltnisse m JOIN einheiten e ON e.id = m.einheit_id
          WHERE e.objekt_id = ${o.id}))`)
    const [p] = await tx.execute<{ status: string }>(sql`
      SELECT v.status FROM steuerpakete p
      JOIN LATERAL (
        SELECT x.status FROM steuerpaket_versionen x
        WHERE x.steuerpaket_id = p.id
          AND NOT EXISTS (SELECT 1 FROM stornos s WHERE s.version_id = x.id)
        ORDER BY x.version_nr DESC LIMIT 1
      ) v ON true
      WHERE p.objekt_id = ${o.id} AND p.jahr = ${jahr}`)
    out.push({
      objektId: o.id,
      objekt: o.bezeichnung,
      weg: o.weg,
      belegeOffen: (belege?.n ?? 0) + (ohneObjekt?.n ?? 0),
      buchungen: j?.n ?? 0,
      letzteBuchung: j?.letzte ?? null,
      bk: fristen
        .filter((f) => f.objektId === o.id)
        .map((f) => ({
          einheit: f.einheit,
          abrechnungId: f.abrechnungId,
          status: (f.status ?? 'fehlt') as 'fehlt' | 'entwurf' | 'festgeschrieben',
          versendet: f.versendet,
        })),
      dokumente: [...dokumente],
      darlehen: (j?.zinsen ?? false) || dokumente.some((d) => d.typ === 'kreditvertrag'),
      steuerpaket: (p?.status ?? 'offen') as 'offen' | 'entwurf' | 'festgeschrieben',
    })
  }
  return out
}
