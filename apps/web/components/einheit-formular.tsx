import type { Version } from '@vermieteros/db'
import { Aenderung, Auswahl, Feld } from '@/components/felder'
import { Formular } from '@/components/formular'
import { bruchText, dezimalText } from '@/lib/format'
import { einheitSpeichern } from '@/app/(app)/objekte/[id]/aktionen'

export function EinheitFormular({
  objektId,
  einheit,
  giltAb,
}: {
  objektId: string
  einheit?: { id: string; v: Version<'einheit'> }
  giltAb: string
}) {
  const v = einheit?.v
  const [meaZ, meaN] = bruchText(
    v?.miteigentumsanteilZaehler != null && v.miteigentumsanteilNenner != null
      ? { zaehler: v.miteigentumsanteilZaehler, nenner: v.miteigentumsanteilNenner }
      : null,
  )
  return (
    <Formular aktion={einheitSpeichern} knopf="Einheit speichern" testId="einheit">
      <input type="hidden" name="objektId" value={objektId} />
      {einheit ? <input type="hidden" name="einheitId" value={einheit.id} /> : null}
      <Feld label="Bezeichnung" name="bezeichnung" defaultValue={v?.bezeichnung ?? ''} required />
      <Auswahl
        label="Typ"
        name="typ"
        defaultValue={v?.typ ?? 'wohnung'}
        optionen={[
          ['wohnung', 'Wohnung'],
          ['gewerbe', 'Gewerbe'],
          ['stellplatz', 'Stellplatz / Garage'],
          ['sonstiges', 'Sonstiges'],
        ]}
      />
      <Feld label="Lage" name="lage" defaultValue={v?.lage ?? ''} placeholder="z. B. EG links" />
      <div className="zeile">
        <Feld
          label="Wohnfläche m²"
          name="wohnflaeche"
          defaultValue={dezimalText(v?.wohnflaecheQm100, 2)}
          inputMode="decimal"
          hinweis="Nach WoFlV. Bei Stellplätzen leer lassen."
        />
        <Feld
          label="Zimmer"
          name="zimmer"
          defaultValue={dezimalText(v?.zimmerX10, 1)}
          inputMode="decimal"
        />
      </div>
      <div className="zeile">
        <Feld
          label="Miteigentumsanteil (Zähler)"
          name="meaZaehler"
          defaultValue={meaZ}
          placeholder="z. B. 88,89"
          hinweis="Bei WEG laut Teilungserklärung."
        />
        <Feld label="Nenner" name="meaNenner" defaultValue={meaN} placeholder="z. B. 1000" />
      </div>
      <Aenderung giltAb={giltAb} neu={!einheit} />
    </Formular>
  )
}
