import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { loeschHindernisse } from '@vermieteros/db'
import { EinheitFormular } from '@/components/einheit-formular'
import { LoeschKarte } from '@/components/loesch-karte'
import { ladeAkte } from '@/lib/akte'
import { darf, mitMandant } from '@/lib/sitzung'

export default async function EinheitSeite({
  params,
}: {
  params: Promise<{ id: string; eid: string }>
}) {
  const { id, eid } = await params
  if (!(await darf({ stammdaten: ['schreiben'] }))) redirect(`/objekte/${id}`)
  const { akte, hindernisse } = await mitMandant(async (tx) => ({
    akte: await ladeAkte(tx, id),
    hindernisse: await loeschHindernisse(tx, 'einheit', eid),
  }))
  const einheit = akte?.einheiten.find((e) => e.id === eid)
  if (!akte || !einheit) notFound()
  return (
    <>
      <nav className="brotkrumen" aria-label="Pfad">
        <Link href="/">Übersicht</Link>
        <span aria-hidden>/</span>
        <Link href={`/objekte/${id}`}>{akte.objekt.bezeichnung}</Link>
        <span aria-hidden>/</span>
        <span>{einheit.v.bezeichnung}</span>
      </nav>
      <div className="karte">
        <h1>{einheit.v.bezeichnung}</h1>
        <EinheitFormular objektId={id} einheit={einheit} giltAb={einheit.v.gueltigAb} />
      </div>
      <LoeschKarte art="einheit" id={eid} objektId={id} name="Einheit" hindernisse={hindernisse} />
    </>
  )
}
