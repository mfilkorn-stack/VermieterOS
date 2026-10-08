import 'server-only'
import { datenqualitaet, type Tx } from '@vermieteros/db'
import { sql } from 'drizzle-orm'
import type { ObjektKachel } from '@/components/objekt-liste'

/** Objekte des Mandanten für Auswahllisten. */
export async function objektliste(tx: Tx): Promise<Array<{ id: string; bezeichnung: string }>> {
  return [
    ...(await tx.execute<{ id: string; bezeichnung: string }>(
      sql`SELECT objekt_id AS id, bezeichnung FROM objekte_aktuell ORDER BY bezeichnung`,
    )),
  ]
}

/** Alle Objekte des Mandanten mit Ampeln, für Übersicht und Objektliste. */
export async function ladeObjektKacheln(tx: Tx): Promise<ObjektKachel[]> {
  const rows = await tx.execute<{ objekt_id: string; bezeichnung: string; ort: string | null }>(
    sql`select objekt_id, bezeichnung, ort from objekte_aktuell order by bezeichnung`,
  )
  const objekte: ObjektKachel[] = []
  for (const r of rows) {
    const q = await datenqualitaet(tx, r.objekt_id)
    objekte.push({
      id: r.objekt_id,
      bezeichnung: r.bezeichnung,
      ort: r.ort,
      ampel: q?.ampel ?? null,
    })
  }
  return objekte
}
