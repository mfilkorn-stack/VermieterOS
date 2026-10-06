import Link from 'next/link'
import { erfordereSitzung, sicheresZiel, ZWEI_FAKTOR_PFLICHT } from '@/lib/sitzung'
import { EmailBestaetigen } from './email'
import { ZweiFaktorEinrichten } from './einrichten'

export default async function SicherheitSeite({
  searchParams,
}: {
  searchParams: Promise<{ weiter?: string }>
}) {
  const weiter = sicheresZiel((await searchParams).weiter)
  const s = await erfordereSitzung(`/sicherheit?weiter=${encodeURIComponent(weiter)}`)
  return (
    <main>
      <div className="schmal karte">
        <h1>Zwei-Faktor-Anmeldung</h1>
        {s.user.twoFactorEnabled ? (
          <>
            <p>Ist für dein Konto aktiv.</p>
            <Link className="knopf" href={weiter}>
              Weiter
            </Link>
          </>
        ) : (
          <>
            <p className="leise">
              {ZWEI_FAKTOR_PFLICHT
                ? 'Für den Zugriff auf Mieter- und Finanzdaten ist ein zweiter Faktor Pflicht.'
                : 'Empfohlen. In dieser Umgebung ist die Pflicht abgeschaltet.'}
            </p>
            <ZweiFaktorEinrichten weiter={weiter} />
          </>
        )}
      </div>
      <div className="schmal karte">
        <h2>E-Mail-Adresse</h2>
        {s.user.emailVerified ? (
          <p>
            <strong>{s.user.email}</strong> ist bestätigt.
          </p>
        ) : (
          <EmailBestaetigen email={s.user.email} weiter={weiter} />
        )}
      </div>
    </main>
  )
}
