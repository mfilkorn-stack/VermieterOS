import { ladeDokument } from '@vermieteros/db'
import { sha256 } from '@vermieteros/post'
import { darf, mitMandant } from '@/lib/sitzung'
import { downloadAntwort, objektSpeicher } from '@/lib/speicher'

/** Dokument herunterladen (`?ansicht=1`: PDF oder Bild eingebettet); die Prüfsumme der Datei wird vor der Auslieferung geprüft. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await darf({ stammdaten: ['lesen'] })))
    return new Response('Keine Berechtigung', { status: 403 })
  const d = await mitMandant((tx) => ladeDokument(tx, id))
  if (!d) return new Response('Nicht gefunden', { status: 404 })
  const inhalt = await objektSpeicher().holen(d.speicherSchluessel)
  if (sha256(inhalt) !== d.dateiHash) return new Response('Prüfsumme stimmt nicht', { status: 500 })
  const ansicht = new URL(req.url).searchParams.get('ansicht') === '1'
  return downloadAntwort(inhalt, d.dateiname, d.mime, ansicht)
}
