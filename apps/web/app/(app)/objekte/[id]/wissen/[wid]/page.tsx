import { letzteVersion, listeWissen } from '@vermieteros/db'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Formular } from '@/components/formular'
import { WissenFormular } from '@/components/wissen-formular'
import { darf, mitMandant } from '@/lib/sitzung'
import { wissenEntfernen } from '../../betrieb-aktionen'

export default async function WissenBearbeiten({
  params,
}: {
  params: Promise<{ id: string; wid: string }>
}) {
  const { id, wid } = await params
  if (!(await darf({ stammdaten: ['schreiben'] }))) redirect(`/objekte/${id}`)
  const daten = await mitMandant(async (tx) => ({
    o: await letzteVersion(tx, 'objekt', id),
    w: (await listeWissen(tx, id)).find((x) => x.id === wid),
  }))
  if (!daten.o || !daten.w) notFound()
  return (
    <>
      <nav className="brotkrumen" aria-label="Pfad">
        <Link href={`/objekte/${id}`}>{daten.o.bezeichnung}</Link>
        <span aria-hidden>/</span>
        <span>{daten.w.titel}</span>
      </nav>
      <div className="karte">
        <h1>{daten.w.titel}</h1>
        <WissenFormular objektId={id} w={daten.w} />
      </div>
      <div className="karte">
        <h2>Artikel entfernen</h2>
        <Formular aktion={wissenEntfernen} knopf="Entfernen" testId="wissen-entfernen" zweit>
          <input type="hidden" name="objektId" value={id} />
          <input type="hidden" name="wissensartikelId" value={wid} />
        </Formular>
      </div>
    </>
  )
}
