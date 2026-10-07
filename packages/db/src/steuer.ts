import { sql } from 'drizzle-orm'
import type { Tx } from './client'
import { letzteVersion, type Version } from './ledger'

/**
 * Lesefunktionen für das Steuerpaket (WP 2.6). Die Rechnung macht `anlageV` im Rechenkern;
 * hier werden nur die Zahlen eines Objekts zusammengetragen.
 */

export type SteuerJournalZeile = {
  id: string
  belegnummer: string
  zahlungsdatum: string
  steuerkategorie: string
  verteilungJahre: number | null
  betragCent: number
  umsatzsteuerCent: number
  gegenpartei: string
  beschreibung: string | null
  dokumentId: string | null
  bruttoCent: number
}

/** Journal-Anteile des Objekts bis einschließlich `bisJahr` (für Verteilung und 15-%-Grenze). */
export async function steuerJournal(
  tx: Tx,
  objektId: string,
  bisJahr: number,
): Promise<SteuerJournalZeile[]> {
  const rows = await tx.execute<SteuerJournalZeile>(sql`
    SELECT e.id, e.belegnummer, e.zahlungsdatum::text AS zahlungsdatum,
           e.steuerkategorie, e.verteilung_jahre AS "verteilungJahre",
           sum(a.betrag_cent)::bigint AS "betragCent",
           round(coalesce(e.umsatzsteuer_cent, 0)::numeric * sum(a.betrag_cent) / e.brutto_cent)::bigint
             AS "umsatzsteuerCent",
           e.gegenpartei, e.beschreibung, e.dokument_id AS "dokumentId",
           e.brutto_cent AS "bruttoCent"
    FROM journal_gueltig e
    JOIN journal_anteile a ON a.eintrag_id = e.id
    WHERE a.objekt_id = ${objektId} AND e.jahr <= ${bisJahr}
    GROUP BY e.id, e.belegnummer, e.zahlungsdatum, e.steuerkategorie, e.verteilung_jahre,
             e.umsatzsteuer_cent, e.brutto_cent, e.gegenpartei, e.beschreibung, e.dokument_id
    ORDER BY e.zahlungsdatum, e.belegnummer`)
  return rows.map((r) => ({
    ...r,
    betragCent: Number(r.betragCent),
    umsatzsteuerCent: Number(r.umsatzsteuerCent),
    bruttoCent: Number(r.bruttoCent),
  }))
}

export type SteuerMietzeitZeile = {
  mietverhaeltnisId: string
  einheit: string
  mieter: string[]
  von: string
  bis: string
  stufen: Array<{ ab: string; kaltCent: number; vorauszahlungCent: number }>
}

/** Mietverhältnisse der Einheiten des Objekts mit Kaltmiete und Vorauszahlungen je Stufe. */
export async function steuerMietzeiten(tx: Tx, objektId: string): Promise<SteuerMietzeitZeile[]> {
  const mvs = await tx.execute<{ id: string; einheit: string }>(sql`
    SELECT m.id, ea.bezeichnung AS einheit FROM mietverhaeltnisse m
    JOIN einheiten e ON e.id = m.einheit_id
    JOIN einheiten_aktuell ea ON ea.einheit_id = e.id
    WHERE e.objekt_id = ${objektId} ORDER BY ea.bezeichnung, m.erstellt_am`)
  const out: SteuerMietzeitZeile[] = []
  for (const m of mvs) {
    const mv = await letzteVersion(tx, 'mietverhaeltnis', m.id)
    if (!mv) continue
    const mieter: string[] = []
    for (const pid of mv.mieterIds) {
      const p = await letzteVersion(tx, 'person', pid)
      if (p) mieter.push(p.firma || [p.vorname, p.nachname].filter(Boolean).join(' '))
    }
    const stufen = await tx.execute<{ ab: string; kalt: number; vz: number }>(sql`
      SELECT DISTINCT ON (v.gueltig_ab) v.gueltig_ab::text AS ab, v.kaltmiete_cent AS kalt,
             (v.vorauszahlung_bk_cent + v.vorauszahlung_hk_cent)::bigint AS vz
      FROM mietkondition_versionen v
      JOIN mietkonditionen k ON k.id = v.mietkondition_id
      WHERE k.mietverhaeltnis_id = ${m.id}
        AND NOT EXISTS (SELECT 1 FROM stornos s WHERE s.version_id = v.id)
      ORDER BY v.gueltig_ab, v.erfasst_am DESC`)
    out.push({
      mietverhaeltnisId: m.id,
      einheit: m.einheit,
      mieter,
      von: mv.beginn,
      bis: mv.ende ?? '9999-12-31',
      stufen: stufen.map((s) => ({
        ab: s.ab,
        kaltCent: Number(s.kalt),
        vorauszahlungCent: Number(s.vz),
      })),
    })
  }
  return out
}

