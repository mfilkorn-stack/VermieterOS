import { sql } from 'drizzle-orm'
import type { Tx } from './client'
import { ereignis } from './ereignis'
import { letzteVersion, type Version } from './ledger'
import type { Akteur } from './schema/index'

/**
 * Lesefunktionen für Betriebskostenabrechnungen (WP 2.4). Schreiben läuft über `neueVersion`
 * (Entität `bk_abrechnung`); die Datenbank sperrt Änderungen nach der Festschreibung.
 */

export type BkAbrechnungZeile = {
  id: string
  einheitId: string
  jahr: number
  status: 'entwurf' | 'festgeschrieben'
  zeitraumVon: string
  zeitraumBis: string
  geaendertAm: string
}

/** Abrechnungen einer Einheit, jüngstes Jahr zuerst, mit Stand der letzten Version. */
export async function listeBkAbrechnungen(tx: Tx, einheitId: string): Promise<BkAbrechnungZeile[]> {
  return tx.execute<BkAbrechnungZeile>(sql`
    SELECT a.id, a.einheit_id AS "einheitId", a.jahr::int AS jahr, v.status,
           v.zeitraum_von::text AS "zeitraumVon", v.zeitraum_bis::text AS "zeitraumBis",
           v.erfasst_am AS "geaendertAm"
    FROM bk_abrechnungen a
    JOIN LATERAL (
      SELECT * FROM bk_abrechnung_versionen x
      WHERE x.bk_abrechnung_id = a.id
        AND NOT EXISTS (SELECT 1 FROM stornos s WHERE s.version_id = x.id)
      ORDER BY x.version_nr DESC LIMIT 1
    ) v ON true
    WHERE a.einheit_id = ${einheitId}
    ORDER BY a.jahr DESC`)
}

export type BkAbrechnung = {
  id: string
  einheitId: string
  jahr: number
  version: Version<'bk_abrechnung'>
}

export async function ladeBkAbrechnung(tx: Tx, id: string): Promise<BkAbrechnung | null> {
  const [a] = await tx.execute<{ einheit_id: string; jahr: number }>(
    sql`SELECT einheit_id, jahr::int AS jahr FROM bk_abrechnungen WHERE id = ${id}`,
  )
  if (!a) return null
  const version = await letzteVersion(tx, 'bk_abrechnung', id)
  if (!version) return null
  return { id, einheitId: a.einheit_id, jahr: a.jahr, version }
}

export async function bkAbrechnungZuJahr(
  tx: Tx,
  einheitId: string,
  jahr: number,
): Promise<string | null> {
  const [r] = await tx.execute<{ id: string }>(
    sql`SELECT id FROM bk_abrechnungen WHERE einheit_id = ${einheitId} AND jahr = ${jahr}`,
  )
  return r?.id ?? null
}

export type BkNutzung = {
  mietverhaeltnisId: string
  mieter: string[]
  mieterIds: string[]
  /** Mail-Adressen der Mieter, für den Versand */
  emails: string[]
  /** Zeitraum innerhalb des Abrechnungszeitraums */
  von: string
  bis: string
  personen: number
  /** Monatliche Vorauszahlungen (Betriebs- plus Heizkosten) ab dem jeweiligen Datum */
  vorauszahlungen: Array<{ ab: string; monatCent: number }>
}

const name = (p: { vorname?: string | null; nachname: string; firma?: string | null }) =>
  p.firma || [p.vorname, p.nachname].filter(Boolean).join(' ')

