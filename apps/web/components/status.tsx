import { MODULE, type Ampel, type Modul } from '@vermieteros/rechenkern'
import {
  CircleCheck,
  CircleX,
  ClipboardList,
  Landmark,
  Receipt,
  TrendingUp,
  TriangleAlert,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

export const MODUL_TEXT: Record<Modul, string> = {
  stammdaten: 'Stammdaten',
  nebenkosten: 'Nebenkosten',
  steuerpaket: 'Steuerpaket',
  mieterhoehung: 'Mieterhöhung',
  finanzen: 'Finanzen',
}

/** Jedes Modul hat sein festes Icon: in Kacheln, Befund-Gruppen und später im Menü. */
export const MODUL_ICON: Record<Modul, LucideIcon> = {
  stammdaten: ClipboardList,
  nebenkosten: Receipt,
  steuerpaket: Landmark,
  mieterhoehung: TrendingUp,
  finanzen: Wallet,
}

const AMPEL: Record<Ampel, { text: string; icon: LucideIcon }> = {
  gruen: { text: 'vollständig', icon: CircleCheck },
  gelb: { text: 'prüfen', icon: TriangleAlert },
  rot: { text: 'unvollständig', icon: CircleX },
}

/** Status als Icon plus Wort, nie nur Farbe. */
export function Status({
  ton,
  icon: Icon,
  children,
  testId,
}: {
  ton: Ampel | 'neutral'
  icon?: LucideIcon
  children: React.ReactNode
  testId?: string
}) {
  return (
    <span className={`status status-${ton}`} data-testid={testId}>
      {Icon ? <Icon size={15} strokeWidth={2} aria-hidden /> : null}
      {children}
    </span>
  )
}

export function AmpelStatus({ ampel, text }: { ampel: Ampel; text?: string }) {
  const a = AMPEL[ampel]
  return (
    <Status ton={ampel} icon={a.icon}>
      {text ?? a.text}
    </Status>
  )
}

/** Kompakte Ampel pro Modul für Listen: Modulname mit Status-Icon. */
export function ModulAmpeln({ ampel }: { ampel: Record<Modul, Ampel> }) {
  return (
    <div className="ampeln" aria-label="Datenqualität">
      {MODULE.map((m) => {
        const a = AMPEL[ampel[m]]
        return (
          <Status key={m} ton={ampel[m]} icon={a.icon}>
            {MODUL_TEXT[m]}
            <span className="sr-only">: {a.text}</span>
          </Status>
        )
      })}
    </div>
  )
}
