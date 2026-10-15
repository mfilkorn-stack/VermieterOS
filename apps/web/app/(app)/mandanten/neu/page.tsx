import Link from 'next/link'
import { Formular } from '@/components/formular'
import { mandantAnlegen } from '../../aktionen'

export default function MandantNeuSeite() {
  return (
    <>
      <nav className="brotkrumen" aria-label="Pfad">
        <Link href={'/mandanten'}>Eigentümerschaften</Link>
        <span aria-hidden>/</span>
        <span>Eigentümerschaft anlegen</span>
      </nav>
      <div className="karte">
        <h1>Eigentümerschaft anlegen</h1>
        <Formular aktion={mandantAnlegen} knopf="Eigentümerschaft anlegen" testId="mandant-anlegen">
          <label>
            Name
            <input
              name="name"
              placeholder="z. B. Familie Muster oder Geschwister Muster GbR"
              required
            />
          </label>
          <label>
            Art der Eigentümerschaft
            <select name="art" defaultValue="allein">
              <option value="allein">Allein</option>
              <option value="ehepaar">Ehepaar</option>
              <option value="bruchteil">Bruchteilsgemeinschaft</option>
              <option value="gbr">GbR</option>
            </select>
          </label>
        </Formular>
      </div>
    </>
  )
}
