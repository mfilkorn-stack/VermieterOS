import { ArrowLeftRight, ChevronRight, FileLock, LogOut, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { NavIcon, Zaehler } from '@/components/navigation'
import { ladeNavigation } from '@/lib/navigation'
import { abmelden } from '../../(oeffentlich)/aktionen'

/** Zweitrangige Bereiche für die Tab-Leiste auf dem Handy. */
export default async function MehrSeite() {
  const nav = await ladeNavigation()
  // Fachbereiche ohne eigenen Tab (Betriebskosten, Journal, Steuer, Abschluss) mit Zählern,
  // darunter die Verwaltung.
  const fach = nav.haupt.filter((e) => !nav.tabs.some((t) => t.href === e.href))
  const eintrag = (e: (typeof nav.haupt)[number]) => (
    <li key={e.href}>
      <Link href={e.href}>
        <NavIcon name={e.icon} size={20} />
        <span className="label">{e.label}</span>
        {e.zaehler ? <Zaehler z={e.zaehler} /> : null}
        <ChevronRight size={16} aria-hidden />
      </Link>
    </li>
  )
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
      {fach.length ? (
        <>
          <p className="nav-titel">Finanzen und Fristen</p>
          <ul className="mehr-liste" style={{ marginBottom: 16 }} data-testid="mehr-fach">
            {fach.map(eintrag)}
          </ul>
        </>
      ) : null}
      <p className="nav-titel">Verwaltung</p>
      <ul className="mehr-liste">
        {nav.verwaltung.map(eintrag)}
        <li>
          <Link href="/mandanten">
            <ArrowLeftRight size={20} strokeWidth={1.75} aria-hidden />
            <span className="label">Mandant wechseln</span>
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
