import type { WissenZeile } from '@vermieteros/db'
import { wissenSpeichern } from '@/app/(app)/objekte/[id]/betrieb-aktionen'
import { optionen, WISSEN_TEXT } from '@/lib/betrieb-text'
import { Auswahl, Feld } from './felder'
import { Formular } from './formular'

export function WissenFormular({ objektId, w }: { objektId: string; w?: WissenZeile }) {
  return (
    <Formular aktion={wissenSpeichern} knopf="Speichern" testId="wissen">
      <input type="hidden" name="objektId" value={objektId} />
      {w ? <input type="hidden" name="wissensartikelId" value={w.id} /> : null}
      <div className="zeile">
        <Feld label="Titel" name="titel" defaultValue={w?.titel ?? ''} required />
        <Auswahl
          label="Art"
          name="kategorie"
          optionen={optionen(WISSEN_TEXT)}
          defaultValue={w?.kategorie}
        />
      </div>
      <label>
        Inhalt
        <textarea name="inhalt" rows={10} defaultValue={w?.inhalt ?? ''} required />
      </label>
      <label className="haken">
        <input type="checkbox" name="mieterSichtbar" defaultChecked={w?.mieterSichtbar ?? true} />
        Für Mieter sichtbar (Mieterportal)
      </label>
    </Formular>
  )
}
