import { redirect } from 'next/navigation'
import { Formular } from '@/components/formular'
import { darf } from '@/lib/sitzung'
import { objektAnlegen } from '../../aktionen'

export default async function ObjektNeuSeite() {
  if (!(await darf({ stammdaten: ['schreiben'] }))) redirect('/')
  return (
    <div className="karte">
      <h1>Objekt anlegen</h1>
      <p className="leise">
        Grunddaten genügen. Grundbuch, Kauf, Einheiten, Mieter und Darlehen ergänzt die Objektakte
        Schritt für Schritt.
      </p>
      <Formular aktion={objektAnlegen} knopf="Anlegen" testId="objekt-anlegen">
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
      </Formular>
    </div>
  )
}
