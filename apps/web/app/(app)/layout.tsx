import { ArrowLeftRight, Building2, LogOut, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { NavGruppe, TabLeiste } from '@/components/navigation'
import { ladeNavigation } from '@/lib/navigation'
import { erfordereGesicherteSitzung } from '@/lib/sitzung'
import { abmelden } from '../(oeffentlich)/aktionen'

function initialen(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((t) => t[0]!.toUpperCase())
    .join('')
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const s = await erfordereGesicherteSitzung()
  const nav = await ladeNavigation()
  return (
    <div className="shell">
      <aside className="seitenleiste">
        <div className="seitenleiste-innen">
          <Link href="/" className="marke">
            <span className="marke-zeichen">
              <Building2 size={18} strokeWidth={2} aria-hidden />
            </span>
            <span className="marke-name">Vermieter.OS</span>
          </Link>
          <Link href="/mandanten" className="mandant-block" title="Mandant wechseln">
            <span className="text">
              <strong>{nav.mandant?.name ?? 'Mandant wählen'}</strong>
              <small>{nav.mandant?.rolle ?? 'kein Mandant aktiv'}</small>
            </span>
            <ArrowLeftRight size={16} strokeWidth={1.75} aria-hidden />
          </Link>
          <nav aria-label="Hauptmenü" className="nav-gruppe" style={{ gap: 20 }}>
            <NavGruppe eintraege={nav.haupt} />
            <NavGruppe titel="Verwaltung" eintraege={nav.verwaltung} />
          </nav>
          <div className="nav-fuss">
            <Link href="/sicherheit" className="nav-link">
              <ShieldCheck size={18} strokeWidth={1.75} aria-hidden />
              <span className="label">Sicherheit</span>
            </Link>
            <div className="nutzer">
              <span className="initialen" aria-hidden>
                {initialen(s.user.name)}
              </span>
              <span>{s.user.name}</span>
            </div>
            <form action={abmelden}>
              <button type="submit">
                <LogOut size={18} strokeWidth={1.75} aria-hidden />
                Abmelden
              </button>
            </form>
          </div>
        </div>
      </aside>
      <header className="mobilkopf">
        <Link href="/" className="marke">
          <span className="marke-zeichen">
            <Building2 size={18} strokeWidth={2} aria-hidden />
          </span>
          <span className="marke-name">Vermieter.OS</span>
        </Link>
        <Link href="/mandanten" className="mandant-kurz">
          {nav.mandant?.name ?? 'Mandant wählen'}
        </Link>
      </header>
      <main className="inhalt">{children}</main>
      <TabLeiste eintraege={nav.tabs} />
    </div>
  )
}
