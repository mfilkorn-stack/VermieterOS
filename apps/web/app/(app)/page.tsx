import { datenqualitaet, schema } from '@vermieteros/db'
import { MODULE, type Ampel, type Modul } from '@vermieteros/rechenkern'
import { sql } from 'drizzle-orm'
import Link from 'next/link'
import { ROLLEN_TEXT } from '@/lib/rechte'
import { darf, mitMandant } from '@/lib/sitzung'

const MODUL_TEXT: Record<Modul, string> = {
  stammdaten: 'Stammdaten',
  nebenkosten: 'Nebenkosten',
  steuerpaket: 'Steuerpaket',
  mieterhoehung: 'Mieterhöhung',
  finanzen: 'Finanzen',
}

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
      <h1 data-testid="mandant-name">{mandant?.name}</h1>
      <p className="leise">Deine Rolle: {ROLLEN_TEXT[rolle]}</p>

      <div className="zeile">
        <h2>Objekte</h2>
        {schreiben ? (
          <Link className="knopf" href="/objekte/neu" data-testid="objekt-neu">
            Objekt anlegen
          </Link>
        ) : null}
      </div>
      {objekte.length === 0 ? (
        <p className="leise">Noch keine Objekte.</p>
      ) : (
        <ul className="liste" data-testid="objektliste">
          {objekte.map((o) => (
            <li key={o.id} className="karte">
              <strong>{o.bezeichnung}</strong>
              {o.ort ? <span className="leise"> · {o.ort}</span> : null}
              {o.ampel ? (
                <div className="ampeln" aria-label="Datenqualität">
                  {MODULE.map((m) => (
                    <span key={m} className={`ampel ampel-${o.ampel![m]}`} title={o.ampel![m]}>
                      {MODUL_TEXT[m]}
                    </span>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
