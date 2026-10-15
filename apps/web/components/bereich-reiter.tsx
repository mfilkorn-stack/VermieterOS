import Link from 'next/link'
import { BEREICHE, type BereichName } from '@/lib/bereiche'
import { darf } from '@/lib/sitzung'

/**
 * Reiter eines Menübereichs oben auf der Seite (z. B. Belege · Journal · Betriebskosten).
 * Nur Seiten mit Leserecht; bei einer einzigen sichtbaren Seite entfällt die Leiste.
 */
export async function BereichReiter({ bereich, aktiv }: { bereich: BereichName; aktiv: string }) {
  const seiten = []
  for (const s of BEREICHE[bereich]) {
    if (!('recht' in s) || (await darf(s.recht))) seiten.push(s)
  }
  if (seiten.length < 2) return null
  return (
    <nav className="reiter bereich-reiter" aria-label="Bereich" data-testid="bereich-reiter">
      {seiten.map((s) => (
        <Link key={s.href} href={s.href} aria-current={s.href === aktiv ? 'page' : undefined}>
          {s.label}
        </Link>
      ))}
    </nav>
  )
}
