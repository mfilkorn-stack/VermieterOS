import type { Ampel, Modul } from '@vermieteros/rechenkern'
import { Building2, ChevronRight, MapPin } from 'lucide-react'
import Link from 'next/link'
import { ModulAmpeln } from './status'

export type ObjektKachel = {
  id: string
  bezeichnung: string
  ort: string | null
  ampel: Record<Modul, Ampel> | null
}

/** Objektkarten mit Ampeln; die ganze Karte ist klickbar (Stretched Link auf dem Titel). */
export function ObjektListe({
  objekte,
  schreiben,
}: {
  objekte: ObjektKachel[]
  schreiben: boolean
}) {
  if (objekte.length === 0)
    return (
      <p className="leise" data-testid="objekte-leer">
        Noch keine Objekte.{' '}
        {schreiben ? (
          <Link href="/objekte/neu">Lege das erste Objekt an</Link>
        ) : (
          'Ein Eigentümer legt das erste Objekt an.'
        )}
      </p>
    )
  return (
    <ul className="liste" data-testid="objektliste">
      {objekte.map((o) => (
        <li key={o.id} className="karte objektkarte klickbar">
          <div className="objektkarte-kopf">
            <span className="icon-kachel">
              <Building2 size={20} strokeWidth={1.75} aria-hidden />
            </span>
            <span className="objektkarte-titel">
              <Link href={`/objekte/${o.id}`}>
                <strong>{o.bezeichnung}</strong>
              </Link>
              {o.ort ? (
                <span className="meta">
                  <span>
                    <MapPin size={14} aria-hidden />
                    {o.ort}
                  </span>
                </span>
              ) : null}
            </span>
            <ChevronRight size={18} color="var(--dezent)" aria-hidden />
          </div>
          {o.ampel ? <ModulAmpeln ampel={o.ampel} /> : null}
        </li>
      ))}
    </ul>
  )
}
