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
    <div className="karte">
      <h1>Darlehen anlegen · {akte.objekt.bezeichnung}</h1>
      <DarlehenFormular objektId={id} giltAb={akte.bestandSeit} />
    </div>
  )
}
