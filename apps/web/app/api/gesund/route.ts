import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

/** Für Container-Healthcheck und externes Uptime-Monitoring: App läuft und erreicht die Datenbank. */
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await db.execute(sql`select 1`)
    return Response.json({ ok: true })
  } catch {
    return Response.json({ ok: false }, { status: 503 })
  }
}
