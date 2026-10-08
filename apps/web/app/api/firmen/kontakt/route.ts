import { firmensucheAn, kontaktZuFirma } from '@/lib/firma'
import { sitzung } from '@/lib/sitzung'

export const dynamic = 'force-dynamic'

/** Telefon, E-Mail und Webseite zu einer gewählten Firma (ein Abruf je Auswahl). */
export async function GET(req: Request) {
  if (!(await sitzung())) return new Response('Nicht angemeldet', { status: 401 })
  if (!firmensucheAn()) return Response.json({ kontakt: null })
  const osm = new URL(req.url).searchParams.get('osm') ?? ''
  try {
    return Response.json({ kontakt: await kontaktZuFirma(osm) })
  } catch (e) {
    console.warn('[firma] Kontakt fehlgeschlagen: ' + (e instanceof Error ? e.message : e))
    return Response.json({ kontakt: null, fehler: true }, { status: 502 })
  }
}
