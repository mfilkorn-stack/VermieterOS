import type { KiVorschlag } from '@vermieteros/db'
import {
  rendere,
  RenderFehler,
  type Antwortvorschlag,
  type Fakten,
  type Sortierung,
} from '@vermieteros/ki'
import { Mail, MessageSquareText, Sparkles, TriangleAlert } from 'lucide-react'
import { kiErzeugen, kiUebernehmen, kiVerwerfen } from '@/app/(app)/posteingang/[id]/ki-aktionen'
import { Formular } from './formular'
import { SortierBadges } from './ki-sortierung'
import { Status } from './status'

const STATUS_TEXT: Record<string, string> = {
  verworfen: 'Der letzte Vorschlag wurde verworfen.',
  veraltet: 'Der letzte Vorschlag ist veraltet, weil sich die Daten seitdem geändert haben.',
}

function Knopf({
  aktion,
  aufgabe,
  nachrichtId,
  vorschlagId,
  text,
  testId,
  zweit,
}: {
  aktion: typeof kiErzeugen
  aufgabe?: string
  nachrichtId: string
  vorschlagId?: string
  text: string
  testId: string
  zweit?: boolean
}) {
  return (
    <Formular aktion={aktion} knopf={text} testId={testId} zweit={zweit ?? false}>
      <input type="hidden" name="nachrichtId" value={nachrichtId} />
      {aufgabe ? <input type="hidden" name="aufgabe" value={aufgabe} /> : null}
      {vorschlagId ? <input type="hidden" name="vorschlagId" value={vorschlagId} /> : null}
    </Formular>
  )
}

/** Einschätzung der KI: Kategorie, Dringlichkeit, Frist mit Beleg. */
export function EinschaetzungKarte({
  nachrichtId,
  v,
  darf,
}: {
  nachrichtId: string
  v: KiVorschlag | null
  darf: boolean
}) {
  const s =
    v && (v.status === 'offen' || v.status === 'bestaetigt') ? (v.ausgabe as Sortierung) : null
  return (
    <div className="karte" data-testid="einschaetzung">
      <h2>
        <Sparkles size={18} aria-hidden style={{ verticalAlign: '-3px', marginRight: 6 }} />
        Einschätzung
      </h2>
      {s ? (
        <>
          <SortierBadges s={s} />
          <p>{s.zusammenfassung}</p>
          {s.frist ? <p className="leise">Frist laut Mail: „{s.frist.beleg}“</p> : null}
          <p className="leise">{s.begruendung}</p>
          {v?.status === 'bestaetigt' ? (
            <Status ton="gruen">bestätigt</Status>
          ) : darf ? (
            <div className="aktionen">
              <Knopf
                aktion={kiUebernehmen}
                nachrichtId={nachrichtId}
                vorschlagId={v!.id}
                text="Passt"
                testId="einschaetzung-passt"
              />
              <Knopf
                aktion={kiVerwerfen}
                nachrichtId={nachrichtId}
                vorschlagId={v!.id}
                text="Passt nicht"
                zweit
                testId="einschaetzung-verwerfen"
              />
            </div>
          ) : null}
        </>
      ) : (
        <>
          <p className="leise">
            {v
              ? STATUS_TEXT[v.status]
              : 'Noch keine Einschätzung. Neue Mails werden automatisch eingeordnet.'}
          </p>
          {darf ? (
            <Knopf
              aktion={kiErzeugen}
              aufgabe="sortierung"
              nachrichtId={nachrichtId}
              text="Einschätzen lassen"
              testId="einschaetzung-erzeugen"
            />
          ) : null}
        </>
      )}
    </div>
  )
}

function gerendert(text: string, fakten: Fakten): { text: string; fehlend: string[] } {
  try {
    return { text: rendere(text, fakten), fehlend: [] }
  } catch (e) {
    if (e instanceof RenderFehler) return { text, fehlend: e.fehlend }
    throw e
  }
}

/** Übernommener Entwurf mit eingesetzten Fakten, zum Vorbefüllen der Antwort; sonst null. */
export function entwurfText(v: KiVorschlag | null, fakten: Fakten): string | null {
  if (!v || v.status !== 'bestaetigt') return null
  const r = gerendert((v.ausgabe as Antwortvorschlag).entwurf, fakten)
  return r.fehlend.length ? null : r.text
}

