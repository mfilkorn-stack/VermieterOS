import type { ZuordnungsKandidat } from '@vermieteros/db'
import { nachrichtZuordnen } from '@/app/(app)/posteingang/aktionen'
import { Formular } from './formular'
import { mietverhaeltnisText } from '@/lib/post-text'

export type Zuordnungsziele = {
  kandidaten: ZuordnungsKandidat[]
  objekte: Array<{ id: string; bezeichnung: string }>
  handwerker: Array<{ id: string; firma: string }>
}

/** Wert des Ziel-Felds: „mv:…“, „objekt:…“, „handwerker:…“, „erledigt“ oder leer (aufheben). */
export function zielWert(z: {
  mietverhaeltnisId: string | null
  objektId: string | null
  handwerkerId: string | null
  art: string
}): string {
  if (z.mietverhaeltnisId) return 'mv:' + z.mietverhaeltnisId
  if (z.objektId) return 'objekt:' + z.objektId
  if (z.handwerkerId) return 'handwerker:' + z.handwerkerId
  return z.art === 'erledigt' ? 'erledigt' : ''
}

/**
 * Zuordnen zu Mietverhältnis, Objekt (WEG, Behörde, Versorger) oder Handwerker, als erledigt
 * abschließen oder die Zuordnung aufheben (leere Auswahl).
 */
export function ZuordnenFormular({
  nachrichtId,
  aktuell,
  ziele,
  zurueck,
}: {
  nachrichtId: string
  aktuell: string
  ziele: Zuordnungsziele
  zurueck: string
}) {
  return (
    <Formular aktion={nachrichtZuordnen} knopf="Zuordnen" testId="zuordnen">
      <input type="hidden" name="nachrichtId" value={nachrichtId} />
      <input type="hidden" name="zurueck" value={zurueck} />
      <label>
        Zuordnen zu
        <select name="ziel" defaultValue={aktuell}>
          <option value="">{aktuell ? 'Zuordnung aufheben' : 'Bitte wählen'}</option>
          <optgroup label="Mietverhältnis">
            {ziele.kandidaten.map((k) => (
              <option key={k.mietverhaeltnisId} value={'mv:' + k.mietverhaeltnisId}>
                {mietverhaeltnisText(k)}
              </option>
            ))}
          </optgroup>
          <optgroup label="Objekt (WEG, Behörde, Versorger)">
            {ziele.objekte.map((o) => (
              <option key={o.id} value={'objekt:' + o.id}>
                {o.bezeichnung}
              </option>
            ))}
          </optgroup>
          {ziele.handwerker.length ? (
            <optgroup label="Handwerker">
              {ziele.handwerker.map((h) => (
                <option key={h.id} value={'handwerker:' + h.id}>
                  {h.firma}
                </option>
              ))}
            </optgroup>
          ) : null}
          <optgroup label="Ohne Zuordnung">
            <option value="erledigt">Erledigt (Werbung, am Telefon geklärt)</option>
          </optgroup>
        </select>
      </label>
      <label>
        Notiz zur Zuordnung
        <input name="begruendung" />
      </label>
    </Formular>
  )
}
