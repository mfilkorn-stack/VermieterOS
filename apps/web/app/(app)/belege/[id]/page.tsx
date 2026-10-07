import {
  buchungenZuBeleg,
  juengsterKiVorschlag,
  ladeBeleg,
  ladeTicket,
  objekteFuerBeleg,
} from '@vermieteros/db'
import {
  BELEG_EXTRAKTION,
  werteBelegAus,
  type BelegAuswertung,
  type BelegAuszug,
  type BelegFeld,
} from '@vermieteros/ki'
import { CircleCheck, Download, FileSearch, Mail, TriangleAlert, Wrench } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BuchungFelder, type BuchungVorgabe } from '@/components/buchung-felder'
import { Formular } from '@/components/formular'
import { Status } from '@/components/status'
import { datumAnzeige, euroAnzeige, euroText } from '@/lib/format'
import { BELEG_FELD_TEXT, KOSTENART_TEXT, STEUERKATEGORIE_TEXT } from '@/lib/journal-text'
import { kiEingerichtet } from '@/lib/ki'
import { groesseText } from '@/lib/post-text'
import { darf, mitMandant } from '@/lib/sitzung'
import { dokumentSeiten } from '@/lib/vertrag'
import {
  belegAuslesen,
  belegAussortieren,
  belegAuswertungVerwerfen,
  belegBuchen,
} from '../aktionen'

function anzeige(w: BelegAuswertung): string {
  if (w.normiert === null) return w.wert
  if (w.feld === 'betrag_brutto' || w.feld === 'umsatzsteuer')
    return euroAnzeige(Number(w.normiert))
  if (w.feld === 'lieferant' || w.feld === 'rechnungsnummer') return String(w.normiert)
  return datumAnzeige(String(w.normiert))
}

function Fundstelle({ w }: { w: BelegAuswertung }) {
  return w.pruefung === 'belegt' ? (
    <>
      <CircleCheck size={13} aria-hidden color="var(--gruen)" /> S. {w.seite}: „{w.zitat}“
    </>
  ) : (
    <>
      <TriangleAlert size={13} aria-hidden color="var(--gelb)" />{' '}
      {w.pruefung === 'scan'
        ? 'Foto oder Scan, bitte selbst prüfen'
        : `nicht belegt (S. ${w.seite})`}
    </>
  )
}

