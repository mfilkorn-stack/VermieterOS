import Link from 'next/link'
import { Formular } from '@/components/formular'
import { sicheresZiel } from '@/lib/sitzung'
import { anmelden } from '../aktionen'

export default async function LoginSeite({
  searchParams,
}: {
  searchParams: Promise<{ weiter?: string; zurueckgesetzt?: string }>
}) {
  const parameter = await searchParams
  const weiter = sicheresZiel(parameter.weiter)
  return (
    <div className="karte">
      <h1>Anmelden</h1>
      {parameter.zurueckgesetzt ? (
        <p className="leise" data-testid="passwort-geaendert">
          Das Passwort ist geändert. Bitte mit dem neuen Passwort anmelden.
        </p>
      ) : null}
      <Formular aktion={anmelden} knopf="Anmelden" testId="login">
        <input type="hidden" name="weiter" value={weiter} />
        <label>
          E-Mail
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Passwort
          <input name="passwort" type="password" autoComplete="current-password" required />
        </label>
      </Formular>
      <p className="leise">
        <Link href="/passwort-vergessen">Passwort vergessen?</Link>
      </p>
      <p className="leise">
        Noch kein Konto?{' '}
        <Link href={`/registrieren?weiter=${encodeURIComponent(weiter)}`}>Registrieren</Link>
      </p>
    </div>
  )
}
