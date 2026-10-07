import 'server-only'
import type { Tx } from '@vermieteros/db'
import { sql } from 'drizzle-orm'

/** Objekte des Mandanten für Auswahllisten. */
export async function objektliste(tx: Tx): Promise<Array<{ id: string; bezeichnung: string }>> {
  return [
    ...(await tx.execute<{ id: string; bezeichnung: string }>(
      sql`SELECT objekt_id AS id, bezeichnung FROM objekte_aktuell ORDER BY bezeichnung`,
    )),
  ]
}
