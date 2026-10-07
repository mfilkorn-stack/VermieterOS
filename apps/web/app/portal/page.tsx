import { FileText, LogOut, MessageSquare, Phone, Wrench } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { TicketStatusBadge } from '@/components/ticket-badges'
import { NOTFALL_TEXT, WISSEN_TEXT } from '@/lib/betrieb-text'
import { DOKUMENT_TYP_TEXT } from '@/lib/dokument-text'
import { datumAnzeige, euroAnzeige, zeitpunktAnzeige } from '@/lib/format'
import { mitPortal } from '@/lib/portal'
import { portalUebersicht } from '@/lib/portal-daten'
import { abmelden } from './aktionen'

export default async function PortalStart({
  searchParams,
}: {
  searchParams: Promise<{ gemeldet?: string; gesendet?: string }>
}) {
  const q = await searchParams
  const u = await mitPortal((tx, s) => portalUebersicht(tx, s))
  if (!u) notFound()
  const k = u.kondition
  return (
    <>
      <div className="karte" data-testid="portal-wohnung">
        <div className="zeile">
          <h1>Ihre Wohnung</h1>
          <form action={abmelden}>
            <button type="submit" className="zweit" data-testid="portal-abmelden">
              <LogOut size={16} aria-hidden /> Abmelden
            </button>
          </form>
        </div>
        <p>
          {u.wohnung.anschrift.join(', ')}
          {u.wohnung.lage ? ` · ${u.wohnung.lage}` : ''}
        </p>
        <dl className="kopfdaten">
          <dt>Mieter</dt>
          <dd>{u.mieter.join(', ')}</dd>
          <dt>Vermieter</dt>
          <dd>{[u.vermieter.name, ...u.vermieter.anschrift].filter(Boolean).join(', ')}</dd>
          <dt>Mietbeginn</dt>
          <dd>{datumAnzeige(u.beginn)}</dd>
          {u.ende ? (
            <>
              <dt>Mietende</dt>
              <dd>{datumAnzeige(u.ende)}</dd>
            </>
          ) : null}
          {k ? (
            <>
              <dt>Kaltmiete</dt>
              <dd data-testid="portal-kaltmiete">{euroAnzeige(k.kaltmieteCent)}</dd>
              <dt>Vorauszahlungen</dt>
              <dd>
                {euroAnzeige(k.vorauszahlungBkCent + k.vorauszahlungHkCent)} (Betriebskosten{' '}
                {euroAnzeige(k.vorauszahlungBkCent)}, Heizung {euroAnzeige(k.vorauszahlungHkCent)})
              </dd>
              <dt>Monatlich gesamt</dt>
              <dd>
                <strong>
                  {euroAnzeige(k.kaltmieteCent + k.vorauszahlungBkCent + k.vorauszahlungHkCent)}
                </strong>{' '}
                <span className="leise">seit {datumAnzeige(k.gueltigAb)}</span>
              </dd>
            </>
          ) : null}
        </dl>
      </div>

      {q.gemeldet ? (
        <p className="karte" role="status" data-testid="portal-bestaetigung">
          Danke, Ihre Meldung ist eingegangen. Den Stand sehen Sie unten.
        </p>
      ) : null}
      {q.gesendet ? (
        <p className="karte" role="status" data-testid="portal-bestaetigung">
          Danke, Ihre Nachricht ist eingegangen.
        </p>
      ) : null}

      <div className="aktionen">
        <Link className="knopf" href="/portal/mangel" data-testid="portal-mangel">
          <Wrench size={16} aria-hidden /> Mangel melden
        </Link>
        <Link className="knopf zweit" href="/portal/nachricht" data-testid="portal-nachricht">
          <MessageSquare size={16} aria-hidden /> Nachricht schreiben
        </Link>
      </div>

      {u.notfall.length ? (
        <div className="karte notfall" data-testid="portal-notfall">
          <h2>Im Notfall</h2>
          <ul className="liste-schlicht">
            {u.notfall.map((z, i) => (
              <li key={i}>
                <strong>{NOTFALL_TEXT[z.art]}</strong>: {z.name}
                {z.telefon ? (
                  <>
                    {' '}
                    <a href={`tel:${z.telefon.replace(/[^\d+]/g, '')}`}>
                      <Phone size={14} aria-hidden /> {z.telefon}
                    </a>
                  </>
                ) : null}
                {z.hinweis ? <div className="leise">{z.hinweis}</div> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="karte" data-testid="portal-tickets">
        <h2>Ihre Meldungen</h2>
        {u.tickets.length === 0 ? (
          <p className="leise">Noch keine Meldungen.</p>
        ) : (
          <ul className="liste-schlicht">
            {u.tickets.map((t) => (
              <li key={t.id} className="zeile">
                <span>
                  {t.titel}
                  <span className="leise">
                    {' '}
                    · {zeitpunktAnzeige(t.angelegtAm)}
                    {t.termin ? ` · Termin ${datumAnzeige(t.termin)}` : ''}
                  </span>
                </span>
                <TicketStatusBadge status={t.status} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="karte" data-testid="portal-dokumente">
        <h2>Vertrag und Dokumente</h2>
        {u.dokumente.length === 0 ? (
          <p className="leise">Noch keine Dokumente freigegeben.</p>
        ) : (
          <ul className="liste-schlicht">
            {u.dokumente.map((d) => (
              <li key={d.id}>
                <a href={`/portal/dokument/${d.id}?ansicht=1`} target="_blank" rel="noreferrer">
                  <FileText size={14} aria-hidden /> {d.titel}
                </a>
                <span className="leise">
                  {' '}
                  · {DOKUMENT_TYP_TEXT[d.typ]}
                  {d.dokumentdatum ? `, ${datumAnzeige(d.dokumentdatum)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {u.wissen.length ? (
        <div className="karte" data-testid="portal-wissen">
          <h2>Gut zu wissen</h2>
          {u.wissen.map((w) => (
            <details key={w.id}>
              <summary>
                {w.titel} <span className="leise">· {WISSEN_TEXT[w.kategorie]}</span>
              </summary>
              <p style={{ whiteSpace: 'pre-wrap' }}>{w.inhalt}</p>
            </details>
          ))}
        </div>
      ) : null}
    </>
  )
}
