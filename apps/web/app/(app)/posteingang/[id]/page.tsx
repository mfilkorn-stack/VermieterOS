import {
  antwortenZuNachricht,
  dokumenteZuAnhaengen,
  juengsterKiVorschlag,
  ladeNachricht,
  ladeZuordnungsKandidaten,
  listeHandwerker,
  listeTickets,
} from '@vermieteros/db'
import { nachrichtFakten } from '@vermieteros/ki'
import { Download, FileText, Mail, Wrench } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { AntwortSenden } from '@/components/antwort-senden'
import { AntwortKarte, EinschaetzungKarte, entwurfText } from '@/components/ki-karten'
import { TicketStatusBadge } from '@/components/ticket-badges'
import { Feld } from '@/components/felder'
import { Formular } from '@/components/formular'
import { DokumentArtAuswahl } from '@/components/dokument-art-auswahl'
import { ablegbar } from '@/lib/upload'
import { anhangAlsDokument } from '../../dokumente/aktionen'
import { ZuordnenFormular, zielWert } from '@/components/zuordnen-formular'
import { ZuordnungAnzeige } from '@/components/zuordnung-anzeige'
import { zeitpunktAnzeige } from '@/lib/format'
import { objektliste } from '@/lib/objekte'
import { groesseText, mietverhaeltnisText, ZUORDNUNG_TEXT } from '@/lib/post-text'
import { darf, mitMandant } from '@/lib/sitzung'
import { sicheresZiel } from '@/lib/ziel'
import { KiHinweis } from '@/components/ki-hinweis'
import { kiEingerichtet } from '@/lib/ki'
import { absenderAdresse, mailEingerichtet } from '@/lib/mail'

