import 'server-only'
import type { Tx } from '@vermieteros/db'
import { sql } from 'drizzle-orm'

export type Ort = { wert: string; text: string; objektId: string; einheitId: string | null }

/** Auswahl „Objekt“ oder „Objekt · Einheit“ für Tickets; Wert `objektId|einheitId`. */
export async function orte(tx: Tx): Promise<Ort[]> {
  const rows = await tx.execute<{
    objekt_id: string
    objekt: string
    einheit_id: string | null
    einheit: string | null
  }>(sql`
    SELECT o.objekt_id, o.bezeichnung AS objekt, e.einheit_id, e.bezeichnung AS einheit
    FROM objekte_aktuell o
    LEFT JOIN einheiten ei ON ei.objekt_id = o.objekt_id
    LEFT JOIN einheiten_aktuell e ON e.einheit_id = ei.id
    ORDER BY o.bezeichnung, e.bezeichnung NULLS FIRST`)
  const out: Ort[] = []
  for (const r of rows) {
    if (!out.some((o) => o.objektId === r.objekt_id && o.einheitId === null)) {
      out.push({
        wert: `${r.objekt_id}|`,
        text: `${r.objekt} (ganzes Objekt)`,
        objektId: r.objekt_id,
        einheitId: null,
      })
    }
    if (r.einheit_id && r.einheit) {
      out.push({
        wert: `${r.objekt_id}|${r.einheit_id}`,
        text: `${r.objekt} · ${r.einheit}`,
        objektId: r.objekt_id,
        einheitId: r.einheit_id,
      })
    }
  }
  return out
}
