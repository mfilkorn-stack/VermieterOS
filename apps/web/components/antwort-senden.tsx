import type { Antwort } from '@vermieteros/db'
import { Reply } from 'lucide-react'
import { antwortSenden } from '@/app/(app)/posteingang/[id]/antwort-aktionen'
import { Feld } from './felder'
import { Formular } from './formular'
import { zeitpunktAnzeige } from '@/lib/format'

/**
 * Antwort aus der App: vorbefüllt mit dem übernommenen KI-Entwurf, sonst leer. Schon verschickte
 * Antworten stehen darüber; danach ist das Feld leer, damit nichts doppelt rausgeht.
 */
export function AntwortSenden(p: {
  /** Mail oder Nachricht aus dem Mieterportal, auf die geantwortet wird */
  nachrichtId?: string
  portalNachrichtId?: string
  an: string
  betreff: string
  entwurf: string | null
  gesendet: Antwort[]
  darf: boolean
  moeglich: boolean
  absender: string
  postfachAdresse: string | null
}) {
  return (
    <div className="karte" id="antworten" data-testid="antwort-senden">
      <h2>
        <Reply size={18} aria-hidden style={{ verticalAlign: '-3px', marginRight: 6 }} />
        Antworten
      </h2>
      {p.gesendet.length ? (
        <ul className="leise" data-testid="antwort-gesendet">
          {p.gesendet.map((a) => (
            <li key={a.id}>
              Gesendet {zeitpunktAnzeige(a.gesendetAm)} an {a.an.join(', ')}: „{a.betreff}“
            </li>
          ))}
        </ul>
      ) : null}
      {!p.darf ? null : !p.moeglich ? (
        <p className="leise">
          Der Mailversand ist in dieser Installation nicht eingerichtet. Der Entwurf lässt sich im
          Mailprogramm öffnen.
        </p>
      ) : (
        <Formular aktion={antwortSenden} knopf="Antwort senden" testId="antwort-formular">
          {p.nachrichtId ? <input type="hidden" name="nachrichtId" value={p.nachrichtId} /> : null}
          {p.portalNachrichtId ? (
            <input type="hidden" name="portalNachrichtId" value={p.portalNachrichtId} />
          ) : null}
          <div className="zeile">
            <Feld label="An" name="an" type="email" defaultValue={p.an} required />
            <Feld
              label="Betreff"
              name="betreff"
              defaultValue={p.betreff.startsWith('Re:') ? p.betreff : 'Re: ' + p.betreff}
              required
            />
          </div>
          <label>
            Text
            <textarea
              name="text"
              rows={10}
              defaultValue={p.gesendet.length ? '' : (p.entwurf ?? '')}
              required
            />
          </label>
          <p className="leise">
            Absender {p.absender}.{' '}
            {p.postfachAdresse
              ? 'Rückantworten gehen an ' + p.postfachAdresse + ' und erscheinen im Posteingang.'
              : 'Das Postfach hat keine Mailadresse als Benutzer; Rückantworten gehen an den Absender.'}
          </p>
        </Formular>
      )}
    </div>
  )
}
