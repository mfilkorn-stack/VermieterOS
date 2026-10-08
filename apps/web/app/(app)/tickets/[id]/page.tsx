import {
  belegeZuTicket,
  ladeTicket,
  listeDokumente,
  listeHandwerker,
  ticketVerlauf,
} from '@vermieteros/db'
import { TICKET_STATUS } from '@vermieteros/schema'
import { Mail, MapPin, ReceiptText } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BelegImport } from '@/components/beleg-import'
import { DokumentListe } from '@/components/dokument-liste'
import { Auswahl, Feld } from '@/components/felder'
import { Formular } from '@/components/formular'
import { PrioritaetBadge, TicketStatusBadge } from '@/components/ticket-badges'
import { optionen, PRIORITAET_TEXT, TICKET_STATUS_TEXT } from '@/lib/betrieb-text'
import { euroAnzeige, zeitpunktAnzeige } from '@/lib/format'
import { kiEingerichtet } from '@/lib/ki'
import { darf, mitMandant } from '@/lib/sitzung'
import { isoZuBerlin } from '@/lib/zeit'
import { belegAuslesenDirekt, belegHochladen } from '../../belege/aktionen'
import { ticketAktualisieren } from '../aktionen'
import { KiHinweis } from '@/components/ki-hinweis'

export default async function TicketSeite({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ gebucht?: string }>
}) {
  const { id } = await params
  const gebucht = (await searchParams).gebucht === '1'
  const d = await mitMandant(async (tx) => {
    const t = await ladeTicket(tx, id)
    if (!t) return null
    return {
      t,
      verlauf: await ticketVerlauf(tx, id),
      rechnungen: await belegeZuTicket(tx, id),
      fotos: (await listeDokumente(tx, { ticketId: id })).filter(
        (x) => x.typ === 'mangelfoto' && x.status === 'gueltig',
      ),
      dateien: (await listeDokumente(tx, { ticketId: id })).filter(
        (x) => x.typ !== 'mangelfoto' && x.typ !== 'beleg' && !x.beleg && x.status === 'gueltig',
      ),
      handwerker: (await listeHandwerker(tx)).filter(
        (h) => h.objektIds.length === 0 || h.objektIds.includes(t.objektId),
      ),
    }
  })
  if (!d) notFound()
  const { t, verlauf, handwerker, rechnungen, fotos, dateien } = d
  const schreiben = await darf({ stammdaten: ['schreiben'] })
  const auftragnehmer = handwerker.find((h) => h.id === t.auftragnehmerId)
  const ort = t.einheit ? `${t.objekt} · ${t.einheit}` : t.objekt
  const auftrag = auftragnehmer?.email
    ? [
        'mailto:',
        encodeURIComponent(auftragnehmer.email),
        '?subject=',
        encodeURIComponent(`Auftrag: ${t.titel} (${ort})`),
        '&body=',
        encodeURIComponent([t.beschreibung ?? t.titel, '', `Ort: ${ort}`].join('\n')),
      ].join('')
    : null

  return (
    <>
      {gebucht ? (
        <p className="karte" data-testid="gebucht-hinweis">
          Rechnung gebucht; sie steht im Journal und unter Belegen.
        </p>
      ) : null}
      <nav className="brotkrumen" aria-label="Pfad">
        <Link href="/tickets">Tickets</Link>
        <span aria-hidden>/</span>
        <span>{t.titel}</span>
      </nav>
      <div className="seitenkopf">
        <div>
          <h1 data-testid="ticket-titel">{t.titel}</h1>
          <p className="meta">
            <PrioritaetBadge p={t.prioritaet} />
            <TicketStatusBadge status={t.status} />
            <span>
              <MapPin size={14} aria-hidden />
              <Link href={`/objekte/${t.objektId}`}>{ort}</Link>
            </span>
            {t.nachrichtId ? (
              <Link href={`/posteingang/${t.nachrichtId}`}>Ursprüngliche Mail</Link>
            ) : null}
          </p>
        </div>
      </div>
      <div className="raster-2">
        <div>
          {t.beschreibung ? (
            <div className="karte">
              <h2>Beschreibung</h2>
              <pre className="mailtext">{t.beschreibung}</pre>
            </div>
          ) : null}
          {fotos.length ? (
            <div className="karte" data-testid="ticket-fotos">
              <h2>Fotos</h2>
              <div className="fotos">
                {fotos.map((f) => (
                  <a key={f.id} href={`/dokumente/${f.id}`}>
                    <img src={`/api/dokument/${f.id}?ansicht=1`} alt={f.dateiname} />
                  </a>
                ))}
              </div>
            </div>
          ) : null}
          {dateien.length ? (
            <div className="karte" data-testid="ticket-dateien">
              <h2>Dateien</h2>
              <DokumentListe dokumente={dateien} />
            </div>
          ) : null}
          <div className="karte">
            <h2>Verlauf</h2>
            <ol className="befunde" data-testid="ticket-verlauf">
              {verlauf.map((s) => (
                <li key={s.versionNr}>
                  <TicketStatusBadge status={s.status} />
                  <span className="leise">
                    {zeitpunktAnzeige(s.erfasstAm)} · {s.erfasstVon}
                    {s.begruendung ? ` · ${s.begruendung}` : ''}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div>
          {schreiben ? (
            <div className="karte">
              <h2>Status und Auftrag</h2>
              <Formular
                aktion={ticketAktualisieren}
                knopf="Änderungen speichern"
                testId="ticket-aktualisieren"
              >
                <input type="hidden" name="ticketId" value={t.id} />
                <Auswahl
                  label="Status"
                  name="status"
                  optionen={TICKET_STATUS.map((s) => [s, TICKET_STATUS_TEXT[s]] as const)}
                  defaultValue={t.status}
                />
                <Auswahl
                  label="Handwerker"
                  name="auftragnehmerId"
                  leer="noch keiner"
                  optionen={handwerker.map((h) => [h.id, h.firma] as const)}
                  defaultValue={t.auftragnehmerId}
                />
                <Feld
                  label="Termin"
                  name="termin"
                  type="datetime-local"
                  defaultValue={t.termin ? isoZuBerlin(t.termin) : ''}
                />
                <Auswahl
                  label="Priorität"
                  name="prioritaet"
                  optionen={optionen(PRIORITAET_TEXT)}
                  defaultValue={t.prioritaet}
                />
                <label>
                  Notizen
                  <textarea name="notizen" rows={3} defaultValue={t.notizen ?? ''} />
                </label>
                <Feld label="Begründung (optional)" name="begruendung" />
              </Formular>
              {auftrag ? (
                <p>
                  <a className="knopf zweit" href={auftrag} data-testid="ticket-auftrag-mail">
                    <Mail size={16} aria-hidden />
                    Auftrag per Mail an {auftragnehmer?.firma}
                  </a>
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="karte" data-testid="ticket-rechnungen">
            <h2>
              <ReceiptText
                size={18}
                aria-hidden
                style={{ verticalAlign: '-3px', marginRight: 6 }}
              />
              Rechnung
            </h2>
            {rechnungen.length > 0 ? (
              <ul className="import-liste">
                {rechnungen.map((r) => (
                  <li key={r.id}>
                    <Link href={`/belege/${r.id}`}>{r.titel}</Link>{' '}
                    <span className="leise">
                      {r.buchung
                        ? `gebucht als ${r.buchung.belegnummer}, ${euroAnzeige(r.buchung.bruttoCent)}`
                        : 'noch nicht gebucht'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="leise">
                Die Rechnung des Handwerkers hier ablegen: Sie landet unter Belegen, mit Objekt und
                Handwerker aus dem Ticket.
              </p>
            )}
            {schreiben ? (
              <>
                <BelegImport
                  hochladen={belegHochladen}
                  auslesen={belegAuslesenDirekt}
                  ki={kiEingerichtet()}
                  ticketId={t.id}
                />
                {kiEingerichtet() ? <KiHinweis was="Jede hochgeladene Rechnung" /> : null}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </>
  )
}
