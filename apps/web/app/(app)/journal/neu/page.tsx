import { objekteFuerBeleg } from '@vermieteros/db'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BuchungFelder } from '@/components/buchung-felder'
import { Formular } from '@/components/formular'
import { darf, mitMandant } from '@/lib/sitzung'
import { journalBuchen } from '../../belege/aktionen'

/** Buchung ohne Beleg: Mieteingänge bis zum Bank-Abgleich, Kleinbeträge, Korrekturen. */
export default async function JournalNeuSeite() {
  if (!(await darf({ stammdaten: ['schreiben'] }))) redirect('/journal')
  const objekte = await mitMandant((tx) => objekteFuerBeleg(tx))
  return (
    <>
      <nav className="brotkrumen" aria-label="Pfad">
        <Link href="/journal">Journal</Link>
        <span aria-hidden>/</span>
        <span>Ohne Beleg buchen</span>
      </nav>
      <h1>Ohne Beleg buchen</h1>
      <p className="leise">
        Für Ausgaben mit Rechnung besser den Belegeingang nutzen: Jede Ausgabe braucht für die
        Steuer einen Beleg.
      </p>
      {objekte.length === 0 ? (
        <p>
          Zuerst ein <Link href="/objekte/neu">Objekt anlegen</Link>.
        </p>
      ) : (
        <div className="karte">
          <Formular aktion={journalBuchen} knopf="Buchen" testId="journal-buchen">
            <BuchungFelder objekte={objekte} vorgabe={{ richtung: 'einnahme' }} richtungWaehlbar />
          </Formular>
        </div>
      )}
    </>
  )
}
