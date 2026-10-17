import { handwerkerAuftraege, handwerkerKommunikation, listeHandwerker } from '@vermieteros/db'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Formular } from '@/components/formular'
import { HandwerkerFormular } from '@/components/handwerker-formular'
import { Status } from '@/components/status'
import { adresssucheAn } from '@/lib/adresse'
import { TICKET_STATUS_TEXT } from '@/lib/betrieb-text'
import { firmensucheAn } from '@/lib/firma'
import { datumAnzeige, zeitpunktAnzeige } from '@/lib/format'
import { objektliste } from '@/lib/objekte'
import { darf, mitMandant } from '@/lib/sitzung'
import { heuteBerlin } from '@/lib/zeit'
import { handwerkerEntfernen } from '../aktionen'

export default async function HandwerkerBearbeiten({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!(await darf({ stammdaten: ['schreiben'] }))) redirect('/handwerker')
  const post = await darf({ post: ['lesen'] })
  const { h, objekte, auftraege, mails } = await mitMandant(async (tx) => ({
    h: (await listeHandwerker(tx)).find((x) => x.id === id),
    objekte: await objektliste(tx),
    auftraege: await handwerkerAuftraege(tx, id),
    mails: post ? await handwerkerKommunikation(tx, id) : [],
  }))
  if (!h) notFound()
  const offen = auftraege.filter((t) => !['abgeschlossen', 'verworfen'].includes(t.status)).length
  return (
    <>
      <nav className="brotkrumen" aria-label="Pfad">
        <Link href="/handwerker">Handwerker</Link>
        <span aria-hidden>/</span>
        <span>{h.firma}</span>
      </nav>
      <div className="karte">
        <h1>{h.firma}</h1>
        <HandwerkerFormular
          h={h}
          objekte={objekte}
          heute={heuteBerlin()}
          firmensuche={firmensucheAn()}
          adresssuche={adresssucheAn()}
        />
      </div>
      <div className="karte">
        <h2>Aufträge</h2>
        {auftraege.length === 0 ? (
          <p className="leise">Noch keine Aufträge an diesen Handwerker.</p>
        ) : (
          <>
            <p className="leise">
              {auftraege.length === 1 ? '1 Auftrag' : auftraege.length + ' Aufträge'}, davon {offen}{' '}
              offen.
            </p>
            <ul className="liste-schlicht" data-testid="handwerker-auftraege">
              {auftraege.map((t) => (
                <li key={t.id} className="zeile">
                  <span>
                    <Link href={`/tickets/${t.id}`}>{t.titel}</Link>
                    <span className="leise">
                      {' · '}
                      {[t.objekt, t.einheit].filter(Boolean).join(' · ')}
                      {' · '}
                      {datumAnzeige(t.angelegtAm)}
                    </span>
                  </span>
                  <Status
                    ton={
                      t.status === 'abgeschlossen' || t.status === 'verworfen' ? 'neutral' : 'gelb'
                    }
                  >
                    {TICKET_STATUS_TEXT[t.status]}
                  </Status>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {post ? (
        <div className="karte">
          <h2>Kommunikation</h2>
          {mails.length === 0 ? (
            <p className="leise">Keine Mails mit diesem Handwerker.</p>
          ) : (
            <ul className="liste-schlicht" data-testid="handwerker-post">
              {mails.map((m) => {
                const ziel =
                  m.richtung === 'eingang' || !m.ticketId
                    ? m.nachrichtId
                      ? `/posteingang/${m.nachrichtId}`
                      : null
                    : `/tickets/${m.ticketId}`
                return (
                  <li key={m.id} className="zeile" data-richtung={m.richtung}>
                    <span>
                      <span className="leise">
                        {m.richtung === 'eingang' ? 'Eingang · ' : 'Gesendet · '}
                      </span>
                      {ziel ? (
                        <Link href={ziel}>{m.betreff || '(ohne Betreff)'}</Link>
                      ) : (
                        m.betreff || '(ohne Betreff)'
                      )}
                    </span>
                    <span className="leise">{zeitpunktAnzeige(m.zeitpunkt)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}
      <div className="karte">
        <h2>Aus dem Verzeichnis entfernen</h2>
        <p className="leise">
          Bleibt in der Historie erhalten; Tickets und Notfallkarten zeigen ihn danach nicht mehr
          an.
        </p>
        <Formular
          aktion={handwerkerEntfernen}
          knopf="Entfernen"
          testId="handwerker-entfernen"
          zweit
        >
          <input type="hidden" name="handwerkerId" value={h.id} />
        </Formular>
      </div>
    </>
  )
}