/** Antwortentwurf: Fakten setzt der Code beim Anzeigen ein, Zusagen sind markiert. */
export function AntwortKarte({
  nachrichtId,
  v,
  fakten,
  darf,
  an,
  betreff,
  mailprogramm = true,
}: {
  nachrichtId: string
  v: KiVorschlag | null
  fakten: Fakten
  darf: boolean
  an: string
  betreff: string
  /** Ohne Mailversand in der App bleibt nur der Weg über das Mailprogramm */
  mailprogramm?: boolean
}) {
  const a =
    v && (v.status === 'offen' || v.status === 'bestaetigt')
      ? (v.ausgabe as Antwortvorschlag)
      : null
  const r = a ? gerendert(a.entwurf, fakten) : null
  const mailto = r
    ? [
        'mailto:',
        encodeURIComponent(an),
        '?subject=',
        encodeURIComponent(`Re: ${betreff}`),
        '&body=',
        encodeURIComponent(r.text),
      ].join('')
    : ''
  return (
    <div className="karte" data-testid="antwort">
      <h2>
        <MessageSquareText
          size={18}
          aria-hidden
          style={{ verticalAlign: '-3px', marginRight: 6 }}
        />
        Antwortentwurf
      </h2>
      {a && r ? (
        <>
          {a.zusagen.length ? (
            <div className="ki-hinweis" data-testid="antwort-zusagen">
              <Status ton="gelb" icon={TriangleAlert}>
                enthält Zusagen
              </Status>
              <ul>
                {a.zusagen.map((z, i) => (
                  <li key={i}>{z}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {r.fehlend.length ? (
            <p className="fehler">Für diese Platzhalter fehlt ein Wert: {r.fehlend.join(', ')}</p>
          ) : null}
          <pre className="mailtext entwurf" data-testid="antwort-text">
            {r.text}
          </pre>
          {a.offene_punkte.length ? (
            <>
              <p className="leise">Vor dem Senden klären:</p>
              <ul className="leise">
                {a.offene_punkte.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </>
          ) : null}
          {v!.status === 'bestaetigt' ? (
            <div className="aktionen">
              <Status ton="gruen">übernommen</Status>
              {r.fehlend.length === 0 && mailprogramm ? (
                <a className="knopf" href={mailto} data-testid="antwort-mailto">
                  <Mail size={16} aria-hidden />
                  Im Mailprogramm öffnen
                </a>
              ) : r.fehlend.length === 0 ? (
                <a className="knopf" href="#antworten" data-testid="antwort-weiter">
                  <Mail size={16} aria-hidden />
                  Zur Antwort
                </a>
              ) : null}
              {darf ? (
                <Knopf
                  aktion={kiErzeugen}
                  aufgabe="antwortvorschlag"
                  nachrichtId={nachrichtId}
                  text="Neuen Entwurf erstellen"
                  testId="antwort-neu"
                />
              ) : null}
            </div>
          ) : darf ? (
            <div className="aktionen">
              <Knopf
                aktion={kiUebernehmen}
                nachrichtId={nachrichtId}
                vorschlagId={v!.id}
                text={mailprogramm ? 'Übernehmen' : 'In Antwort übernehmen'}
                testId="antwort-uebernehmen"
              />
              <Knopf
                aktion={kiVerwerfen}
                nachrichtId={nachrichtId}
                vorschlagId={v!.id}
                text="Verwerfen"
                zweit
                testId="antwort-verwerfen"
              />
            </div>
          ) : null}
        </>
      ) : (
        <>
          <p className="leise">
            {v
              ? STATUS_TEXT[v.status]
              : 'Die KI entwirft eine Antwort. Beträge, Daten und Namen setzt die Software aus den Stammdaten ein.'}
          </p>
          {darf ? (
            <Knopf
              aktion={kiErzeugen}
              aufgabe="antwortvorschlag"
              nachrichtId={nachrichtId}
              text="Entwurf erstellen"
              testId="antwort-erzeugen"
            />
          ) : null}
        </>
      )}
    </div>
  )
}