/** Mietverhältnisse der Einheit, die in den Zeitraum fallen, mit Vorauszahlungen aus den Konditionen. */
export async function bkNutzungen(
  tx: Tx,
  einheitId: string,
  von: string,
  bis: string,
): Promise<BkNutzung[]> {
  const ids = await tx.execute<{ id: string }>(
    sql`SELECT id FROM mietverhaeltnisse WHERE einheit_id = ${einheitId} ORDER BY erstellt_am`,
  )
  const out: BkNutzung[] = []
  for (const { id } of ids) {
    const mv = await letzteVersion(tx, 'mietverhaeltnis', id)
    if (!mv) continue
    const start = mv.beginn > von ? mv.beginn : von
    const ende = mv.ende && mv.ende < bis ? mv.ende : bis
    if (ende < start) continue
    const mieter: string[] = []
    const emails: string[] = []
    for (const pid of mv.mieterIds) {
      const p = await letzteVersion(tx, 'person', pid)
      if (p) mieter.push(name(p))
      if (p?.email) emails.push(p.email)
    }
    const stufen = await tx.execute<{ ab: string; monat: number; personen: number }>(sql`
      SELECT DISTINCT ON (v.gueltig_ab) v.gueltig_ab::text AS ab,
             (v.vorauszahlung_bk_cent + v.vorauszahlung_hk_cent)::bigint AS monat,
             v.personenzahl AS personen
      FROM mietkondition_versionen v
      JOIN mietkonditionen k ON k.id = v.mietkondition_id
      WHERE k.mietverhaeltnis_id = ${id}
        AND NOT EXISTS (SELECT 1 FROM stornos s WHERE s.version_id = v.id)
      ORDER BY v.gueltig_ab, v.erfasst_am DESC`)
    const imZeitraum = stufen.filter((s) => s.ab <= ende)
    out.push({
      mietverhaeltnisId: id,
      mieter,
      mieterIds: mv.mieterIds,
      emails,
      von: start,
      bis: ende,
      personen: Number(imZeitraum.at(-1)?.personen ?? stufen[0]?.personen ?? 1),
      vorauszahlungen: stufen.map((s) => ({ ab: s.ab, monatCent: Number(s.monat) })),
    })
  }
  return out.sort((a, b) => a.von.localeCompare(b.von))
}

export type BkVersand = {
  mietverhaeltnisId: string
  art: 'mail' | 'post'
  /** Mail: Empfänger; Post: Notiz (z. B. Einschreiben) */
  an: string[]
  notiz: string | null
  /** Tag des Versands bzw. Einwurfs */
  datum: string
  erfasstAm: string
}

/** Versand der festgeschriebenen Abrechnung, aus dem Ledger (Ereignis `bk_versand`). */
export async function bkVersand(tx: Tx, abrechnungId: string): Promise<BkVersand[]> {
  const rows = await tx.execute<{ payload: Record<string, unknown>; erfasst_am: string }>(sql`
    SELECT payload, erfasst_am FROM ereignisse
    WHERE typ = 'bk_versand' AND entitaet = 'bk_abrechnung' AND entitaet_id = ${abrechnungId}
    ORDER BY seq`)
  return rows.map((r) => ({
    mietverhaeltnisId: String(r.payload['mietverhaeltnisId']),
    art: r.payload['art'] === 'post' ? 'post' : 'mail',
    an: (r.payload['an'] as string[] | undefined) ?? [],
    notiz: (r.payload['notiz'] as string | null | undefined) ?? null,
    datum: String(r.payload['datum']),
    erfasstAm: r.erfasst_am,
  }))
}

export async function vermerkeBkVersand(
  tx: Tx,
  p: {
    mandantId: string
    abrechnungId: string
    akteur: Akteur
    mietverhaeltnisId: string
    dokumentId: string
    art: 'mail' | 'post'
    an?: string[]
    notiz?: string | null
    datum: string
  },
): Promise<void> {
  await ereignis(tx, {
    mandantId: p.mandantId,
    typ: 'bk_versand',
    entitaet: 'bk_abrechnung',
    entitaetId: p.abrechnungId,
    akteur: p.akteur,
    payload: {
      mietverhaeltnisId: p.mietverhaeltnisId,
      dokumentId: p.dokumentId,
      art: p.art,
      an: p.an ?? [],
      notiz: p.notiz ?? null,
      datum: p.datum,
    },
  })
}
