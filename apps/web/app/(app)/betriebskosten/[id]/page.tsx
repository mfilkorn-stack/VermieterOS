import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { BkEditor } from '@/components/bk-editor'
import { Formular } from '@/components/formular'
import { Status } from '@/components/status'
import { ladeBkSeite, SCHLUESSEL_TEXT, zuRoh, type BkSeite } from '@/lib/bk'
import { datumAnzeige, dezimalText, euroAnzeige, euroText } from '@/lib/format'
import { darf, mitMandant } from '@/lib/sitzung'
import { bkSpeichern } from '../aktionen'

const TON = { fehler: 'rot', warnung: 'gelb', hinweis: 'neutral' } as const

function Ergebnis({ s }: { s: NonNullable<BkSeite> }) {
  const e = s.ergebnis!
  const mieter = new Map(s.nutzungen.map((n) => [n.mietverhaeltnisId, n]))
  return (
    <>
      {e.abrechnung.mieter.map((m) => {
        const n = mieter.get(m.id)
        const vz = e.vorauszahlungen[m.id]
        return (
          <div key={m.id} className="karte tabelle-scroll" data-testid="bk-ergebnis">
            <h2>
              {n?.mieter.join(', ') || 'Mieter'}{' '}
              <span className="leise">
                {datumAnzeige(m.zeitraum.von)} bis {datumAnzeige(m.zeitraum.bis)} ·{' '}
                {dezimalText(Math.round(m.monate * 100), 2)} Monate
              </span>
            </h2>
            <table className="vergleich">
              <thead>
                <tr>
                  <th>Kostenart</th>
                  <th>Schlüssel</th>
                  <th className="betrag">Gesamtkosten</th>
                  <th className="betrag">Anteil</th>
                </tr>
              </thead>
              <tbody>
                {m.zeilen.map((z, i) => (
                  <tr key={i}>
                    <td>{z.bezeichnung}</td>
                    <td>{SCHLUESSEL_TEXT[z.schluessel]}</td>
                    <td className="betrag">{euroAnzeige(z.gesamtCent)}</td>
                    <td className="betrag">{euroAnzeige(z.anteilCent)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Summe Betriebskosten</td>
                  <td className="betrag" data-testid="bk-kosten">
                    {euroAnzeige(m.kostenCent)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={3}>
                    abzüglich Vorauszahlungen
                    {vz && vz.angerechnetCent !== vz.sollCent
                      ? ' (erfasst; Soll ' + euroText(vz.sollCent) + ' €)'
                      : ''}
                  </td>
                  <td className="betrag">{euroAnzeige(-m.vorauszahlungenCent)}</td>
                </tr>
                <tr>
                  <td colSpan={3}>{m.saldoCent >= 0 ? 'Nachzahlung' : 'Guthaben'}</td>
                  <td className="betrag" data-testid="bk-saldo">
                    {euroAnzeige(Math.abs(m.saldoCent))}
                  </td>
                </tr>
              </tfoot>
            </table>
            {m.lohnanteil35aCent ? (
              <p className="leise">
                Haushaltsnahe Dienstleistungen (§ 35a EStG), Lohnanteil:{' '}
                {euroAnzeige(m.lohnanteil35aCent)}
              </p>
            ) : null}
            {m.hinweise.map((h) => (
              <p key={h.code} className="leise" data-testid="bk-hinweis" data-code={h.code}>
                {h.text}
              </p>
            ))}
          </div>
        )
      })}
      {e.abrechnung.leerstandCent !== 0 ? (
        <p className="karte leise" data-testid="bk-leerstand">
          Anteil Vermieter (Leerstand und Rundung): {euroAnzeige(e.abrechnung.leerstandCent)}
        </p>
      ) : null}
    </>
  )
}

export default async function BkSeiteAnzeige({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await darf({ stammdaten: ['lesen'] }))) redirect('/')
  const schreiben = await darf({ stammdaten: ['schreiben'] })
  const s = await mitMandant((tx) => ladeBkSeite(tx, id))
  if (!s) notFound()
  const fest = s.daten.status === 'festgeschrieben'
  const befunde = [
    ...(s.ergebnis?.befunde ?? []),
    ...(s.ergebnis?.hinweise ?? []).map((h) => ({
      schwere: 'warnung' as const,
      code: h.code,
      text: h.text,
    })),
  ]
  return (
    <>
      <nav className="brotkrumen" aria-label="Pfad">
        <Link href={`/objekte/${s.objektId}`}>{s.objekt}</Link>
        <span aria-hidden>/</span>
        <Link href={`/objekte/${s.objektId}/einheiten/${s.einheitId}/betriebskosten`}>
          Betriebskosten {s.einheit}
        </Link>
      </nav>
      <div className="seitenkopf">
        <div>
          <h1 data-testid="bk-titel">
            Betriebskostenabrechnung {s.jahr} · {s.einheit}
          </h1>
          <p className="meta">
            <Status ton={fest ? 'gruen' : 'neutral'}>{fest ? 'festgeschrieben' : 'Entwurf'}</Status>
            {s.ergebnis ? <span>Frist: {datumAnzeige(s.ergebnis.fristBis)}</span> : null}
            {s.wohnflaecheQm100 ? <span>{dezimalText(s.wohnflaecheQm100, 2)} m²</span> : null}
          </p>
        </div>
      </div>

      {s.fehler.map((f) => (
        <p key={f} role="alert" className="fehler">
          {f}
        </p>
      ))}
      {befunde.length ? (
        <div className="karte" data-testid="bk-befunde">
          <h2>Prüfung</h2>
          <ul className="liste-schlicht">
            {befunde.map((b, i) => (
              <li key={i} data-code={b.code}>
                <Status ton={TON[b.schwere]}>
                  {b.schwere === 'fehler'
                    ? 'Fehler'
                    : b.schwere === 'warnung'
                      ? 'prüfen'
                      : 'Hinweis'}
                </Status>{' '}
                {b.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {s.ergebnis ? <Ergebnis s={s} /> : null}
      {s.nutzungen.length === 0 ? (
        <p className="leise">Im Zeitraum gibt es kein Mietverhältnis.</p>
      ) : null}

      {schreiben && !fest ? (
        <div className="karte">
          <h2>Eingaben</h2>
          <Formular aktion={bkSpeichern} knopf="Speichern und rechnen" testId="bk-formular">
            <input type="hidden" name="id" value={id} />
            <BkEditor
              anfang={zuRoh(s.daten)}
              nutzungen={s.nutzungen.map((n) => ({
                id: n.mietverhaeltnisId,
                text: n.mieter.join(', ') || 'Mieter',
                soll: s.ergebnis
                  ? euroText(s.ergebnis.vorauszahlungen[n.mietverhaeltnisId]?.sollCent)
                  : '',
              }))}
            />
          </Formular>
        </div>
      ) : null}
    </>
  )
}
