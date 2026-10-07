import type { KiVorschlag } from '@vermieteros/db'
import { KATEGORIE_TEXT, type Sortierung } from '@vermieteros/ki'
import { CalendarClock, Siren, Sparkles, Tag, TriangleAlert } from 'lucide-react'
import { datumAnzeige } from '@/lib/format'
import { Status } from './status'

export function sortierungAus(v: KiVorschlag | undefined | null): Sortierung | null {
  return v ? (v.ausgabe as Sortierung) : null
}

/** Kategorie, Dringlichkeit und Frist als Badges; „normal“ und „niedrig“ ohne eigenes Badge. */
export function SortierBadges({ s }: { s: Sortierung }) {
  return (
    <span className="meta" data-testid="sortierung" title="Einschätzung der KI">
      <Sparkles size={14} aria-label="KI" color="var(--dezent)" />
      {s.dringlichkeit === 'notfall' ? (
        <Status ton="rot" icon={Siren}>
          Notfall
        </Status>
      ) : s.dringlichkeit === 'hoch' ? (
        <Status ton="gelb" icon={TriangleAlert}>
          dringend
        </Status>
      ) : null}
      <Status ton="neutral" icon={Tag}>
        {KATEGORIE_TEXT[s.kategorie]}
      </Status>
      {s.frist ? (
        <Status ton="gelb" icon={CalendarClock}>
          Frist {datumAnzeige(s.frist.datum)}
        </Status>
      ) : null}
    </span>
  )
}
