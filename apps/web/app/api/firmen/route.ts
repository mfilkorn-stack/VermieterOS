import { firmensucheAn, sucheFirmen } from '@/lib/firma'
import { sitzung } from '@/lib/sitzung'

export const dynamic = 'force-dynamic'

/** Vorschläge für die Firmensuche (components/firmensuche.tsx). Nur angemeldet. */
export async function GET(req: Request) {
  if (!(await sitzung())) return new Response('Nicht angemeldet', { status: 401 })
  if (!firmensucheAn()) return Response.json({ treffer: [], aus: true })
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 120)
  if (q.length < 3) return Response.json({ treffer: [] })
  try {
    return Response.json({ treffer: await sucheFirmen(q) })
  } catch (e) {
    console.warn('[firma] Suche fehlgeschlagen: ' + (e instanceof Error ? e.message : e))
    return Response.json({ treffer: [], fehler: true }, { status: 502 })
  }
}
