import {
  juengsterKiVorschlag,
  ladeDokument,
  ladeZuordnungsKandidaten,
  letzteVersion,
} from '@vermieteros/db'
import { werteMietvertragAus, type Auswertung, type MietvertragAuszug } from '@vermieteros/ki'
import { CircleCheck, Download, FileSearch, TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Formular } from '@/components/formular'
import { Status } from '@/components/status'
import { DOKUMENT_STATUS_TEXT, DOKUMENT_TYP_TEXT } from '@/lib/dokument-text'
import { datumAnzeige, euroAnzeige } from '@/lib/format'
import { kiEingerichtet } from '@/lib/ki'
import { groesseText, mietverhaeltnisText } from '@/lib/post-text'
import { darf, mitMandant } from '@/lib/sitzung'
import { aktuelleVertragsdaten, dokumentSeiten } from '@/lib/vertrag'
import { dokumentStatus, vertragAuslesen, vertragUebernehmen, vertragVerwerfen } from '../aktionen'

const FELD_TEXT: Record<Auswertung['feld'], string> = {
  mietbeginn: 'Mietbeginn',
  kaltmiete: 'Kaltmiete',
  vorauszahlung_betriebskosten: 'Vorauszahlung Betriebskosten',
  vorauszahlung_heizkosten: 'Vorauszahlung Heizkosten',
  kaution: 'Kaution',
  kuendigungsfrist_monate: 'Kündigungsfrist (Monate)',
}

function anzeige(feld: Auswertung['feld'], wert: number | string | null | undefined): string {
  if (wert === null || wert === undefined) return '–'
  if (feld === 'mietbeginn') return datumAnzeige(String(wert))
  if (feld === 'kuendigungsfrist_monate') return `${wert} Monate`
  return euroAnzeige(Number(wert))
}

