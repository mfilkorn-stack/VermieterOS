import { loeschen } from '@/app/(app)/objekte/[id]/aktionen'
import { Formular } from './formular'

/**
 * Löschen am Ende einer Seite, eingeklappt. Hängt noch etwas daran, steht dort, was zuerst weg
 * muss; sonst ein Haken zur Bestätigung. Gelöscht wird per Storno, der Verlauf bleibt erhalten.
 */
export function LoeschKarte({
  art,
  id,
  objektId,
  einheitId,
  name,
  hindernisse,
  eingebettet,
}: {
  art: 'objekt' | 'einheit' | 'mietverhaeltnis'
  id: string
  objektId: string
  einheitId?: string
  name: string
  hindernisse: string[]
  /** Innerhalb einer Karte: ohne eigenen Kartenrahmen */
  eingebettet?: boolean
}) {
  return (
    <details
      className={eingebettet ? 'loeschen' : 'karte loeschen'}
      data-testid={'loeschen-' + art}
    >
      <summary>{name} löschen</summary>
      {hindernisse.length ? (
        <p data-testid="loesch-hindernisse">
          Löschen geht erst, wenn nichts mehr daran hängt. Noch vorhanden: {hindernisse.join(', ')}.
        </p>
      ) : (
        <Formular aktion={loeschen} knopf="Endgültig löschen" testId="loesch-formular">
          <input type="hidden" name="art" value={art} />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="objektId" value={objektId} />
          {einheitId ? <input type="hidden" name="einheitId" value={einheitId} /> : null}
          <p className="leise">
            Verschwindet aus allen Listen. Im Änderungsprotokoll bleibt nachvollziehbar, dass und
            wann gelöscht wurde.
          </p>
          <label className="haken">
            <input type="checkbox" name="bestaetigt" required />
            Ja, {name} löschen
          </label>
          <label>
            Grund (optional)
            <input name="grund" placeholder="z. B. doppelt angelegt" />
          </label>
        </Formular>
      )}
    </details>
  )
}
