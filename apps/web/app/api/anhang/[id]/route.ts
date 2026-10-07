import { ladeAnhangZumHerunterladen } from '@vermieteros/db'
import { darf, mitMandant } from '@/lib/sitzung'
import { downloadAntwort, objektSpeicher } from '@/lib/speicher'

/** Anhang einer Nachricht herunterladen. RLS beschränkt auf den aktiven Mandanten. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await darf({ post: ['lesen'] }))) return new Response('Keine Berechtigung', { status: 403 })
  const a = await mitMandant((tx) => ladeAnhangZumHerunterladen(tx, id))
  if (!a) return new Response('Nicht gefunden', { status: 404 })
  const inhalt = await objektSpeicher().holen(a.schluessel)
  return downloadAntwort(inhalt, a.dateiname, a.mimeTyp)
}
