import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Formular } from '@/components/formular'
import { Status } from '@/components/status'
import { ladeBkFristen, STUFE_TEXT, STUFE_TON } from '@/lib/bk-fristen'
import { datumAnzeige } from '@/lib/format'
import { darf, mitMandant } from '@/lib/sitzung'
import { bkAnlegen } from './aktionen'

/** Übersicht der Betriebskostenabrechnungen mit Frist-Wächter (WP 2.5). */
export default async function BetriebskostenUebersicht() {
  if (!(await darf({ stammdaten: ['lesen'] }))) redirect('/')
  const schreiben = await darf({ stammdaten: ['schreiben'] })
  const fristen = await mitMandant((tx) => ladeBkFristen(tx))
  return (
    <>
      <div className="seitenkopf">
        <div>
          <h1>Betriebskosten</h1>
          <p className="leise">
            Abrechnungen der letzten beiden Jahre je vermieteter Einheit. Die Abrechnung muss dem
            Mieter innerhalb von zwölf Monaten nach Ende des Zeitraums zugehen (§ 556 Abs. 3 BGB);
            Warnung ab Monat 9, Eskalation ab Monat 11.
          </p>
        </div>
      </div>
      <div className="karte tabelle-scroll">
        {fristen.length === 0 ? (
          <p className="leise">
            Keine Abrechnungen fällig. Fristen erscheinen hier, sobald eine Einheit vermietet ist
            und ein Abrechnungsjahr abgeschlossen ist.
          </p>
        ) : (
          <table className="vergleich" data-testid="bk-fristen">
            <thead>
              <tr>
                <th>Jahr</th>
                <th>Objekt · Einheit</th>
                <th>Stand</th>
                <th>Frist</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {fristen.map((f) => (
                <tr key={f.einheitId + f.jahr} data-testid="bk-frist" data-stufe={f.stufe}>
                  <td>{f.jahr}</td>
                  <td>
                    {f.objekt} · {f.einheit}
                  </td>
                  <td>
                    <Status ton={STUFE_TON[f.stufe]}>{STUFE_TEXT[f.stufe]}</Status>{' '}
                    <span className="leise">
                      {f.status === 'festgeschrieben'
                        ? 'festgeschrieben'
                        : f.status === 'entwurf'
                          ? 'Entwurf'
                          : 'nicht angelegt'}
                    </span>
                  </td>
                  <td>{datumAnzeige(f.fristBis)}</td>
                  <td>
                    {f.abrechnungId ? (
                      <Link href={`/betriebskosten/${f.abrechnungId}`}>Öffnen</Link>
                    ) : schreiben ? (
                      <Formular aktion={bkAnlegen} knopf="Abrechnung anlegen" zweit>
                        <input type="hidden" name="einheitId" value={f.einheitId} />
                        <input type="hidden" name="jahr" value={f.jahr} />
                      </Formular>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
