import { redirect } from 'next/navigation'
import { HandwerkerFormular } from '@/components/handwerker-formular'
import { adresssucheAn } from '@/lib/adresse'
import { firmensucheAn } from '@/lib/firma'
import { objektliste } from '@/lib/objekte'
import { darf, mitMandant } from '@/lib/sitzung'
import { heuteBerlin } from '@/lib/zeit'

export default async function HandwerkerNeu() {
  if (!(await darf({ stammdaten: ['schreiben'] }))) redirect('/handwerker')
  const objekte = await mitMandant((tx) => objektliste(tx))
  return (
    <div className="karte">
      <h1>Handwerker anlegen</h1>
      <HandwerkerFormular
        objekte={objekte}
        heute={heuteBerlin()}
        firmensuche={firmensucheAn()}
        adresssuche={adresssucheAn()}
      />
    </div>
  )
}
