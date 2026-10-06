import { Formular } from '@/components/formular'
import { sicheresZiel } from '@/lib/sitzung'
import { zweiFaktorAnmelden } from '../../aktionen'

export default async function ZweiFaktorSeite({
  searchParams,
}: {
  searchParams: Promise<{ weiter?: string }>
}) {
  const weiter = sicheresZiel((await searchParams).weiter)
  return (
    <div className="karte">
      <h1>Bestätigungscode</h1>
      <p className="leise">Den sechsstelligen Code aus der Authenticator-App eingeben.</p>
      <Formular aktion={zweiFaktorAnmelden} knopf="Bestätigen" testId="zwei-faktor">
        <input type="hidden" name="weiter" value={weiter} />
        <label>
          Code
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            required
          />
        </label>
      </Formular>
    </div>
  )
}