export default async function DokumentSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const schreiben = await darf({ stammdaten: ['schreiben'] })
  const daten = await mitMandant(async (tx) => {
    const d = await ladeDokument(tx, id)
    if (!d) return null
    const mv = d.mietverhaeltnisId
      ? (await ladeZuordnungsKandidaten(tx)).find(
          (k) => k.mietverhaeltnisId === d.mietverhaeltnisId,
        )
      : undefined
    const objekt = d.objektId ? await letzteVersion(tx, 'objekt', d.objektId) : null
    const vertrag = d.typ === 'mietvertrag' && d.mime === 'application/pdf' && d.mietverhaeltnisId
    const vorschlag = vertrag
      ? await juengsterKiVorschlag(tx, 'mietvertrag_extraktion', { entitaet: 'dokument', id })
      : null
    const aktiv =
      vorschlag && (vorschlag.status === 'offen' || vorschlag.status === 'bestaetigt')
        ? vorschlag
        : null
    const auswertung = aktiv
      ? werteMietvertragAus(aktiv.ausgabe as MietvertragAuszug, await dokumentSeiten(tx, id))
      : []
    const akt =
      vertrag && d.mietverhaeltnisId ? await aktuelleVertragsdaten(tx, d.mietverhaeltnisId) : null
    return { d, mv, objekt, vertrag, vorschlag, aktiv, auswertung, akt }
  })
  if (!daten) notFound()
  const { d, mv, objekt, vertrag, vorschlag, aktiv, auswertung, akt } = daten
  const erfasst: Record<Auswertung['feld'], number | string | null | undefined> = {
    mietbeginn: akt?.mv?.beginn,
    kaution: akt?.mv?.kautionCent,
    kuendigungsfrist_monate: akt?.mv?.kuendigungsfristMonate,
    kaltmiete: akt?.kondition?.kaltmieteCent,
    vorauszahlung_betriebskosten: akt?.kondition?.vorauszahlungBkCent,
    vorauszahlung_heizkosten: akt?.kondition?.vorauszahlungHkCent,
  }
  const auszug = aktiv?.ausgabe as MietvertragAuszug | undefined
  const zurueck = mv
    ? { href: `/mietverhaeltnisse/${mv.mietverhaeltnisId}`, text: mietverhaeltnisText(mv) }
    : { href: `/objekte/${d.objektId}`, text: objekt?.bezeichnung ?? 'Objekt' }

  return (
    <>
      <nav className="brotkrumen" aria-label="Pfad">
        <Link href={zurueck.href}>{zurueck.text}</Link>
        <span aria-hidden>/</span>
        <span>Dokument</span>
      </nav>
      <div className="seitenkopf">
        <div>
          <h1 data-testid="dokument-titel">{d.titel}</h1>
          <p className="meta">
            <Status ton={d.status === 'gueltig' ? 'gruen' : 'neutral'} testId="dokument-status">
              {DOKUMENT_STATUS_TEXT[d.status]}
            </Status>
            <span>{DOKUMENT_TYP_TEXT[d.typ]}</span>
            {d.dokumentdatum ? <span>vom {datumAnzeige(d.dokumentdatum)}</span> : null}
            {d.gueltigBis ? <span>gültig bis {datumAnzeige(d.gueltigBis)}</span> : null}
          </p>
        </div>
        <div className="aktionen">
          <a
            className="knopf"
            href={`/api/dokument/${d.id}`}
            download
            data-testid="dokument-download"
          >
            <Download size={16} aria-hidden />
            Herunterladen
          </a>
          {schreiben && d.status !== 'ersetzt' ? (
            <Link
              className="knopf zweit"
              href={`/dokumente/neu?ersetzt=${d.id}`}
              data-testid="dokument-ersetzen"
            >
              Ersetzen
            </Link>
          ) : null}
        </div>
      </div>
      <div className="raster-2">
        <div>
          <dl className="karte kopfdaten">
            <dt>Datei</dt>
            <dd>{d.dateiname}</dd>
            <dt>Größe</dt>
            <dd>{groesseText(d.groesseBytes)}</dd>
            <dt>Prüfsumme</dt>
            <dd className="mono">SHA-256 {d.dateiHash.slice(0, 16)}…</dd>
            {d.ersetztDurch ? (
              <>
                <dt>Ersetzt durch</dt>
                <dd>
                  <Link href={`/dokumente/${d.ersetztDurch}`}>neuere Fassung</Link>
                </dd>
              </>
            ) : null}
            {d.notizen ? (
              <>
                <dt>Notizen</dt>
                <dd>{d.notizen}</dd>
              </>
            ) : null}
          </dl>
          {schreiben && d.status !== 'ersetzt' ? (
            <div className="karte">
              <h2>Status</h2>
              <Formular
                aktion={dokumentStatus}
                knopf={d.status === 'gueltig' ? 'Als abgelaufen markieren' : 'Wieder gültig'}
                testId="dokument-status-aendern"
                zweit
              >
                <input type="hidden" name="dokumentId" value={d.id} />
                <input
                  type="hidden"
                  name="status"
                  value={d.status === 'gueltig' ? 'abgelaufen' : 'gueltig'}
                />
              </Formular>
            </div>
          ) : null}
        </div>
        {vertrag ? (
          <div className="karte" data-testid="vertrag">
            <h2>
              <FileSearch size={18} aria-hidden style={{ verticalAlign: '-3px', marginRight: 6 }} />
              Eckdaten aus dem Vertrag
            </h2>
            {!aktiv ? (
              <>
                <p className="leise">
                  {vorschlag?.status === 'veraltet'
                    ? 'Die letzte Auswertung ist veraltet.'
                    : vorschlag?.status === 'verworfen'
                      ? 'Die letzte Auswertung wurde verworfen.'
                      : 'Die KI liest Mietbeginn, Miete, Vorauszahlungen, Kaution und Kündigungsfrist mit Seitenangabe aus. Übernommen wird nur, was du bestätigst und was wörtlich im PDF steht.'}
                </p>
                {schreiben && d.status === 'gueltig' ? (
                  kiEingerichtet() ? (
                    <Formular
                      aktion={vertragAuslesen}
                      knopf="Vertrag auslesen"
                      testId="vertrag-auslesen"
                    >
                      <input type="hidden" name="dokumentId" value={d.id} />
                    </Formular>
                  ) : (
                    <p className="leise">Die KI ist nicht eingerichtet (ANTHROPIC_API_KEY).</p>
                  )
                ) : null}
              </>
            ) : (
              <>
                <Formular
                  aktion={vertragUebernehmen}
                  knopf={
                    aktiv.status === 'bestaetigt'
                      ? 'Erneut übernehmen'
                      : 'Angehakte Werte übernehmen'
                  }
                  testId="vertrag-uebernehmen"
                >
                  <input type="hidden" name="dokumentId" value={d.id} />
                  <input type="hidden" name="vorschlagId" value={aktiv.id} />
                  <table className="vergleich" data-testid="vertrag-werte">
                    <thead>
                      <tr>
                        <th>Angabe</th>
                        <th>Im Vertrag</th>
                        <th>Erfasst</th>
                        <th>Übernehmen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auswertung.map((w) => {
                        const gleich = String(w.normiert) === String(erfasst[w.feld] ?? '')
                        return (
                          <tr key={w.feld} data-feld={w.feld}>
                            <td>{FELD_TEXT[w.feld]}</td>
                            <td>
                              <strong className="ziffern">{anzeige(w.feld, w.normiert)}</strong>
                              <span className="leise" style={{ display: 'block' }}>
                                {w.pruefung === 'belegt' ? (
                                  <>
                                    <CircleCheck size={13} aria-hidden color="var(--gruen)" /> S.{' '}
                                    {w.seite}: „{w.zitat}“
                                  </>
                                ) : (
                                  <>
                                    <TriangleAlert size={13} aria-hidden color="var(--gelb)" />{' '}
                                    {w.pruefung === 'scan'
                                      ? 'Scan ohne Text, bitte selbst prüfen'
                                      : `nicht belegt (S. ${w.seite})`}
                                  </>
                                )}
                              </span>
                            </td>
                            <td className="ziffern">{anzeige(w.feld, erfasst[w.feld])}</td>
                            <td>
                              {w.pruefung === 'belegt' && !gleich ? (
                                <input
                                  type="checkbox"
                                  name="felder"
                                  value={w.feld}
                                  defaultChecked
                                  aria-label={`${FELD_TEXT[w.feld]} übernehmen`}
                                />
                              ) : gleich ? (
                                <span className="leise">gleich</span>
                              ) : (
                                <span className="leise">–</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {auszug?.mieter.length ? (
                    <p className="leise">Mieter laut Vertrag: {auszug.mieter.join(', ')}</p>
                  ) : null}
                  {auszug?.hinweise.length ? (
                    <ul className="leise">
                      {auszug.hinweise.map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  ) : null}
                </Formular>
                {aktiv.status === 'offen' ? (
                  <Formular
                    aktion={vertragVerwerfen}
                    knopf="Auswertung verwerfen"
                    testId="vertrag-verwerfen"
                    zweit
                  >
                    <input type="hidden" name="dokumentId" value={d.id} />
                    <input type="hidden" name="vorschlagId" value={aktiv.id} />
                  </Formular>
                ) : (
                  <Status ton="gruen">übernommen</Status>
                )}
              </>
            )}
          </div>
        ) : null}
      </div>
    </>
  )
}
