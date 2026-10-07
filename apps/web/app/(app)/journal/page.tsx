import { journalJahre, journalSummen, listeJournal, objekteFuerBeleg } from '@vermieteros/db'
import { behandlung } from '@vermieteros/schema'
import { Paperclip, Plus } from 'lucide-react'
import Link from 'next/link'
import { datumAnzeige, euroAnzeige } from '@/lib/format'
import { BEHANDLUNG_TEXT, STEUERKATEGORIE_TEXT } from '@/lib/journal-text'
import { darf, mitMandant } from '@/lib/sitzung'
import { heuteBerlin } from '@/lib/zeit'

/**
 * Journal eines Zahlungsjahres (Modul 08): Summen je Kategorie, darunter alle Einträge.
 * Mit Objektfilter zählen bei aufgeteilten Belegen nur die Anteile dieses Objekts.
 */
export default async function JournalSeite({
  searchParams,
}: {
  searchParams: Promise<{ jahr?: string; objekt?: string; storno?: string }>
}) {
  const sp = await searchParams
  const laufend = Number(heuteBerlin().slice(0, 4))
  const jahr = /^\d{4}$/.test(sp.jahr ?? '') ? Number(sp.jahr) : laufend
  const objektId = sp.objekt || null
  const mitStorno = sp.storno === '1'
  const schreiben = await darf({ stammdaten: ['schreiben'] })
  const { jahre, objekte, summen, eintraege } = await mitMandant(async (tx) => ({
    jahre: await journalJahre(tx, laufend),
    objekte: await objekteFuerBeleg(tx),
    summen: await journalSummen(tx, { jahr, objektId }),
    eintraege: await listeJournal(tx, { jahr, objektId, mitStorno }),
  }))
  const einnahmen = summen.filter((s) => s.richtung === 'einnahme')
  const ausgaben = summen.filter((s) => s.richtung === 'ausgabe')
  const summe = (l: typeof summen) => l.reduce((a, s) => a + s.summeCent, 0)
  const abziehbar = ausgaben.filter((s) => behandlung(s.steuerkategorie) === 'sofort')
  const link = (p: Record<string, string | null>) => {
    const q = new URLSearchParams()
    const alle = { jahr: String(jahr), objekt: objektId, storno: mitStorno ? '1' : null, ...p }
    for (const [k, v] of Object.entries(alle)) if (v) q.set(k, v)
    return `/journal?${q.toString()}`
  }
  const anteil = (e: (typeof eintraege)[number]) =>
    objektId
      ? e.anteile.filter((a) => a.objektId === objektId).reduce((s, a) => s + a.betragCent, 0)
      : e.bruttoCent

  return (
    <>
      <div className="seitenkopf">
        <div>
          <h1>Journal {jahr}</h1>
          <p className="leise">
            Alle Einnahmen und Ausgaben nach Zahlungsdatum. Einträge sind unveränderlich; Fehler
            werden storniert und neu gebucht.
          </p>
        </div>
        {schreiben ? (
          <div className="aktionen">
            <Link className="knopf zweit" href="/belege">
              Belegeingang
            </Link>
            <Link className="knopf" href="/journal/neu" data-testid="journal-neu">
              <Plus size={18} aria-hidden />
              Ohne Beleg buchen
            </Link>
          </div>
        ) : null}
      </div>
      <nav className="reiter" aria-label="Jahr" style={{ width: 'fit-content' }}>
        {jahre.map((j) => (
          <Link
            key={j}
            href={link({ jahr: String(j) })}
            aria-current={j === jahr ? 'page' : undefined}
          >
            {j}
          </Link>
        ))}
      </nav>
      <form
        method="get"
        action="/journal"
        className="feldreihe"
        style={{ maxWidth: 760, margin: '16px 0' }}
      >
        <input type="hidden" name="jahr" value={jahr} />
        <label>
          Objekt
          <select name="objekt" defaultValue={objektId ?? ''}>
            <option value="">alle Objekte</option>
            {objekte.map((o) => (
              <option key={o.id} value={o.id}>
                {o.bezeichnung}
              </option>
            ))}
          </select>
        </label>
        <label className="inline">
          <input type="checkbox" name="storno" value="1" defaultChecked={mitStorno} />
          stornierte zeigen
        </label>
        <button type="submit" className="zweit">
          Anzeigen
        </button>
      </form>

      <div className="karte" data-testid="journal-summen">
        <h2>Summen {jahr}</h2>
        <table className="vergleich">
          <tbody>
            {einnahmen.map((s) => (
              <tr key={s.steuerkategorie} data-kategorie={s.steuerkategorie}>
                <td>{STEUERKATEGORIE_TEXT[s.steuerkategorie]}</td>
                <td className="leise">{s.anzahl}</td>
                <td className="betrag">{euroAnzeige(s.summeCent)}</td>
              </tr>
            ))}
            <tr>
              <td>
                <strong>Einnahmen</strong>
              </td>
              <td />
              <td className="betrag">
                <strong>{euroAnzeige(summe(einnahmen))}</strong>
              </td>
            </tr>
            {ausgaben.map((s) => (
              <tr key={s.steuerkategorie} data-kategorie={s.steuerkategorie}>
                <td>
                  {STEUERKATEGORIE_TEXT[s.steuerkategorie]}
                  <span className="leise"> · {BEHANDLUNG_TEXT[behandlung(s.steuerkategorie)]}</span>
                </td>
                <td className="leise">{s.anzahl}</td>
                <td className="betrag">{euroAnzeige(s.summeCent)}</td>
              </tr>
            ))}
            <tr>
              <td>
                <strong>Ausgaben</strong>
              </td>
              <td />
              <td className="betrag">
                <strong>{euroAnzeige(summe(ausgaben))}</strong>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td>Einnahmen abzüglich sofort abziehbarer Ausgaben</td>
              <td />
              <td className="betrag" data-testid="journal-ueberschuss">
                {euroAnzeige(summe(einnahmen) - summe(abziehbar))}
              </td>
            </tr>
          </tfoot>
        </table>
        <p className="leise">
          Vorbereitung, keine Steuerberechnung: AfA, verteilter Erhaltungsaufwand und die Aufteilung
          nach Miteigentum kommen mit dem Steuerpaket.
        </p>
      </div>

      <div className="karte tabelle-scroll">
        <h2>Einträge ({eintraege.length})</h2>
        {eintraege.length === 0 ? (
          <p className="leise" data-testid="journal-leer">
            Keine Einträge in {jahr}.
          </p>
        ) : (
          <table className="vergleich" data-testid="journal-liste">
            <thead>
              <tr>
                <th>Nr.</th>
                <th>Bezahlt</th>
                <th>Gegenpartei</th>
                <th>Kategorie</th>
                <th>Objekt</th>
                <th className="betrag">Betrag</th>
              </tr>
            </thead>
            <tbody>
              {eintraege.map((e) => (
                <tr
                  key={e.id}
                  className={e.storno ? 'storniert' : undefined}
                  data-testid="journal-eintrag"
                  data-nummer={e.belegnummer}
                >
                  <td className="mono">
                    <Link href={`/journal/${e.id}`}>{e.belegnummer}</Link>
                  </td>
                  <td>{datumAnzeige(e.zahlungsdatum)}</td>
                  <td>
                    {e.gegenpartei}{' '}
                    {e.dokumentId ? (
                      <Paperclip size={13} aria-label="mit Beleg" />
                    ) : e.richtung === 'ausgabe' ? (
                      <span className="leise">(ohne Beleg)</span>
                    ) : null}
                  </td>
                  <td>{STEUERKATEGORIE_TEXT[e.steuerkategorie]}</td>
                  <td>{e.anteile.map((a) => a.objekt).join(', ')}</td>
                  <td className="betrag">
                    {e.richtung === 'ausgabe' ? '−' : ''}
                    {euroAnzeige(anteil(e))}
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
