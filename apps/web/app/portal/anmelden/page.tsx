import Link from 'next/link'
import { Formular } from '@/components/formular'
import { linkEinloesen } from '../aktionen'

/**
 * Ziel des Anmeldelinks. Eingelöst wird erst mit dem Knopf: Virenscanner der Mailprogramme
 * öffnen Links vorab, ein Einlösen beim Öffnen würde den Einmal-Link verbrauchen.
 */
export default async function PortalAnmelden({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  if (!token) {
    return (
      <div className="karte">
        <h1>Link unvollständig</h1>
        <p>
          <Link href="/portal/login">Neuen Anmeldelink anfordern</Link>
        </p>
      </div>
    )
  }
  return (
    <div className="karte">
      <h1>Mieterportal öffnen</h1>
      <p className="leise">Sie bleiben auf diesem Gerät 30 Tage angemeldet.</p>
      <Formular aktion={linkEinloesen} knopf="Jetzt anmelden" testId="portal-anmelden">
        <input type="hidden" name="token" value={token} />
      </Formular>
      <p className="leise">
        <Link href="/portal/login">Neuen Link anfordern</Link>
      </p>
    </div>
  )
}
