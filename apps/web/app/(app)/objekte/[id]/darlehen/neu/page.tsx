import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { DarlehenFormular } from '@/components/darlehen-formular'
import { ladeAkte } from '@/lib/akte'
import { darf, mitMandant } from '@/lib/sitzung'

export default async function DarlehenNeuSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await darf({ stammdaten: ['schreiben'] }))) redirect(`/objekte/${id}`)
  const akte = await mitMandant((tx) => ladeAkte(tx, id))
  if (!akte) notFound()
  return (
    <>
      <nav className="brotkrumen" aria-label="Pfad">
        <Link href={'/objekte'}>Objekte</Link>
        <span aria-hidden>/</span>
        <Link href={`/objekte/${id}`}>{akte.objekt.bezeichnung}</Link>
        <span aria-hidden>/</span>
        <span>Darlehen anlegen</span>
      </nav>
      <div className="karte">
        <h1>Darlehen anlegen</h1>
        <DarlehenFormular objektId={id} giltAb={akte.bestandSeit} />
      </div>
    </>
  )
}
