import { datenqualitaet, schema } from '@vermieteros/db'
import { type Ampel, type Modul } from '@vermieteros/rechenkern'
import { sql } from 'drizzle-orm'
import { Building2, ChevronRight, MapPin, Plus } from 'lucide-react'
import Link from 'next/link'
import { ModulAmpeln } from '@/components/status'
import { ROLLEN_TEXT } from '@/lib/rechte'
import { darf, mitMandant } from '@/lib/sitzung'

export default async function Startseite() {
  const { mandant, rolle, objekte } = await mitMandant(async (tx, k) => {
    const [m] = await tx.select().from(schema.mandanten)
    const rows = await tx.execute<{ objekt_id: string; bezeichnung: string; ort: string | null }>(
      sql`select objekt_id, bezeichnung, ort from objekte_aktuell order by bezeichnung`,
    )
    const objekte: Array<{
      id: string
      bezeichnung: string
      ort: string | null
      ampel: Record<Modul, Ampel> | null
    }> = []
    for (const r of rows) {
      const q = await datenqualitaet(tx, r.objekt_id)
      objekte.push({
        id: r.objekt_id,
        bezeichnung: r.bezeichnung,
        ort: r.ort,
        ampel: q?.ampel ?? null,
      })
    }
    return { mandant: m, rolle: k.rolle, objekte }
  })
  const schreiben = await darf({ stammdaten: ['schreiben'] })

  return (
    <>
      <div className="seitenkopf">
        <div>
          <h1 data-testid="mandant-name">{mandant?.name}</h1>
          <p className="leise">Deine Rolle: {ROLLEN_TEXT[rolle]}</p>
        </div>
        {schreiben ? (
          <Link className="knopf" href="/objekte/neu" data-testid="objekt-neu">
            <Plus size={18} aria-hidden />
            Objekt anlegen
          </Link>
        ) : null}
      </div>

      <h2>Objekte</h2>
      {objekte.length === 0 ? (
        <p className="leise">Noch keine Objekte.</p>
      ) : (
        <ul className="liste" data-testid="objektliste">
          {objekte.map((o) => (
            <li key={o.id} className="karte objektkarte">
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
      )}
    </>
  )
}
