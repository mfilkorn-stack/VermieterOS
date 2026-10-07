import { ladeRohmailZumHerunterladen } from '@vermieteros/db'
import { darf, mitMandant } from '@/lib/sitzung'
import { downloadAntwort, objektSpeicher } from '@/lib/speicher'

/** Vollständige Mail als .eml, zum Öffnen im Mailprogramm oder für die Akte. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await darf({ post: ['lesen'] }))) return new Response('Keine Berechtigung', { status: 403 })
  const n = await mitMandant((tx) => ladeRohmailZumHerunterladen(tx, id))
  if (!n) return new Response('Nicht gefunden', { status: 404 })
  const inhalt = await objektSpeicher().holen(n.schluessel)
  const name =
    (n.betreff || 'nachricht')
      .replace(/[\\/:*?"<>|]+/g, ' ')
      .trim()
      .slice(0, 80) || 'nachricht'
  return downloadAntwort(inhalt, `${name}.eml`, 'message/rfc822')
}
