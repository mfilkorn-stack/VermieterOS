'use client'

import { useActionState } from 'react'
import { emailBestaetigungSenden, type BestaetigungStatus } from './aktionen'

export function EmailBestaetigen({ email, weiter }: { email: string; weiter: string }) {
  const [status, aktion, laeuft] = useActionState<BestaetigungStatus, FormData>(
    emailBestaetigungSenden,
    {},
  )
  return (
    <form action={aktion} data-testid="email-bestaetigen">
      <input type="hidden" name="weiter" value={weiter} />
      <p>
        <strong>{email}</strong> ist noch nicht bestätigt. Ohne Bestätigung lassen sich keine
        Einladungen annehmen.
      </p>
      {status.gesendet ? (
        <p className="leise">
          Bestätigungslink erzeugt. Bis der Mailversand eingerichtet ist (Phase 1), steht er im
          Server-Log.
        </p>
      ) : null}
      {status.fehler ? (
        <p role="alert" className="fehler">
          {status.fehler}
        </p>
      ) : null}
      <button type="submit" className="zweit" disabled={laeuft}>
        Bestätigungslink senden
      </button>
    </form>
  )
}
