'use client'

import { useActionState } from 'react'
import { zweiFaktorBestaetigen, zweiFaktorStarten, type EinrichtungStatus } from './aktionen'

export function ZweiFaktorEinrichten({ weiter }: { weiter: string }) {
  const [start, startAktion, startLaeuft] = useActionState<EinrichtungStatus, FormData>(
    zweiFaktorStarten,
    {},
  )
  const [best, bestAktion, bestLaeuft] = useActionState<EinrichtungStatus, FormData>(
    zweiFaktorBestaetigen,
    {},
  )

  if (!start.qrSvg) {
    return (
      <form action={startAktion} data-testid="zwei-faktor-start">
        <label>
          Passwort zur Bestätigung
          <input name="passwort" type="password" autoComplete="current-password" required />
        </label>
        {start.fehler ? (
          <p role="alert" className="fehler">
            {start.fehler}
          </p>
        ) : null}
        <button type="submit" disabled={startLaeuft}>
          Einrichtung starten
        </button>
      </form>
    )
  }

  return (
    <div>
      <p>QR-Code mit einer Authenticator-App scannen (z. B. Aegis, 2FAS, Google Authenticator).</p>
      <div className="qr" dangerouslySetInnerHTML={{ __html: start.qrSvg }} />
      <p className="leise">
        Oder manuell eingeben: <code data-testid="totp-geheimnis">{start.geheimnis}</code>
      </p>
      <details>
        <summary>Notfall-Codes (einmal sicher aufbewahren)</summary>
        <ul>
          {start.backupCodes?.map((c) => (
            <li key={c}>
              <code>{c}</code>
            </li>
          ))}
        </ul>
      </details>
      <form action={bestAktion} data-testid="zwei-faktor-bestaetigen">
        <input type="hidden" name="weiter" value={weiter} />
        <label>
          Code aus der App
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            required
          />
        </label>
        {best.fehler ? (
          <p role="alert" className="fehler">
            {best.fehler}
          </p>
        ) : null}
        <button type="submit" disabled={bestLaeuft}>
          Aktivieren
        </button>
      </form>
    </div>
  )
}