export default async function BelegSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const schreiben = await darf({ stammdaten: ['schreiben'] })
  const daten = await mitMandant(async (tx) => {
    const b = await ladeBeleg(tx, id)
    if (!b) return null
    const vorschlag = await juengsterKiVorschlag(tx, BELEG_EXTRAKTION.name, {
      entitaet: 'dokument',
      id,
    })
    const aktiv =
      vorschlag && (vorschlag.status === 'offen' || vorschlag.status === 'bestaetigt')
        ? vorschlag
        : null
    const auswertung = aktiv
      ? werteBelegAus(aktiv.ausgabe as BelegAuszug, await dokumentSeiten(tx, id))
      : []
    return {
      b,
      vorschlag,
      aktiv,
      auswertung,
      objekte: await objekteFuerBeleg(tx),
      buchungen: await buchungenZuBeleg(tx, id),
      ticket: b.ticketId ? await ladeTicket(tx, b.ticketId) : null,
    }
  })
  if (!daten) notFound()
  const { b, vorschlag, aktiv, auswertung, objekte, buchungen, ticket } = daten
  const auszug = aktiv?.ausgabe as BelegAuszug | undefined
  const gebucht = buchungen.find((x) => !x.storno)

  // Vorbelegung nur aus Werten, die am PDF belegt sind; die Einordnung aus dem Vorschlag.
  const belegt = new Map<BelegFeld, BelegAuswertung>(
    auswertung.filter((w) => w.pruefung === 'belegt').map((w) => [w.feld, w]),
  )
  const wert = (f: BelegFeld) => belegt.get(f)?.normiert ?? null
  const e = auszug?.einordnung
  const objektId =
    (e?.objekt_id && objekte.some((o) => o.id === e.objekt_id) ? e.objekt_id : null) ??
    b.objektId ??
    ticket?.objektId ??
    null
  const vorgabe: BuchungVorgabe = {
    richtung: 'ausgabe',
    gegenpartei: (wert('lieferant') as string | null) ?? ticket?.auftragnehmer ?? null,
    rechnungsnummer: wert('rechnungsnummer') as string | null,
    rechnungsdatum: wert('rechnungsdatum') as string | null,
    zahlungsdatum: wert('zahlungsdatum') as string | null,
    leistungVon: wert('leistung_von') as string | null,
    leistungBis: wert('leistung_bis') as string | null,
    brutto: wert('betrag_brutto') !== null ? euroText(Number(wert('betrag_brutto'))) : null,
    umsatzsteuer: wert('umsatzsteuer') !== null ? euroText(Number(wert('umsatzsteuer'))) : null,
    steuerkategorie: e?.steuerkategorie ?? null,
    kostenart: e?.kostenart ?? null,
    umlagefaehig: e?.umlagefaehig ?? false,
    objektId,
    beschreibung: ticket ? `Ticket: ${ticket.titel}` : null,
  }
  const hinweise: Partial<Record<keyof BuchungVorgabe, string>> = {}
  if (e) {
    hinweise.steuerkategorie = `Vorschlag der KI: ${STEUERKATEGORIE_TEXT[e.steuerkategorie]}${
      e.kostenart ? `, ${KOSTENART_TEXT[e.kostenart]}` : ''
    }${e.umlagefaehig ? ', umlagefähig' : ''}. ${e.begruendung}`
  }
  if (ticket) hinweise.objektId = `Aus dem Ticket „${ticket.titel}“ (${ticket.objekt}).`

  const pdf = b.mime === 'application/pdf'

  return (
    <>
      <nav className="brotkrumen" aria-label="Pfad">
        <Link href="/belege">Belegeingang</Link>
        <span aria-hidden>/</span>
        <span>Beleg</span>
      </nav>
      <div className="seitenkopf">
        <div>
          <h1 data-testid="beleg-titel">{b.titel}</h1>
          <p className="meta">
            {gebucht ? (
              <Status ton="gruen" testId="beleg-status">
                gebucht als {gebucht.belegnummer}
              </Status>
            ) : (
              <Status ton="gelb" testId="beleg-status">
                offen
              </Status>
            )}
            <span>{b.dateiname}</span>
            <span>{groesseText(b.groesseBytes)}</span>
            {b.nachrichtId ? (
              <Link href={`/posteingang/${b.nachrichtId}`}>
                <Mail size={14} aria-hidden /> aus Mail
              </Link>
            ) : null}
            {ticket ? (
              <Link href={`/tickets/${ticket.id}`}>
                <Wrench size={14} aria-hidden /> {ticket.titel}
              </Link>
            ) : null}
          </p>
        </div>
        <div className="aktionen">
          <a className="knopf zweit" href={`/api/dokument/${b.id}`} download>
            <Download size={16} aria-hidden />
            Herunterladen
          </a>
        </div>
      </div>
      <div className="raster-2">
        <div>
          {pdf ? (
            <iframe
              className="vorschau"
              src={`/api/dokument/${b.id}?ansicht=1`}
              title={`Vorschau ${b.dateiname}`}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- Datei aus dem Object Storage, kein statisches Bild
            <img
              className="vorschau"
              src={`/api/dokument/${b.id}?ansicht=1`}
              alt={`Beleg ${b.dateiname}`}
            />
          )}
          {buchungen.length > 0 ? (
            <div className="karte">
              <h2>Buchungen</h2>
              <ul className="import-liste">
                {buchungen.map((x) => (
                  <li key={x.id} className={x.storno ? 'leise' : undefined}>
                    <Link href={`/journal/${x.id}`} className="mono">
                      {x.belegnummer}
                    </Link>{' '}
                    {euroAnzeige(x.bruttoCent)}, {STEUERKATEGORIE_TEXT[x.steuerkategorie]}
                    {x.storno ? ` – storniert: ${x.storno.grund}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <div>
          <div className="karte" data-testid="beleg-ki">
            <h2>
              <FileSearch size={18} aria-hidden style={{ verticalAlign: '-3px', marginRight: 6 }} />
              Ausgelesen
            </h2>
            {!aktiv ? (
              <>
                <p className="leise">
                  {vorschlag?.status === 'veraltet'
                    ? 'Die letzte Auswertung ist veraltet.'
                    : vorschlag?.status === 'verworfen'
                      ? 'Die letzte Auswertung wurde verworfen.'
                      : 'Die KI liest Lieferant, Betrag, Umsatzsteuer, Daten und Leistungszeitraum mit Fundstelle aus und schlägt Objekt und Kategorie vor.'}
                </p>
                {schreiben && !gebucht ? (
                  kiEingerichtet() ? (
                    <Formular aktion={belegAuslesen} knopf="Beleg auslesen" testId="beleg-auslesen">
                      <input type="hidden" name="dokumentId" value={b.id} />
                    </Formular>
                  ) : (
                    <p className="leise">
                      Die KI ist nicht eingerichtet (ANTHROPIC_API_KEY). Bitte von Hand buchen.
                    </p>
                  )
                ) : null}
              </>
            ) : (
              <>
                <table className="vergleich" data-testid="beleg-werte">
                  <tbody>
                    {auswertung.map((w) => (
                      <tr key={w.feld} data-feld={w.feld} data-pruefung={w.pruefung}>
                        <td>{BELEG_FELD_TEXT[w.feld]}</td>
                        <td>
                          <strong className="ziffern">{anzeige(w)}</strong>
                          <span className="leise" style={{ display: 'block' }}>
                            <Fundstelle w={w} />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {auszug?.hinweise.length ? (
                  <ul className="leise">
                    {auszug.hinweise.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                ) : null}
                <p className="leise">
                  Nur Werte mit Fundstelle sind unten vorbelegt. Alles andere bitte selbst
                  eintragen.
                </p>
                {aktiv.status === 'offen' && schreiben && !gebucht ? (
                  <Formular
                    aktion={belegAuswertungVerwerfen}
                    knopf="Auswertung verwerfen"
                    testId="beleg-verwerfen"
                    zweit
                  >
                    <input type="hidden" name="dokumentId" value={b.id} />
                    <input type="hidden" name="vorschlagId" value={aktiv.id} />
                  </Formular>
                ) : null}
              </>
            )}
          </div>
          {schreiben && !gebucht ? (
            <div className="karte">
              <h2>Buchen</h2>
              <Formular aktion={belegBuchen} knopf="Bestätigen und buchen" testId="beleg-buchen">
                <input type="hidden" name="dokumentId" value={b.id} />
                {aktiv ? <input type="hidden" name="vorschlagId" value={aktiv.id} /> : null}
                <BuchungFelder
                  objekte={objekte}
                  vorgabe={vorgabe}
                  richtungWaehlbar={false}
                  hinweise={hinweise}
                />
              </Formular>
            </div>
          ) : null}
          {schreiben && !gebucht ? (
            <details className="karte">
              <summary>Kein Beleg? Aus dem Eingang nehmen</summary>
              <Formular
                aktion={belegAussortieren}
                knopf="Aus dem Eingang nehmen"
                testId="beleg-aussortieren"
                zweit
              >
                <input type="hidden" name="dokumentId" value={b.id} />
                <label>
                  Grund
                  <input name="grund" required placeholder="z. B. doppelt, Werbung, privat" />
                </label>
              </Formular>
            </details>
          ) : null}
        </div>
      </div>
    </>
  )
}
