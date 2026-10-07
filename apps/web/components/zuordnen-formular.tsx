import type { ZuordnungsKandidat } from '@vermieteros/db'
import { nachrichtZuordnen } from '@/app/(app)/posteingang/aktionen'
import { Formular } from './formular'
import { mietverhaeltnisText } from '@/lib/post-text'

/** Zuordnen, umhängen oder aufheben (leere Auswahl). */
export function ZuordnenFormular({
  nachrichtId,
  aktuell,
  kandidaten,
  zurueck,
}: {
  nachrichtId: string
  aktuell: string | null
  kandidaten: ZuordnungsKandidat[]
  zurueck: string
}) {
  return (
    <Formular aktion={nachrichtZuordnen} knopf="Speichern" testId="zuordnen">
      <input type="hidden" name="nachrichtId" value={nachrichtId} />
      <input type="hidden" name="zurueck" value={zurueck} />
      <label>
        Mietverhältnis
        <select name="mietverhaeltnisId" defaultValue={aktuell ?? ''}>
          <option value="">{aktuell ? 'Zuordnung aufheben' : 'Bitte wählen'}</option>
          {kandidaten.map((k) => (
            <option key={k.mietverhaeltnisId} value={k.mietverhaeltnisId}>
              {mietverhaeltnisText(k)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Notiz zur Zuordnung
        <input name="begruendung" />
      </label>
    </Formular>
  )
}
