import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { NavIcon, Zaehler } from '@/components/navigation'
import { ladeNavigation } from '@/lib/navigation'

/** Zweitrangige Bereiche für die Tab-Leiste auf dem Handy. */
export default async function MehrSeite() {
  const nav = await ladeNavigation()
  // Bereiche ohne eigenen Tab (Finanzen, Abschluss & Steuer) mit Zählern, darunter Einstellungen
  // (Profil mit Sicherheit, Datenschutz und Abmelden; Verwaltung der Eigentümerschaft).
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
          <p className="nav-titel">Weitere Bereiche</p>
          <ul className="mehr-liste" style={{ marginBottom: 16 }} data-testid="mehr-fach">
            {fach.map(eintrag)}
          </ul>
        </>
      ) : null}
      <p className="nav-titel">Einstellungen</p>
      <ul className="mehr-liste">{nav.verwaltung.map(eintrag)}</ul>
    </>
  )
}
