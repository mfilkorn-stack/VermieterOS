import { letzteVersion, listeBkAbrechnungen } from '@vermieteros/db'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Formular } from '@/components/formular'
import { Status } from '@/components/status'
import { datumAnzeige } from '@/lib/format'
import { darf, mitMandant } from '@/lib/sitzung'
import { heuteBerlin } from '@/lib/zeit'
import { bkAnlegen } from '../../../../../betriebskosten/aktionen'

export default async function BetriebskostenListe({
  params,
}: {
  params: Promise<{ id: string; eid: string }>
}) {
  const { id, eid } = await params
  if (!(await darf({ stammdaten: ['lesen'] }))) redirect('/')
  const schreiben = await darf({ stammdaten: ['schreiben'] })
  const d = await mitMandant(async (tx) => ({
    einheit: await letzteVersion(tx, 'einheit', eid),
    liste: await listeBkAbrechnungen(tx, eid),
  }))
  if (!d.einheit) notFound()
  const vorjahr = Number(heuteBerlin().slice(0, 4)) - 1
  return (
    <>
      <nav className="brotkrumen" aria-label="Pfad">
        <Link href={`/objekte/${id}`}>Objektakte</Link>
        <span aria-hidden>/</span>
        <span>{d.einheit.bezeichnung}</span>
      </nav>
      <div className="seitenkopf">
        <div>
          <h1>Betriebskosten · {d.einheit.bezeichnung}</h1>
          <p className="leise">
            Eine Abrechnung je Jahr; Positionen werden aus dem Vorjahr übernommen.
          </p>
        </div>
      </div>
      <div className="karte" data-testid="bk-liste">
        {d.liste.length === 0 ? (
          <p className="leise">Noch keine Abrechnung.</p>
        ) : (
          <ul className="liste-schlicht">
            {d.liste.map((a) => (
              <li key={a.id} className="zeile">
                <Link href={`/betriebskosten/${a.id}`}>
                  <strong>{a.jahr}</strong>
                </Link>
                <span className="leise">
                  {datumAnzeige(a.zeitraumVon)} bis {datumAnzeige(a.zeitraumBis)}
                </span>
                <Status ton={a.status === 'festgeschrieben' ? 'gruen' : 'neutral'}>
                  {a.status === 'festgeschrieben' ? 'festgeschrieben' : 'Entwurf'}
                </Status>
              </li>
            ))}
          </ul>
        )}
      </div>
      {schreiben ? (
        <div className="karte">
          <h2>Neue Abrechnung</h2>
          <Formular aktion={bkAnlegen} knopf="Abrechnung anlegen" testId="bk-anlegen">
            <input type="hidden" name="einheitId" value={eid} />
            <label>
              Jahr
              <input
                name="jahr"
                type="number"
                min={2000}
                max={2100}
                defaultValue={vorjahr}
                required
              />
            </label>
          </Formular>
        </div>
      ) : null}
    </>
  )
}
