import { sha256 } from '@vermieteros/post'
import { portalDokumente } from '@/lib/portal-daten'
import { mitPortal, portalKontext } from '@/lib/portal'
import { downloadAntwort, objektSpeicher } from '@/lib/speicher'

/** Vertragsdokument für Mieter: nur eigenes Mietverhältnis, nur freigegebene Typen. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await portalKontext())) return new Response('Nicht angemeldet', { status: 401 })
  const d = await mitPortal(async (tx, s) =>
    (await portalDokumente(tx, s)).find((x) => x.id === id),
  )
  if (!d) return new Response('Nicht gefunden', { status: 404 })
  const inhalt = await objektSpeicher().holen(d.speicherSchluessel)
  if (sha256(inhalt) !== d.dateiHash) return new Response('Prüfsumme stimmt nicht', { status: 500 })
  const ansicht = new URL(req.url).searchParams.get('ansicht') === '1'
  return downloadAntwort(inhalt, d.dateiname, d.mime, ansicht)
}