/**
 * Salden festgeschriebener Betriebskostenabrechnungen des Objekts. Zuflussjahr ist das Jahr des
 * ersten Versands an das Mietverhältnis, sonst das Jahr der Festschreibung.
 */
export async function steuerBkSalden(
  tx: Tx,
  objektId: string,
): Promise<
  Array<{ mietverhaeltnisId: string; jahr: number; saldoCent: number; abrechnungsjahr: number }>
> {
  const rows = await tx.execute<{
    mietverhaeltnis_id: string
    jahr: number
    saldo: number
    abrechnungsjahr: number
  }>(sql`
    SELECT x->>'mietverhaeltnisId' AS mietverhaeltnis_id, (x->>'saldoCent')::bigint AS saldo,
           a.jahr::int AS abrechnungsjahr,
           coalesce(
             (SELECT EXTRACT(YEAR FROM min((ev.payload->>'datum')::date))::int FROM ereignisse ev
              WHERE ev.typ = 'bk_versand' AND ev.entitaet_id = a.id
                AND ev.payload->>'mietverhaeltnisId' = x->>'mietverhaeltnisId'),
             EXTRACT(YEAR FROM v.erfasst_am)::int
           ) AS jahr
    FROM bk_abrechnungen a
    JOIN einheiten e ON e.id = a.einheit_id
    JOIN LATERAL (
      SELECT * FROM bk_abrechnung_versionen y
      WHERE y.bk_abrechnung_id = a.id
        AND NOT EXISTS (SELECT 1 FROM stornos s WHERE s.version_id = y.id)
      ORDER BY y.version_nr DESC LIMIT 1
    ) v ON v.status = 'festgeschrieben'
    CROSS JOIN LATERAL jsonb_array_elements(v.ergebnis) x
    WHERE e.objekt_id = ${objektId}`)
  return rows.map((r) => ({
    mietverhaeltnisId: r.mietverhaeltnis_id,
    jahr: r.jahr,
    saldoCent: Number(r.saldo),
    abrechnungsjahr: r.abrechnungsjahr,
  }))
}

/** Eigentümer des Mandanten mit Anteil (heute gültig). */
export async function steuerEigentuemer(
  tx: Tx,
): Promise<Array<{ personId: string; name: string; zaehler: number; nenner: number }>> {
  const rows = await tx.execute<{ person_id: string; zaehler: number; nenner: number }>(sql`
    SELECT ea.person_id, a.zaehler, a.nenner FROM eigentumsanteile ea
    JOIN eigentumsanteile_aktuell a ON a.eigentumsanteil_id = ea.id
    ORDER BY ea.erstellt_am`)
  const out = []
  for (const r of rows) {
    const p = await letzteVersion(tx, 'person', r.person_id)
    out.push({
      personId: r.person_id,
      name: p ? p.firma || [p.vorname, p.nachname].filter(Boolean).join(' ') : 'Eigentümer',
      zaehler: r.zaehler,
      nenner: r.nenner,
    })
  }
  return out
}

export type Steuerpaket = {
  id: string
  objektId: string
  jahr: number
  version: Version<'steuerpaket'>
}

export async function ladeSteuerpaket(
  tx: Tx,
  objektId: string,
  jahr: number,
): Promise<Steuerpaket | null> {
  const [r] = await tx.execute<{ id: string }>(
    sql`SELECT id FROM steuerpakete WHERE objekt_id = ${objektId} AND jahr = ${jahr}`,
  )
  if (!r) return null
  const version = await letzteVersion(tx, 'steuerpaket', r.id)
  return version ? { id: r.id, objektId, jahr, version } : null
}

export async function listeSteuerpakete(tx: Tx): Promise<
  Array<{
    id: string
    objektId: string
    jahr: number
    status: string
    dokumentId: string | null
    ueberschussCent: number | null
  }>
> {
  const rows = await tx.execute<{
    id: string
    objektId: string
    jahr: number
    status: string
    dokumentId: string | null
    ueberschussCent: string | null
  }>(sql`
    SELECT p.id, p.objekt_id AS "objektId", p.jahr::int AS jahr, v.status,
           v.paket_dokument_id AS "dokumentId", v.ueberschuss_cent AS "ueberschussCent"
    FROM steuerpakete p
    JOIN LATERAL (
      SELECT * FROM steuerpaket_versionen x
      WHERE x.steuerpaket_id = p.id
        AND NOT EXISTS (SELECT 1 FROM stornos s WHERE s.version_id = x.id)
      ORDER BY x.version_nr DESC LIMIT 1
    ) v ON true
    ORDER BY p.jahr DESC`)
  return rows.map((r) => ({
    ...r,
    ueberschussCent: r.ueberschussCent == null ? null : Number(r.ueberschussCent),
  }))
}
