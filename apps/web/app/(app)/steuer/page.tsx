import { listeSteuerpakete } from '@vermieteros/db'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Status } from '@/components/status'
import { euroAnzeige } from '@/lib/format'
import { objektliste } from '@/lib/objekte'
import { darf, mitMandant } from '@/lib/sitzung'
import { STATUS_TEXT, steuerJahre } from '@/lib/steuer'
import { heuteBerlin } from '@/lib/zeit'

/** Steuerpakete je Objekt für das Vorjahr und das Jahr davor (WP 2.6). */
export default async function SteuerUebersicht() {
  if (!(await darf({ stammdaten: ['lesen'] }))) redirect('/')
  const jahre = steuerJahre(heuteBerlin())
  const { objekte, pakete } = await mitMandant(async (tx) => ({
    objekte: await objektliste(tx),
    pakete: await listeSteuerpakete(tx),
  }))
  return (
    <>
      <div className="seitenkopf">
        <div>
          <h1>Steuer</h1>
          <p className="leise">
            Einkünfte aus Vermietung je Objekt als Vorbereitung der Anlage V. Festgeschrieben
            entsteht ein Paket (ZIP) mit Übersicht, Journal, Belegen und Prüfsummen für den
            Steuerberater.
          </p>
        </div>
      </div>
      <div className="karte tabelle-scroll">
        {objekte.length === 0 ? (
          <p className="leise">Noch keine Objekte.</p>
        ) : (
          <table className="vergleich" data-testid="steuer-uebersicht">
            <thead>
              <tr>
                <th>Objekt</th>
                {jahre.map((j) => (
                  <th key={j}>{j}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {objekte.map((o) => (
                <tr key={o.id}>
                  <td>{o.bezeichnung}</td>
                  {jahre.map((j) => {
                    const p = pakete.find((x) => x.objektId === o.id && x.jahr === j)
                    const status = (p?.status ?? 'offen') as keyof typeof STATUS_TEXT
                    return (
                      <td key={j} data-testid="steuer-zelle" data-status={status}>
                        <Link href={'/steuer/' + o.id + '/' + j}>
                          <Status ton={status === 'festgeschrieben' ? 'gruen' : 'neutral'}>
                            {STATUS_TEXT[status]}
                          </Status>
                        </Link>
                        {p?.ueberschussCent != null ? (
                          <span className="leise"> {euroAnzeige(p.ueberschussCent)}</span>
                        ) : null}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
