import Link from 'next/link'
import { Formular } from '@/components/formular'
import { sicheresZiel } from '@/lib/sitzung'
import { registrieren } from '../aktionen'

export default async function RegistrierenSeite({
  searchParams,
}: {
  searchParams: Promise<{ weiter?: string }>
}) {
  const weiter = sicheresZiel((await searchParams).weiter)
  return (
    <div className="karte">
      <h1>Konto anlegen</h1>
      <Formular aktion={registrieren} knopf="Konto anlegen" testId="registrieren">
        <input type="hidden" name="weiter" value={weiter} />
        <label>
          Name
          <input name="name" autoComplete="name" required />
        </label>
        <label>
          E-Mail
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Passwort (mindestens 12 Zeichen)
          <input
            name="passwort"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
        </label>
        <label>
          Passwort wiederholen
          <input
            name="passwort2"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
        </label>
      </Formular>
      <p className="leise">
        Schon ein Konto? <Link href={`/login?weiter=${encodeURIComponent(weiter)}`}>Anmelden</Link>
      </p>
    </div>
  )
}
