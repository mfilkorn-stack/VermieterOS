import Link from 'next/link'
import { Formular } from '@/components/formular'
import { passwortVergessen } from '../aktionen'

export default function PasswortVergessenSeite() {
  return (
    <div className="karte">
      <h1>Passwort vergessen</h1>
      <p className="leise">
        Wir schicken dir einen Link, mit dem du ein neues Passwort setzt. Die Zwei-Faktor-Anmeldung
        bleibt danach bestehen.
      </p>
      <Formular aktion={passwortVergessen} knopf="Link anfordern" testId="passwort-vergessen">
        <label>
          E-Mail
          <input name="email" type="email" autoComplete="email" required />
        </label>
      </Formular>
      <p className="leise">
        <Link href="/login">Zurück zur Anmeldung</Link>
      </p>
    </div>
  )
}
