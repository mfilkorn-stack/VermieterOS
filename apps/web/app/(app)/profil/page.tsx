import { ArrowLeftRight, ChevronRight, FileLock, LogOut, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { BereichReiter } from '@/components/bereich-reiter'
import { ladeNavigation } from '@/lib/navigation'
import { erfordereGesicherteSitzung, mandantOderNull } from '@/lib/sitzung'
import { abmelden } from '../../(oeffentlich)/aktionen'

/**
 * Profil: das eigene Konto mit Sicherheit, Datenschutz, Wechsel der Eigentümerschaft und
 * Abmelden. Erster Reiter der Einstellungen, auch ohne aktive Eigentümerschaft erreichbar.
 */
export default async function ProfilSeite() {
  const s = await erfordereGesicherteSitzung()
  const k = await mandantOderNull()
  const nav = await ladeNavigation()
  return (
    <>
      {k ? <BereichReiter bereich="einstellungen" aktiv="/profil" /> : null}
      <h1>Profil</h1>
      <dl className="karte kopfdaten" data-testid="profil">
        <dt>Name</dt>
        <dd>{s.user.name}</dd>
        <dt>E-Mail</dt>
        <dd>{s.user.email}</dd>
        <dt>Eigentümerschaft</dt>
        <dd>{nav.mandant ? nav.mandant.name + ' · ' + nav.mandant.rolle : 'keine ausgewählt'}</dd>
      </dl>
      <ul className="mehr-liste" style={{ marginBottom: 16 }}>
        <li>
          <Link href="/sicherheit">
            <ShieldCheck size={20} strokeWidth={1.75} aria-hidden />
            <span className="label">Sicherheit: Passwort und Zwei-Faktor</span>
            <ChevronRight size={16} aria-hidden />
          </Link>
        </li>
        <li>
          <Link href="/mandanten">
            <ArrowLeftRight size={20} strokeWidth={1.75} aria-hidden />
            <span className="label">Eigentümerschaft wechseln oder anlegen</span>
            <ChevronRight size={16} aria-hidden />
          </Link>
        </li>
        <li>
          <Link href="/datenschutz">
            <FileLock size={20} strokeWidth={1.75} aria-hidden />
            <span className="label">Datenschutz</span>
            <ChevronRight size={16} aria-hidden />
          </Link>
        </li>
      </ul>
      <form action={abmelden}>
        <button type="submit" className="zweit" data-testid="abmelden">
          <LogOut size={18} strokeWidth={1.75} aria-hidden />
          Abmelden
        </button>
      </form>
    </>
  )
}
