import { ladeDokument, ladeZuordnungsKandidaten, letzteVersion } from '@vermieteros/db'
import { DokumentTyp } from '@vermieteros/schema'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { DokumentFormular } from '@/components/dokument-formular'
import { mietverhaeltnisText } from '@/lib/post-text'
import { darf, mitMandant } from '@/lib/sitzung'

/** Upload am Objekt oder Mietverhältnis; mit `ersetzt` als Nachfolger eines Dokuments, mit `typ` vorbelegt. */
export default async function DokumentNeu({
  searchParams,
}: {
  searchParams: Promise<{
    objekt?: string
    mietverhaeltnis?: string
    ersetzt?: string
    typ?: string
  }>
}) {
  if (!(await darf({ stammdaten: ['schreiben'] }))) redirect('/')
  const sp = await searchParams
  const d = await mitMandant(async (tx) => {
    const alt = sp.ersetzt ? await ladeDokument(tx, sp.ersetzt) : null
    const objektId = alt?.objektId ?? sp.objekt ?? null
    const mvId = alt?.mietverhaeltnisId ?? sp.mietverhaeltnis ?? null
    const objekt = objektId ? await letzteVersion(tx, 'objekt', objektId) : null
    const mv = mvId
      ? (await ladeZuordnungsKandidaten(tx)).find((k) => k.mietverhaeltnisId === mvId)
      : undefined
    return { alt, objektId, objekt, mvId, mv }
  })
  if (!d.objekt && !d.mv) notFound()
  const wo = d.mv ? mietverhaeltnisText(d.mv) : d.objekt!.bezeichnung
  const zurueck = d.mv ? `/mietverhaeltnisse/${d.mvId}` : `/objekte/${d.objektId}`
  return (
    <>
      <nav className="brotkrumen" aria-label="Pfad">
        <Link href={zurueck}>{wo}</Link>
        <span aria-hidden>/</span>
        <span>Dokument</span>
      </nav>
      <div className="karte">
        <h1>{d.alt ? `„${d.alt.titel}“ ersetzen` : 'Dokument hochladen'}</h1>
        <p className="leise">
          Die Datei wird mit Prüfsumme abgelegt und nie verändert.{' '}
          {d.alt ? 'Das bisherige Dokument bleibt als „ersetzt“ erhalten.' : ''}
        </p>
        <DokumentFormular
          objektId={d.mv ? undefined : (d.objektId ?? undefined)}
          mietverhaeltnisId={d.mvId ?? undefined}
          ersetztId={d.alt?.id}
          typ={d.alt?.typ ?? (DokumentTyp.safeParse(sp.typ).data || undefined)}
        />
      </div>
    </>
  )
}
