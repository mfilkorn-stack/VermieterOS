import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { DarlehenFormular } from '@/components/darlehen-formular'
import { ladeAkte } from '@/lib/akte'
import { darf, mitMandant } from '@/lib/sitzung'

export default async function DarlehenSeite({
  params,
}: {
  params: Promise<{ id: string; did: string }>
}) {
  const { id, did } = await params
  if (!(await darf({ stammdaten: ['schreiben'] }))) redirect(`/objekte/${id}`)
  const akte = await mitMandant((tx) => ladeAkte(tx, id))
  const darlehen = akte?.darlehen.find((d) => d.id === did)
  if (!akte || !darlehen) notFound()
  return (
    <>
      <nav className="brotkrumen" aria-label="Pfad">
        <Link href={'/objekte'}>Objekte</Link>
        <span aria-hidden>/</span>
        <Link href={`/objekte/${id}`}>{akte.objekt.bezeichnung}</Link>
        <span aria-hidden>/</span>
        <span>{darlehen.v.bank}</span>
      </nav>
      <div className="karte">
        <h1>Darlehen · {darlehen.v.bank}</h1>
        <DarlehenFormular objektId={id} darlehen={darlehen} giltAb={darlehen.v.gueltigAb} />
      </div>
    </>
  )
}
