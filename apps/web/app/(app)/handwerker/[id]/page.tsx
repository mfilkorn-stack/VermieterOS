import { listeHandwerker } from '@vermieteros/db'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Formular } from '@/components/formular'
import { HandwerkerFormular } from '@/components/handwerker-formular'
import { adresssucheAn } from '@/lib/adresse'
import { firmensucheAn } from '@/lib/firma'
import { objektliste } from '@/lib/objekte'
import { darf, mitMandant } from '@/lib/sitzung'
import { heuteBerlin } from '@/lib/zeit'
import { handwerkerEntfernen } from '../aktionen'

export default async function HandwerkerBearbeiten({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!(await darf({ stammdaten: ['schreiben'] }))) redirect('/handwerker')
  const { h, objekte } = await mitMandant(async (tx) => ({
    h: (await listeHandwerker(tx)).find((x) => x.id === id),
    objekte: await objektliste(tx),
  }))
  if (!h) notFound()
  return (
    <>
      <nav className="brotkrumen" aria-label="Pfad">
        <Link href="/handwerker">Handwerker</Link>
        <span aria-hidden>/</span>
        <span>{h.firma}</span>
      </nav>
      <div className="karte">
        <h1>{h.firma}</h1>
        <HandwerkerFormular
          h={h}
          objekte={objekte}
          heute={heuteBerlin()}
          firmensuche={firmensucheAn()}
          adresssuche={adresssucheAn()}
        />
      </div>
      <div className="karte">
        <h2>Aus dem Verzeichnis entfernen</h2>
        <p className="leise">
          Bleibt in der Historie erhalten; Tickets und Notfallkarten zeigen ihn danach nicht mehr
          an.
        </p>
        <Formular
          aktion={handwerkerEntfernen}
          knopf="Entfernen"
          testId="handwerker-entfernen"
          zweit
        >
          <input type="hidden" name="handwerkerId" value={h.id} />
        </Formular>
      </div>
    </>
  )
}