export default async function NachrichtSeite({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ zurueck?: string }>
}) {
  const { id } = await params
  // Zurück in die Liste mit Filter oder Suchbegriff, wie der Nutzer sie verlassen hat
  const zurueck = sicheresZiel((await searchParams).zurueck ?? null, '/posteingang')
  if (!(await darf({ post: ['lesen'] }))) redirect('/')
  const zuordnen = await darf({ post: ['zuordnen'] })
  const daten = await mitMandant(async (tx) => {
    const n = await ladeNachricht(tx, id)
    if (!n) return null
    const bezug = { entitaet: 'nachricht', id }
    return {
      n,
      kandidaten: await ladeZuordnungsKandidaten(tx),
      sortierung: await juengsterKiVorschlag(tx, 'sortierung', bezug),
      antwort: await juengsterKiVorschlag(tx, 'antwortvorschlag', bezug),
      fakten: await nachrichtFakten(tx, id),
      tickets: await listeTickets(tx, { nachrichtId: id }),
      abgelegt: await dokumenteZuAnhaengen(tx, id),
      objekte: await objektliste(tx),
      handwerker: await listeHandwerker(tx),
      antworten: await antwortenZuNachricht(tx, id),
    }
  })
  if (!daten) notFound()
  const {
    n,
    kandidaten,
    sortierung,
    antwort,
    fakten,
    tickets,
    abgelegt,
    objekte,
    handwerker,
    antworten,
  } = daten
  const schreiben = await darf({ stammdaten: ['schreiben'] })
  const kandidatNach = new Map(kandidaten.map((k) => [k.mietverhaeltnisId, k]))
  const namen = {
    kandidaten: kandidatNach,
    objekte: new Map(objekte.map((o) => [o.id, o.bezeichnung])),
    handwerker: new Map(handwerker.map((h) => [h.id, h.firma])),
  }
  const aktuell = n.zuordnungen.at(-1) ?? null
  const mv = aktuell?.mietverhaeltnisId ? kandidatNach.get(aktuell.mietverhaeltnisId) : undefined
  const zugeordnet = Boolean(aktuell && zielWert(aktuell))
  const mailApp = mailEingerichtet()

  return (
    <>
      <nav className="brotkrumen" aria-label="Pfad">
        <Link href={zurueck}>Posteingang</Link>
        <span aria-hidden>/</span>
        <span>Nachricht</span>
      </nav>
      <div className="seitenkopf">
        <h1 data-testid="nachricht-betreff">{n.betreff || '(ohne Betreff)'}</h1>
      </div>
      <div className="raster-2">
        <div>
          <dl className="karte kopfdaten">
            <dt>Von</dt>
            <dd>{n.vonName ? `${n.vonName} <${n.vonAdresse}>` : n.vonAdresse}</dd>
            <dt>An</dt>
            <dd>{n.an.join(', ') || '–'}</dd>
            <dt>Gesendet</dt>
            <dd>{zeitpunktAnzeige(n.gesendetAm)}</dd>
            <dt>Eingegangen</dt>
            <dd>
              {zeitpunktAnzeige(n.empfangenAm)} · Postfach {n.postfach}
            </dd>
          </dl>
          <div className="karte">
            <h2>Text</h2>
            <pre className="mailtext" data-testid="nachricht-text">
              {n.text || '(kein Textteil; die vollständige Mail steht in der .eml)'}
            </pre>
          </div>

          <div className="karte">
            <h2>Dateien</h2>
            <ul className="dateien" data-testid="anhaenge">
              {n.anhaenge.map((a) => (
                <li key={a.id} className="datei">
                  <FileText size={20} strokeWidth={1.75} aria-hidden />
                  <span className="text">
                    <a href={`/api/anhang/${a.id}`} download>
                      {a.dateiname}
                    </a>
                    <span className="pruefsumme">
                      {groesseText(a.groesse)} · SHA-256 {a.sha256.slice(0, 12)}…
                    </span>
                  </span>
                  <Download size={16} color="var(--dezent)" aria-hidden />
                  {abgelegt
                    .filter((x) => x.anhangId === a.id)
                    .map((x) => (
                      <Link
                        key={x.dokumentId}
                        href={(x.beleg ? '/belege/' : '/dokumente/') + x.dokumentId}
                        className="knopf zweit klein"
                        data-testid={'abgelegt-' + a.dateiname}
                      >
                        {x.beleg ? 'Beleg öffnen' : 'Dokument öffnen'}
                      </Link>
                    ))}
                  {schreiben &&
                  ablegbar(a.mimeTyp, a.dateiname) &&
                  !abgelegt.some((x) => x.anhangId === a.id) ? (
                    <details className="ablegen">
                      <summary>Ablegen als Beleg oder Dokument</summary>
                      <Formular
                        aktion={anhangAlsDokument}
                        knopf={kiEingerichtet() ? 'Als Beleg auslesen' : 'Als Beleg übernehmen'}
                        testId={'als-beleg-' + a.dateiname}
                        zweit
                      >
                        <input type="hidden" name="anhangId" value={a.id} />
                        <input type="hidden" name="typ" value="beleg" />
                        <input type="hidden" name="titel" value={n.betreff || a.dateiname} />
                        {mv ? (
                          <input
                            type="hidden"
                            name="mietverhaeltnisId"
                            value={mv.mietverhaeltnisId}
                          />
                        ) : null}
                      </Formular>
                      <p className="leise">Oder als Dokument an Mietverhältnis oder Objekt:</p>
                      <Formular
                        aktion={anhangAlsDokument}
                        knopf={kiEingerichtet() ? 'Ablegen und auslesen' : 'Ablegen'}
                        testId={'ablegen-' + a.dateiname}
                      >
                        <input type="hidden" name="anhangId" value={a.id} />
                        {mv ? (
                          <input
                            type="hidden"
                            name="mietverhaeltnisId"
                            value={mv.mietverhaeltnisId}
                          />
                        ) : (
                          <label>
                            Objekt
                            <select name="objektId" required defaultValue="">
                              <option value="" disabled>
                                Bitte wählen
                              </option>
                              {objekte.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.bezeichnung}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        <DokumentArtAuswahl
                          defaultValue={
                            a.mimeTyp === 'application/pdf' && mv ? 'mietvertrag' : 'sonstiges'
                          }
                        />
                        <Feld label="Titel" name="titel" defaultValue={a.dateiname} />
                      </Formular>
                    </details>
                  ) : null}
                </li>
              ))}
              <li className="datei">
                <Mail size={20} strokeWidth={1.75} aria-hidden />
                <span className="text">
                  <a href={`/api/nachricht/${n.id}/roh`} download data-testid="rohmail">
                    Vollständige Mail (.eml)
                  </a>
                  <span className="pruefsumme">
                    {groesseText(n.rohGroesse)} · SHA-256 {n.rohSha256.slice(0, 12)}…
                  </span>
                </span>
                <Download size={16} color="var(--dezent)" aria-hidden />
              </li>
            </ul>
          </div>
        </div>
        <div>
          <EinschaetzungKarte nachrichtId={n.id} v={sortierung} darf={zuordnen} />
          <div className="karte" data-testid="zuordnung">
            <h2>Zuordnung</h2>
            <p className="meta">
              <ZuordnungAnzeige z={aktuell} namen={namen} />
            </p>
            {zuordnen ? (
              <details open={!zugeordnet}>
                <summary>{zugeordnet ? 'Zuordnung ändern' : 'Zuordnen'}</summary>
                <ZuordnenFormular
                  nachrichtId={n.id}
                  aktuell={aktuell ? zielWert(aktuell) : ''}
                  ziele={{ kandidaten, objekte, handwerker }}
                  zurueck={`/posteingang/${n.id}`}
                />
              </details>
            ) : null}
            {n.zuordnungen.length > 0 ? (
              <details>
                <summary>Verlauf der Zuordnung</summary>
                <ol className="leise" data-testid="zuordnungsverlauf">
                  {n.zuordnungen.map((z, i) => {
                    const k = z.mietverhaeltnisId
                      ? kandidatNach.get(z.mietverhaeltnisId)
                      : undefined
                    const ziel = k
                      ? mietverhaeltnisText(k)
                      : z.objektId
                        ? (namen.objekte.get(z.objektId) ?? 'Objekt')
                        : z.handwerkerId
                          ? (namen.handwerker.get(z.handwerkerId) ?? 'Handwerker')
                          : 'keins'
                    return (
                      <li key={i}>
                        {zeitpunktAnzeige(z.erfasstAm)}: {ziel} · {ZUORDNUNG_TEXT[z.art]}
                        {z.akteurArt === 'system' ? '' : ' · Nutzer'}
                        {z.begruendung ? ` · „${z.begruendung}“` : ''}
                      </li>
                    )
                  })}
                </ol>
              </details>
            ) : null}
          </div>
          {tickets.length || schreiben ? (
            <div className="karte" data-testid="nachricht-tickets">
              <h2>Tickets</h2>
              {tickets.map((t) => (
                <p key={t.id} className="meta">
                  <Link href={`/tickets/${t.id}`}>{t.titel}</Link>
                  <TicketStatusBadge status={t.status} />
                </p>
              ))}
              {schreiben ? (
                <Link
                  className="knopf zweit"
                  href={`/tickets/neu?nachricht=${n.id}`}
                  data-testid="nachricht-ticket-neu"
                >
                  <Wrench size={16} aria-hidden />
                  Ticket anlegen
                </Link>
              ) : null}
            </div>
          ) : null}
          <AntwortKarte
            nachrichtId={n.id}
            v={antwort}
            fakten={fakten}
            darf={zuordnen}
            an={n.vonAdresse}
            betreff={n.betreff}
            mailprogramm={!mailApp}
          />
          {kiEingerichtet() ? <KiHinweis was="Der Inhalt dieser Mail" /> : null}
          <AntwortSenden
            nachrichtId={n.id}
            an={n.vonAdresse}
            betreff={n.betreff}
            entwurf={entwurfText(antwort, fakten)}
            gesendet={antworten}
            darf={zuordnen}
            moeglich={mailApp}
            absender={absenderAdresse()}
            postfachAdresse={n.postfachAdresse}
          />
        </div>
      </div>
    </>
  )
}
