import type { ZuordnungsKandidat } from '@vermieteros/db'
import { Building2, CircleCheck, CircleDot, HardHat, Link2 } from 'lucide-react'
import Link from 'next/link'
import { mietverhaeltnisText, ZUORDNUNG_TEXT } from '@/lib/post-text'
import { Status } from './status'

export type ZuordnungStand = {
  mietverhaeltnisId: string | null
  objektId: string | null
  handwerkerId: string | null
  art: keyof typeof ZUORDNUNG_TEXT
  begruendung: string | null
}

export type Zielnamen = {
  kandidaten: Map<string, ZuordnungsKandidat>
  objekte: Map<string, string>
  handwerker: Map<string, string>
}

/** Ziel der aktuellen Zuordnung als Status mit Link; „Nicht zugeordnet“, wenn keins. */
export function ZuordnungAnzeige({ z, namen }: { z: ZuordnungStand | null; namen: Zielnamen }) {
  const mv = z?.mietverhaeltnisId ? namen.kandidaten.get(z.mietverhaeltnisId) : undefined
  if (z && mv)
    return (
      <>
        <Status ton="gruen" icon={Link2}>
          Zugeordnet
        </Status>
        <Link href={`/mietverhaeltnisse/${mv.mietverhaeltnisId}`}>{mietverhaeltnisText(mv)}</Link>
        <span>({ZUORDNUNG_TEXT[z.art]})</span>
      </>
    )
  if (z?.objektId)
    return (
      <>
        <Status ton="gruen" icon={Building2}>
          Objekt
        </Status>
        <Link href={`/objekte/${z.objektId}`}>{namen.objekte.get(z.objektId) ?? 'Objekt'}</Link>
      </>
    )
  if (z?.handwerkerId)
    return (
      <>
        <Status ton="gruen" icon={HardHat}>
          Handwerker
        </Status>
        <Link href={`/handwerker/${z.handwerkerId}`}>
          {namen.handwerker.get(z.handwerkerId) ?? 'Handwerker'}
        </Link>
      </>
    )
  if (z?.art === 'erledigt')
    return (
      <>
        <Status ton="neutral" icon={CircleCheck}>
          Erledigt
        </Status>
        {z.begruendung ? <span>{z.begruendung}</span> : null}
      </>
    )
  return (
    <Status ton="gelb" icon={CircleDot}>
      Nicht zugeordnet{z ? ` · ${ZUORDNUNG_TEXT[z.art]}` : ''}
    </Status>
  )
}
