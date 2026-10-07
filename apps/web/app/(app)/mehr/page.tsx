import { ArrowLeftRight, ChevronRight, LogOut, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { NavIcon } from '@/components/navigation'
import { ladeNavigation } from '@/lib/navigation'
import { abmelden } from '../../(oeffentlich)/aktionen'

/** Zweitrangige Bereiche für die Tab-Leiste auf dem Handy. */
export default async function MehrSeite() {
  const nav = await ladeNavigation()
  return (
    <>
      <div className="seitenkopf">
        <div>
          <h1>Mehr</h1>
          {nav.mandant ? (
            <p className="leise">
              {nav.mandant.name} · {nav.mandant.rolle}
            </p>
          ) : null}
        </div>
      </div>
      <ul className="mehr-liste">
        {nav.verwaltung.map((e) => (
          <li key={e.href}>
            <Link href={e.href}>
              <NavIcon name={e.icon} size={20} />
              <span className="label">{e.label}</span>
              <ChevronRight size={16} aria-hidden />
            </Link>
          </li>
        ))}
        <li>
          <Link href="/mandanten">
            <ArrowLeftRight size={20} strokeWidth={1.75} aria-hidden />
            <span className="label">Mandant wechseln</span>
            <ChevronRight size={16} aria-hidden />
          </Link>
        </li>
        <li>
          <Link href="/sicherheit">
            <ShieldCheck size={20} strokeWidth={1.75} aria-hidden />
            <span className="label">Sicherheit</span>
            <ChevronRight size={16} aria-hidden />
          </Link>
        </li>
      </ul>
      <form action={abmelden} style={{ marginTop: 16 }}>
        <button type="submit" className="zweit">
          <LogOut size={18} strokeWidth={1.75} aria-hidden />
          Abmelden
        </button>
      </form>
    </>
  )
}
