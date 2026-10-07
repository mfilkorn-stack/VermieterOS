import { ladeJournalEintrag } from '@vermieteros/db'
import { behandlung, type HerkunftEintrag } from '@vermieteros/schema'
import { FileText } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Formular } from '@/components/formular'
import { Status } from '@/components/status'
import { datumAnzeige, euroAnzeige, zeitpunktAnzeige } from '@/lib/format'
import { BEHANDLUNG_TEXT, KOSTENART_TEXT, STEUERKATEGORIE_TEXT } from '@/lib/journal-text'
import { darf, mitMandant } from '@/lib/sitzung'
import { journalStornieren } from '../../belege/aktionen'

function herkunftText(h: HerkunftEintrag | undefined): string | null {
  if (!h) return null
  if (h.quelle === 'dokument') return `Beleg, S. ${h.seite ?? '?'}`
  if (h.quelle === 'ki_vorschlag') return 'Vorschlag bestätigt'
  return null
}

export default async function JournalEintragSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const schreiben = await darf({ stammdaten: ['schreiben'] })
  const e = await mitMandant((tx) => ladeJournalEintrag(tx, id))
  if (!e) notFound()
  const h = (f: string) => {
    const t = herkunftText(e.herkunft[f])
    return t ? <span className="leise"> · {t}</span> : null
  }
  const b = behandlung(e.steuerkategorie, e.verteilungJahre)

  return (
    <>
      <nav className="brotkrumen" aria-label="Pfad">
        <Link href={`/journal?jahr=${e.jahr}`}>Journal {e.jahr}</Link>
        <span aria-hidden>/</span>
        <span>{e.belegnummer}</span>
      </nav>
      <div className="seitenkopf">
        <div>
          <h1 data-testid="journal-titel">
            <span className="mono">{e.belegnummer}</span> {e.gegenpartei}
          </h1>
          <p className="meta">
            {e.storno ? (
              <Status ton="neutral" testId="journal-status">
                storniert
              </Status>
            ) : (
              <Status ton="gruen" testId="journal-status">
                gültig
              </Status>
            )}
            <span>{e.richtung === 'ausgabe' ? 'Ausgabe' : 'Einnahme'}</span>
            <span>
              {BEHANDLUNG_TEXT[b]}
              {b === 'verteilt' ? ` auf ${e.verteilungJahre} Jahre` : ''}
            </span>
          </p>
        </div>
        {e.dokumentId ? (
          <Link className="knopf zweit" href={`/belege/${e.dokumentId}`}>
            <FileText size={16} aria-hidden />
            Beleg
          </Link>
        ) : null}
      </div>
      <div className="raster-2">
        <dl className="karte kopfdaten" data-testid="journal-daten">
          <dt>Betrag</dt>
          <dd className="ziffern">
            {euroAnzeige(e.bruttoCent)}
            {h('bruttoCent')}
          </dd>
          {e.umsatzsteuerCent != null ? (
            <>
              <dt>darin USt</dt>
              <dd className="ziffern">
                {euroAnzeige(e.umsatzsteuerCent)}
                {h('umsatzsteuerCent')}
              </dd>
            </>
          ) : null}
          <dt>Bezahlt am</dt>
          <dd>
            {datumAnzeige(e.zahlungsdatum)}
            {h('zahlungsdatum')}
          </dd>
          {e.leistungVon ? (
            <>
              <dt>Leistung</dt>
              <dd>
                {datumAnzeige(e.leistungVon)} bis {datumAnzeige(e.leistungBis)}
                {h('leistungVon')}
              </dd>
            </>
          ) : null}
          {e.rechnungsnummer ? (
            <>
              <dt>Rechnung</dt>
              <dd>
                {e.rechnungsnummer}
                {e.rechnungsdatum ? ` vom ${datumAnzeige(e.rechnungsdatum)}` : ''}
              </dd>
            </>
          ) : null}
          <dt>Kategorie</dt>
          <dd>
            {STEUERKATEGORIE_TEXT[e.steuerkategorie]}
            {h('steuerkategorie')}
          </dd>
          {e.kostenart ? (
            <>
              <dt>Kostenart</dt>
              <dd>
                {KOSTENART_TEXT[e.kostenart]}
                {e.umlagefaehig ? ', umlagefähig' : ', nicht umlagefähig'}
              </dd>
            </>
          ) : null}
          {e.beschreibung ? (
            <>
              <dt>Notiz</dt>
              <dd>{e.beschreibung}</dd>
            </>
          ) : null}
          <dt>Erfasst</dt>
          <dd>{zeitpunktAnzeige(e.erfasstAm)}</dd>
        </dl>
        <div>
          <div className="karte">
            <h2>Aufteilung</h2>
            <table className="vergleich" data-testid="journal-anteile">
              <tbody>
                {e.anteile.map((a) => (
                  <tr key={`${a.objektId}|${a.einheitId ?? ''}`}>
                    <td>
                      <Link href={`/journal?jahr=${e.jahr}&objekt=${a.objektId}`}>{a.objekt}</Link>
                      {a.einheit ? ` · ${a.einheit}` : ''}
                    </td>
                    <td className="betrag">{euroAnzeige(a.betragCent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {e.storno ? (
            <div className="karte">
              <h2>Storniert</h2>
              <p>
                {zeitpunktAnzeige(e.storno.erfasstAm)}: {e.storno.grund}
              </p>
              {e.dokumentId ? (
                <p className="leise">
                  Der Beleg ist wieder offen und kann{' '}
                  <Link href={`/belege/${e.dokumentId}`}>neu gebucht</Link> werden.
                </p>
              ) : null}
            </div>
          ) : schreiben ? (
            <details className="karte">
              <summary>Stornieren</summary>
              <Formular
                aktion={journalStornieren}
                knopf="Stornieren"
                testId="journal-stornieren"
                zweit
              >
                <input type="hidden" name="eintragId" value={e.id} />
                <label>
                  Grund
                  <input
                    name="grund"
                    required
                    placeholder="z. B. falscher Betrag, falsches Objekt"
                  />
                </label>
                <p className="leise">
                  Der Eintrag bleibt sichtbar und zählt nicht mehr. Ein Beleg ist danach wieder
                  offen.
                </p>
              </Formular>
            </details>
          ) : null}
        </div>
      </div>
    </>
  )
}
