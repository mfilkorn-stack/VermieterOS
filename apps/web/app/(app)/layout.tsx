import { ArrowLeftRight, Building2 } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { NavGruppe, ProfilLink, TabLeiste } from '@/components/navigation'
import { Hinweis } from '@/components/hinweis'
import { HINWEIS_COOKIE, liesHinweis } from '@/lib/hinweis'
import { ladeNavigation } from '@/lib/navigation'
import { bereichPfade } from '@/lib/bereiche'
import { erfordereGesicherteSitzung } from '@/lib/sitzung'

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
  const hinweis = await liesHinweis()
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
          <Link href="/mandanten" className="mandant-block" title="Eigentümerschaft wechseln">
            <span className="text">
              <strong>{nav.mandant?.name ?? 'Eigentümerschaft wählen'}</strong>
              <small>{nav.mandant?.rolle ?? 'keine ausgewählt'}</small>
            </span>
            <ArrowLeftRight size={16} strokeWidth={1.75} aria-hidden />
          </Link>
          <nav aria-label="Hauptmenü" className="nav-gruppe" style={{ gap: 20 }}>
            <NavGruppe eintraege={nav.haupt} />
          </nav>
          <div className="nav-fuss">
            <ProfilLink
              name={s.user.name}
              initialen={initialen(s.user.name)}
              bereiche={bereichPfade('einstellungen')}
            />
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
          {nav.mandant?.name ?? 'Eigentümerschaft wählen'}
        </Link>
      </header>
      <main className="inhalt">
        {hinweis ? <Hinweis text={hinweis} cookie={HINWEIS_COOKIE} /> : null}
        {children}
      </main>
      <TabLeiste eintraege={nav.tabs} />
    </div>
  )
}
