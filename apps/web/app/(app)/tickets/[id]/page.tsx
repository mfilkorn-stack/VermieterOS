import {
  auftraegeZuTicket,
  belegeZuTicket,
  ladeTicket,
  listeDokumente,
  listeHandwerker,
  listeMietverhaeltnisse,
  listePostfaecher,
  ticketVerlauf,
} from '@vermieteros/db'
import { TICKET_STATUS } from '@vermieteros/schema'
import { Mail, ReceiptText, Send } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BelegImport } from '@/components/beleg-import'
import { DokumentListe } from '@/components/dokument-liste'
import { Auswahl, Feld } from '@/components/felder'
import { Formular } from '@/components/formular'
import { PrioritaetBadge, TicketStatusBadge } from '@/components/ticket-badges'
import { optionen, PRIORITAET_TEXT, TICKET_STATUS_TEXT } from '@/lib/betrieb-text'
import { datumAnzeige, euroAnzeige, zeitpunktAnzeige } from '@/lib/format'
import { kiEingerichtet } from '@/lib/ki'
import { absenderAdresse, mailEingerichtet } from '@/lib/mail'
import { darf, mitMandant } from '@/lib/sitzung'
import { heuteBerlin, isoZuBerlin } from '@/lib/zeit'
import { belegAuslesenDirekt, belegHochladen } from '../../belege/aktionen'
import { auftragSenden, ticketAktualisieren } from '../aktionen'
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
      auftraege: await auftraegeZuTicket(tx, id),
      postfach: (await listePostfaecher(tx)).find(
        (x) => x.aktiv && x.zweck === 'post' && x.benutzer.includes('@'),
      ),
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
      // Mieter: das Mietverhältnis am Ticket, sonst das laufende der Einheit (P9)
      mv: await (async () => {
        const alle = await listeMietverhaeltnisse(tx, heuteBerlin())
        const direkt = alle.find((m) => m.mietverhaeltnisId === t.mietverhaeltnisId)
        if (direkt) return { ...direkt, abgeleitet: false }
        const laufend = t.einheitId
          ? alle.find((m) => m.einheitId === t.einheitId && m.laufend)
          : undefined
        return laufend ? { ...laufend, abgeleitet: true } : null
      })(),
    }
  })
  if (!d) notFound()
  const { t, verlauf, handwerker, rechnungen, fotos, dateien, mv, auftraege, postfach } = d
  const schreiben = await darf({ stammdaten: ['schreiben'] })
  const auftragnehmer = handwerker.find((h) => h.id === t.auftragnehmerId)
  const ort = t.einheit ? `${t.objekt} · ${t.einheit}` : t.objekt
  const auftragBetreff = 'Auftrag: ' + t.titel + ' (' + ort + ')'
  const auftragText = [
    'Guten Tag,',
    '',
    'bitte übernehmen Sie folgenden Auftrag:',
    '',
    t.beschreibung ?? t.titel,
    '',
    'Ort: ' + ort,
    t.termin
      ? 'Termin: ' + zeitpunktAnzeige(t.termin)
      : 'Bitte melden Sie sich mit einem Terminvorschlag.',
    '',
    'Mit freundlichen Grüßen',
  ].join('\n')
  const auftrag = auftragnehmer?.email
    ? [
        'mailto:',
        encodeURIComponent(auftragnehmer.email),
        '?subject=',
        encodeURIComponent(auftragBetreff),
        '&body=',
        encodeURIComponent(auftragText),
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
          </p>
        </div>
      </div>
      <div className="raster-2">
        <div>
          <dl className="karte kopfdaten" data-testid="ticket-wo">
            <dt>Objekt</dt>
            <dd>
              <Link href={`/objekte/${t.objektId}`}>{t.objekt}</Link>
            </dd>
            <dt>Einheit</dt>
            <dd>{t.einheit ?? 'ganzes Objekt'}</dd>
            <dt>Mieter</dt>
            <dd>
              {mv ? (
                <>
                  <Link
                    href={`/mietverhaeltnisse/${mv.mietverhaeltnisId}`}
                    data-testid="ticket-mieter"
                  >
                    {mv.mieterNamen.join(', ') || 'ohne Mieter'}
                  </Link>
                  <span className="leise">
                    {mv.ende
                      ? ' · ' + datumAnzeige(mv.beginn) + ' bis ' + datumAnzeige(mv.ende)
                      : ' · seit ' + datumAnzeige(mv.beginn)}
                  </span>
                  {mv.abgeleitet ? <span className="leise"> · laufend in der Einheit</span> : null}
                </>
              ) : (
                '–'
              )}
            </dd>
            <dt>Gemeldet</dt>
            <dd>
              {verlauf[0]
                ? zeitpunktAnzeige(verlauf[0].erfasstAm) + ' · ' + verlauf[0].erfasstVon
                : zeitpunktAnzeige(t.angelegtAm)}
            </dd>
            {t.nachrichtId ? (
              <>
                <dt>Ursprung</dt>
                <dd>
                  <Link href={`/posteingang/${t.nachrichtId}`}>Ursprüngliche Mail</Link>
                </dd>
              </>
            ) : null}
          </dl>
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
              <h2>Status</h2>
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
            </div>
          ) : null}
          {schreiben ? (
            <div className="karte" data-testid="ticket-auftrag">
              <h2>
                <Send size={18} aria-hidden style={{ verticalAlign: '-3px', marginRight: 6 }} />
                Auftrag an Handwerker
              </h2>
              {auftraege.length ? (
                <ul className="leise" data-testid="auftrag-gesendet">
                  {auftraege.map((a) => (
                    <li key={a.id}>
                      Gesendet {zeitpunktAnzeige(a.gesendetAm)} an {a.an.join(', ')}: „{a.betreff}“
                    </li>
                  ))}
                </ul>
              ) : null}
              {!auftragnehmer ? (
                <p className="leise">
                  Erst oben einen Handwerker wählen und speichern; dann geht der Auftrag von hier
                  per Mail raus und steht im Ticket.
                </p>
              ) : !auftragnehmer.email ? (
                <p className="leise">
                  Für {auftragnehmer.firma} ist keine Mailadresse hinterlegt.{' '}
                  <Link href={`/handwerker/${auftragnehmer.id}`}>Handwerker bearbeiten</Link>
                </p>
              ) : !mailEingerichtet() ? (
                <p>
                  <a
                    className="knopf zweit"
                    href={auftrag ?? '#'}
                    data-testid="ticket-auftrag-mail"
                  >
                    <Mail size={16} aria-hidden />
                    Im Mailprogramm öffnen
                  </a>
                  <span className="leise">
                    {' '}
                    Der Mailversand ist nicht eingerichtet; der Auftrag wird so nicht im Ticket
                    vermerkt.
                  </span>
                </p>
              ) : (
                <Formular aktion={auftragSenden} knopf="Auftrag senden" testId="auftrag-formular">
                  <input type="hidden" name="ticketId" value={t.id} />
                  <Feld
                    label="An"
                    name="an"
                    type="email"
                    defaultValue={auftragnehmer.email}
                    required
                  />
                  <Feld label="Betreff" name="betreff" defaultValue={auftragBetreff} required />
                  <label>
                    Text
                    <textarea
                      name="text"
                      rows={10}
                      defaultValue={auftraege.length ? '' : auftragText}
                      required
                    />
                  </label>
                  {fotos.length ? (
                    <label className="zeile">
                      <input type="checkbox" name="fotos" value="ja" defaultChecked />
                      {fotos.length === 1 ? 'Foto anhängen' : fotos.length + ' Fotos anhängen'}
                    </label>
                  ) : null}
                  <p className="leise">
                    Absender {absenderAdresse()}.{' '}
                    {postfach
                      ? 'Rückmeldungen gehen an ' +
                        postfach.benutzer +
                        ' und erscheinen im Posteingang.'
                      : 'Ohne Vermietungs-Postfach gehen Rückmeldungen an den Absender.'}
                    {t.status === 'gemeldet' ? ' Das Ticket steht danach auf „beauftragt“.' : ''}
                  </p>
                </Formular>
              )}
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
