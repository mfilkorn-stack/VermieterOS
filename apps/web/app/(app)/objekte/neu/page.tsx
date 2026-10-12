import Link from 'next/link'
import { BUNDESLAENDER, BUNDESLAND_NAME } from '@vermieteros/schema'
import { redirect } from 'next/navigation'
import { Adresssuche } from '@/components/adresssuche'
import { Auswahl } from '@/components/felder'
import { Formular } from '@/components/formular'
import { adresssucheAn } from '@/lib/adresse'
import { darf } from '@/lib/sitzung'
import { objektAnlegen } from '../../aktionen'

export default async function ObjektNeuSeite() {
  if (!(await darf({ stammdaten: ['schreiben'] }))) redirect('/')
  return (
    <>
      <nav className="brotkrumen" aria-label="Pfad">
        <Link href={'/objekte'}>Objekte</Link>
        <span aria-hidden>/</span>
        <span>Objekt anlegen</span>
      </nav>
      <div className="karte">
        <h1>Objekt anlegen</h1>
        <p className="leise">
          Grunddaten genügen. Grundbuch, Kauf, Einheiten, Mieter und Darlehen ergänzt die Objektakte
          Schritt für Schritt.
        </p>
        <Formular aktion={objektAnlegen} knopf="Objekt anlegen" testId="objekt-anlegen">
          <label>
            Bezeichnung
            <input name="bezeichnung" placeholder="z. B. Musterstraße 1" required />
          </label>
          <label>
            Art
            <select name="art" defaultValue="haus">
              <option value="haus">Haus</option>
              <option value="etw">Eigentumswohnung</option>
            </select>
          </label>
          <label>
            Im Bestand seit
            <input name="bestandSeit" type="date" required />
            <span className="leise">
              Übergang von Nutzen und Lasten, meist mit Zahlung des Kaufpreises.
            </span>
          </label>
          {adresssucheAn() ? <Adresssuche /> : null}
          <label>
            Straße
            <input name="strasse" />
          </label>
          <label>
            Hausnummer
            <input name="hausnummer" />
          </label>
          <label>
            PLZ
            <input name="plz" inputMode="numeric" pattern="\d{5}" />
          </label>
          <label>
            Ort
            <input name="ort" />
          </label>
          <Auswahl
            label="Bundesland"
            name="bundesland"
            leer="Bitte wählen"
            optionen={BUNDESLAENDER.map((b) => [b, BUNDESLAND_NAME[b]] as const)}
          />
        </Formular>
      </div>
    </>
  )
}
