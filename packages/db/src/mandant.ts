import { sql } from 'drizzle-orm'
import type { Db, Tx } from './client'

/**
 * Führt `fn` in einer Transaktion aus, in der `app.mandant_id` gesetzt ist.
 * Alle RLS-Policies lesen diesen Wert; ohne ihn liefert jede Abfrage null Zeilen
 * und jeder Schreibversuch scheitert. Das ist die einzige erlaubte Art, Fachdaten zu lesen oder zu schreiben.
 */
export async function withMandant<T>(
  db: Db,
  mandantId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mandantId)) {
    throw new Error(`ungültige mandantId: ${mandantId}`)
  }
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.mandant_id', ${mandantId}, true)`)
    return fn(tx)
  })
}

/** Liest den in dieser Transaktion gesetzten Mandanten (für Zusicherungen in Fachcode). */
export async function aktuellerMandant(tx: Tx): Promise<string | null> {
  const rows = await tx.execute<{ id: string | null }>(sql`select aktueller_mandant() as id`)
  return rows[0]?.id ?? null
}
