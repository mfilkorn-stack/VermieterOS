import { headers } from 'next/headers'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { erfordereGesicherteSitzung } from '@/lib/sitzung'
import { mandantAktivieren } from '../aktionen'

export default async function MandantenSeite() {
  const s = await erfordereGesicherteSitzung()
  const h = await headers()
  // Einladungen sind nur mit bestätigter E-Mail sichtbar (Schutz gegen fremde Adressen).
  const [mandanten, einladungen] = await Promise.all([
    auth.api.listOrganizations({ headers: h }),
    s.user.emailVerified ? auth.api.listUserInvitations({ headers: h }) : Promise.resolve([]),
  ])
  const offen = einladungen.filter((e) => e.status === 'pending')
  const aktiv = s.session.activeOrganizationId

  return (
    <>
      <div className="zeile">
        <h1>Eigentümerschaften</h1>
        <Link className="knopf" href="/mandanten/neu" data-testid="mandant-neu">
          Eigentümerschaft anlegen
        </Link>
      </div>
      <p className="leise">
        Eine Eigentümerschaft bist du allein, ein Ehepaar, eine Bruchteilsgemeinschaft oder eine
        GbR. Jede hat ihre eigenen Immobilien, Belege und Zugänge; Daten anderer Eigentümerschaften
        sind darin nie sichtbar.
      </p>
      {mandanten.length === 0 ? <p>Du gehörst noch zu keiner Eigentümerschaft.</p> : null}
      <ul className="liste" data-testid="mandantenliste">
        {mandanten.map((m) => (
          <li key={m.id} className="karte zeile">
            <span>
              <strong>{m.name}</strong>
              {m.id === aktiv ? <span className="leise"> · aktiv</span> : null}
            </span>
            {m.id !== aktiv ? (
              <form action={mandantAktivieren}>
                <input type="hidden" name="id" value={m.id} />
                <button type="submit" className="zweit">
                  Wechseln
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
      {!s.user.emailVerified ? (
        <p className="leise" data-testid="email-unbestaetigt">
          Einladungen in andere Eigentümerschaften erscheinen erst nach Bestätigung deiner
          E-Mail-Adresse. <Link href="/sicherheit">Jetzt bestätigen</Link>
        </p>
      ) : null}
      {offen.length > 0 ? (
        <>
          <h2>Offene Einladungen</h2>
          <ul className="liste">
            {offen.map((e) => (
              <li key={e.id} className="karte">
                <Link href={`/einladungen/${e.id}`}>Einladung ansehen</Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  )
}
