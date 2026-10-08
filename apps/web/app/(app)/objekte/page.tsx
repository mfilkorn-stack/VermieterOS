import { Plus } from 'lucide-react'
import Link from 'next/link'
import { ObjektListe } from '@/components/objekt-liste'
import { ladeObjektKacheln } from '@/lib/objekte'
import { darf, mitMandant } from '@/lib/sitzung'

export default async function ObjekteSeite() {
  const objekte = await mitMandant((tx) => ladeObjektKacheln(tx))
  const schreiben = await darf({ stammdaten: ['schreiben'] })
  return (
    <>
      <div className="seitenkopf">
        <div>
          <h1>Objekte</h1>
          <p className="leise">
            {objekte.length === 1 ? '1 Objekt' : objekte.length + ' Objekte'} im Bestand.
          </p>
        </div>
        {schreiben ? (
          <Link className="knopf" href="/objekte/neu" data-testid="objekt-neu">
            <Plus size={18} aria-hidden />
            Objekt anlegen
          </Link>
        ) : null}
      </div>
      <ObjektListe objekte={objekte} schreiben={schreiben} />
    </>
  )
}
