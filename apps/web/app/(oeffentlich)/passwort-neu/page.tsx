import Link from 'next/link'
import { Formular } from '@/components/formular'
import { passwortNeu } from '../aktionen'

export default async function PasswortNeuSeite({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  if (!token) {
    return (
      <div className="karte">
        <h1>Neues Passwort</h1>
        <p>Der Link ist unvollständig.</p>
        <p className="leise">
          <Link href="/passwort-vergessen">Neuen Link anfordern</Link>
        </p>
      </div>
    )
  }
  return (
    <div className="karte">
      <h1>Neues Passwort</h1>
      <Formular aktion={passwortNeu} knopf="Passwort speichern" testId="passwort-neu">
        <input type="hidden" name="token" value={token} />
        <label>
          Neues Passwort (mindestens 12 Zeichen)
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
        <Link href="/passwort-vergessen">Neuen Link anfordern</Link>
      </p>
    </div>
  )
}
