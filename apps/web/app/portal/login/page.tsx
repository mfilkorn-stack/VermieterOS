import { redirect } from 'next/navigation'
import { Formular } from '@/components/formular'
import { portalKontext } from '@/lib/portal'
import { linkAnfordern } from '../aktionen'

export default async function PortalLogin() {
  if (await portalKontext()) redirect('/portal')
  return (
    <div className="karte">
      <h1>Anmelden</h1>
      <p className="leise">
        Geben Sie die E-Mail-Adresse an, die Ihr Vermieter für das Portal hinterlegt hat. Sie
        bekommen einen Anmeldelink, ein Passwort brauchen Sie nicht.
      </p>
      <Formular aktion={linkAnfordern} knopf="Link anfordern" testId="portal-login">
        <label>
          E-Mail
          <input name="email" type="email" autoComplete="email" required />
        </label>
      </Formular>
    </div>
  )
}
