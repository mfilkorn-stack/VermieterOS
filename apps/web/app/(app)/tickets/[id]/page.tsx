import { belegeZuTicket, ladeTicket, listeHandwerker, ticketVerlauf } from '@vermieteros/db'
import { TICKET_STATUS } from '@vermieteros/schema'
import { Mail, MapPin, ReceiptText } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BelegImport } from '@/components/beleg-import'
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

export default async function TicketSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const d = await mitMandant(async (tx) => {
    const t = await ladeTicket(tx, id)
    if (!t) return null
    return {
      t,
      verlauf: await ticketVerlauf(tx, id),
      rechnungen: await belegeZuTicket(tx, id),
      handwerker: (await listeHandwerker(tx)).filter(
        (h) => h.objektIds.length === 0 || h.objektIds.includes(t.objektId),
      ),
    }
  })
  if (!d) notFound()
  const { t, verlauf, handwerker, rechnungen } = d
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
              <h2>Weiter bearbeiten</h2>
              <Formular
                aktion={ticketAktualisieren}
                knopf="Speichern"
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
                Die Rechnung des Handwerkers hier ablegen: Sie landet als Beleg im Belegeingang, mit
                Objekt und Handwerker aus dem Ticket.
              </p>
            )}
            {schreiben ? (
              <BelegImport
                hochladen={belegHochladen}
                auslesen={belegAuslesenDirekt}
                ki={kiEingerichtet()}
                ticketId={t.id}
              />
            ) : null}
          </div>
        </div>
      </div>
    </>
  )
}
