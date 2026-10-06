import { ladeReferenzdaten } from '@vermieteros/db'
import { referenzwert, type ReferenzEintrag, type ReferenzStatus } from '@vermieteros/rechenkern'
import { BUNDESLAENDER, BUNDESLAND_NAME } from '@vermieteros/schema'
import { datumAnzeige, prozentText } from '@/lib/format'
import { mitMandant } from '@/lib/sitzung'

const STATUS_TEXT: Record<ReferenzStatus, string> = {
  gueltig: 'aktuell und geprüft',
  ungeprueft: 'Prüfung fällig',
  abgelaufen: 'ausgelaufen',
  fehlt: 'kein Wert',
}
const STATUS_AMPEL: Record<ReferenzStatus, string> = {
  gueltig: 'gruen',
  ungeprueft: 'gelb',
  abgelaufen: 'gelb',
  fehlt: 'rot',
}

type Reihe = {
  schluessel: string
  name: string
  eintraege: ReferenzEintrag<{ satzPromille: number }>[]
}

export default async function ReferenzdatenSeite() {
  const heute = new Date().toISOString().slice(0, 10)
  const reihen: Reihe[] = await mitMandant(async (tx) => {
    const out: Reihe[] = []
    for (const bl of BUNDESLAENDER) {
      out.push({
        schluessel: bl,
        name: BUNDESLAND_NAME[bl],
        eintraege: await ladeReferenzdaten<{ satzPromille: number }>(tx, 'grunderwerbsteuer', bl),
      })
    }
    return out
  })

  return (
    <>
      <h1>Referenzdaten</h1>
      <p className="leise">
        Werte von außen, mit Gültigkeit, Quelle und Prüffrist. Ist ein Wert nicht mehr geprüft oder
        ausgelaufen, warnt die Software, statt still weiterzurechnen. AfA-Sätze stehen nicht hier:
        sie hängen am Baujahr und sind mit Gesetzeszitat im Rechenkern hinterlegt.
      </p>
      <h2>Grunderwerbsteuer</h2>
      <p className="leise">Maßgeblich ist das Datum des notariellen Kaufvertrags.</p>
      <ul className="liste" data-testid="referenz-grest">
        {reihen.map((r) => {
          const jetzt = referenzwert(r.eintraege, heute, heute)
          const sortiert = [...r.eintraege].sort((a, b) =>
            a.gueltigVon === b.gueltigVon
              ? a.erfasstAm < b.erfasstAm
                ? 1
                : -1
              : a.gueltigVon < b.gueltigVon
                ? 1
                : -1,
          )
          return (
            <li
              key={r.schluessel}
              className="karte"
              data-testid={`referenz-${r.schluessel}`}
              data-status={jetzt.status}
            >
              <div className="zeile">
                <strong>{r.name}</strong>
                <span className={`ampel ampel-${STATUS_AMPEL[jetzt.status]}`}>
                  {jetzt.eintrag ? `${prozentText(jetzt.eintrag.wert.satzPromille)} % · ` : ''}
                  {STATUS_TEXT[jetzt.status]}
                </span>
              </div>
              <details>
                <summary>Verlauf und Quellen</summary>
                <ul>
                  {sortiert.map((e) => (
                    <li key={e.id}>
                      {prozentText(e.wert.satzPromille)} % ab {datumAnzeige(e.gueltigVon)}
                      {e.gueltigBis ? ` bis ${datumAnzeige(e.gueltigBis)}` : ''} · {e.quelle}
                      {e.mandantId ? ' · eigener Wert' : ''} · geprüft {datumAnzeige(e.geprueftAm)},
                      erneut prüfen bis {datumAnzeige(e.pruefenBis)}
                      {e.hinweis ? <span className="leise"> · {e.hinweis}</span> : null}
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          )
        })}
      </ul>
    </>
  )
}
