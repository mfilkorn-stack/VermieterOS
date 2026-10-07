import { letzteVersion } from '@vermieteros/db'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { WissenFormular } from '@/components/wissen-formular'
import { darf, mitMandant } from '@/lib/sitzung'

export default async function WissenNeu({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await darf({ stammdaten: ['schreiben'] }))) redirect(`/objekte/${id}`)
  const o = await mitMandant((tx) => letzteVersion(tx, 'objekt', id))
  if (!o) notFound()
  return (
    <>
      <nav className="brotkrumen" aria-label="Pfad">
        <Link href={`/objekte/${id}`}>{o.bezeichnung}</Link>
        <span aria-hidden>/</span>
        <span>Wissensbasis</span>
      </nav>
      <div className="karte">
        <h1>Artikel anlegen</h1>
        <p className="leise">
          Hausordnung, Anleitungen, Müllabfuhr, häufige Fragen. Die KI nutzt die Artikel für
          Antwortentwürfe zu diesem Objekt.
        </p>
        <WissenFormular objektId={id} />
      </div>
    </>
  )
}
