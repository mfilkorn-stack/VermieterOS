'use client'

import {
  ArrowLeftRight,
  Building2,
  BookOpenText,
  Calculator,
  Ellipsis,
  HardHat,
  Inbox,
  Library,
  ReceiptText,
  Mail,
  ShieldCheck,
  UserCog,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

/** Icons als Namen, weil Komponenten nicht vom Server an den Client gereicht werden können. */
const ICONS = {
  objekte: Building2,
  posteingang: Inbox,
  tickets: Wrench,
  belege: ReceiptText,
  journal: BookOpenText,
  betriebskosten: Calculator,
  handwerker: HardHat,
  eigentuemer: Users,
  mitglieder: UserCog,
  postfaecher: Mail,
  referenzdaten: Library,
  mandanten: ArrowLeftRight,
  sicherheit: ShieldCheck,
  mehr: Ellipsis,
} satisfies Record<string, LucideIcon>

export type IconName = keyof typeof ICONS

export type NavEintrag = {
  href: string
  label: string
  icon: IconName
  /** Pfade, unter denen der Eintrag als aktiv gilt (Präfix). Ohne Angabe: `href`. */
  bereiche?: string[]
  /** Handlung = Amber (es wartet Arbeit), Menge = Grau (nur Information). */
  zaehler?: { n: number; art: 'handlung' | 'menge'; text: string }
}

function aktiv(pfad: string, e: NavEintrag): boolean {
  const bereiche = e.bereiche ?? [e.href]
  return bereiche.some((b) => (b === '/' ? pfad === '/' : pfad === b || pfad.startsWith(`${b}/`)))
}

function Zaehler({ z }: { z: NonNullable<NavEintrag['zaehler']> }) {
  if (z.n === 0) return null
  return (
    <span className={`zaehler zaehler-${z.art}`} title={z.text}>
      {z.n}
      <span className="sr-only"> {z.text}</span>
    </span>
  )
}

export function NavIcon({ name, size = 18 }: { name: IconName; size?: number }) {
  const Icon = ICONS[name]
  return <Icon size={size} strokeWidth={1.75} aria-hidden />
}

/** Gruppe in der Seitenleiste (ab 960 px). */
export function NavGruppe({ titel, eintraege }: { titel?: string; eintraege: NavEintrag[] }) {
  const pfad = usePathname()
  if (eintraege.length === 0) return null
  return (
    <div className="nav-gruppe">
      {titel ? <p className="nav-titel">{titel}</p> : null}
      {eintraege.map((e) => (
        <Link
          key={e.href}
          href={e.href}
          className="nav-link"
          aria-current={aktiv(pfad, e) ? 'page' : undefined}
        >
          <NavIcon name={e.icon} />
          <span className="label">{e.label}</span>
          {e.zaehler ? <Zaehler z={e.zaehler} /> : null}
        </Link>
      ))}
    </div>
  )
}

/** Tab-Leiste unten auf dem Handy. */
export function TabLeiste({ eintraege }: { eintraege: NavEintrag[] }) {
  const pfad = usePathname()
  return (
    <nav className="tableiste" aria-label="Hauptmenü">
      {eintraege.map((e) => (
        <Link
          key={e.href}
          href={e.href}
          className="tab"
          aria-current={aktiv(pfad, e) ? 'page' : undefined}
        >
          <span className="tab-icon">
            <NavIcon name={e.icon} size={22} />
            {e.zaehler ? <Zaehler z={e.zaehler} /> : null}
          </span>
          {e.label}
        </Link>
      ))}
    </nav>
  )
}
