import 'server-only'
import {
  datenqualitaet,
  letzteVersion,
  listeDokumente,
  type Tx,
  type Version,
} from '@vermieteros/db'
import type { Datenqualitaet } from '@vermieteros/rechenkern'
import { sql } from 'drizzle-orm'

export type AkteMietverhaeltnis = {
  id: string
  v: Version<'mietverhaeltnis'>
  mieter: string[]
  kondition: { id: string; v: Version<'mietkondition'> } | null
}
export type AkteEinheit = {
  id: string
  v: Version<'einheit'>
  mietverhaeltnisse: AkteMietverhaeltnis[]
}
export type Akte = {
  id: string
  objekt: Version<'objekt'>
  /** Fachliche Gültigkeit der ersten Objektversion: Beginn des Bestands */
  bestandSeit: string
  einheiten: AkteEinheit[]
  darlehen: Array<{ id: string; v: Version<'darlehen'> }>
  qualitaet: Datenqualitaet | null
}

async function ids(tx: Tx, abfrage: ReturnType<typeof sql>): Promise<string[]> {
  const r = await tx.execute<{ id: string }>(abfrage)
  return r.map((x) => x.id)
}

/** Lädt alles, was zur Objektakte gehört, im RLS-Kontext des Aufrufers. `null`, wenn fremd oder unbekannt. */
export async function ladeAkte(tx: Tx, objektId: string): Promise<Akte | null> {
  const objekt = await letzteVersion(tx, 'objekt', objektId)
  if (!objekt) return null
  const [beginn] = await tx.execute<{ ab: string }>(
    sql`select min(v.gueltig_ab)::text as ab from objekt_versionen v
        where v.objekt_id = ${objektId}
          and not exists (select 1 from stornos s where s.version_id = v.id)`,
  )

  const einheiten: AkteEinheit[] = []
  for (const eid of await ids(
    tx,
    sql`select id from einheiten where objekt_id = ${objektId} order by erstellt_am`,
  )) {
    const v = await letzteVersion(tx, 'einheit', eid)
    if (!v) continue
    const mietverhaeltnisse: AkteMietverhaeltnis[] = []
    for (const mid of await ids(
      tx,
      sql`select id from mietverhaeltnisse where einheit_id = ${eid} order by erstellt_am`,
    )) {
      const mv = await letzteVersion(tx, 'mietverhaeltnis', mid)
      if (!mv) continue
      const mieter: string[] = []
      for (const pid of mv.mieterIds) {
        const p = await letzteVersion(tx, 'person', pid)
        if (p) mieter.push([p.vorname, p.nachname].filter(Boolean).join(' '))
      }
      const [kid] = await ids(
        tx,
        sql`select id from mietkonditionen where mietverhaeltnis_id = ${mid} order by erstellt_am limit 1`,
      )
      const k = kid ? await letzteVersion(tx, 'mietkondition', kid) : null
      mietverhaeltnisse.push({
        id: mid,
        v: mv,
        mieter,
        kondition: kid && k ? { id: kid, v: k } : null,
      })
    }
    einheiten.push({ id: eid, v, mietverhaeltnisse })
  }

  const darlehen: Akte['darlehen'] = []
  for (const did of await ids(
    tx,
    sql`select id from darlehen where objekt_id = ${objektId} order by erstellt_am`,
  )) {
    const v = await letzteVersion(tx, 'darlehen', did)
    if (v) darlehen.push({ id: did, v })
  }

  return {
    id: objektId,
    objekt,
    bestandSeit: beginn?.ab ?? objekt.gueltigAb,
    einheiten,
    darlehen,
    qualitaet: await datenqualitaet(tx, objektId),
  }
}

/** Jüngster gültiger Kaufvertrag direkt am Objekt (für „Aus dem Kaufvertrag übernehmen“). */
export async function gueltigerKaufvertrag(
  tx: Tx,
  objektId: string,
): Promise<{ id: string; titel: string } | null> {
  const k = (await listeDokumente(tx, { objektId })).find(
    (d) => d.typ === 'kaufvertrag' && d.status === 'gueltig' && d.objektId === objektId,
  )
  return k ? { id: k.id, titel: k.titel } : null
}
