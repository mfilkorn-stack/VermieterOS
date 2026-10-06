import type { Version } from '@vermieteros/db'
import { Aenderung, Feld } from '@/components/felder'
import { Formular } from '@/components/formular'
import { dezimalText, euroText } from '@/lib/format'
import { darlehenSpeichern } from '@/app/(app)/objekte/[id]/aktionen'

export function DarlehenFormular({
  objektId,
  darlehen,
  giltAb,
}: {
  objektId: string
  darlehen?: { id: string; v: Version<'darlehen'> }
  giltAb: string
}) {
  const v = darlehen?.v
  return (
    <Formular aktion={darlehenSpeichern} knopf="Speichern" testId="darlehen">
      <input type="hidden" name="objektId" value={objektId} />
      {darlehen ? <input type="hidden" name="darlehenId" value={darlehen.id} /> : null}
      <div className="zeile">
        <Feld label="Bank" name="bank" defaultValue={v?.bank ?? ''} required />
        <Feld label="Darlehensnummer" name="kennzeichen" defaultValue={v?.kennzeichen ?? ''} />
      </div>
      <div className="zeile">
        <Feld
          label="Darlehensbetrag €"
          name="nominal"
          defaultValue={euroText(v?.nominalCent)}
          inputMode="decimal"
          required
        />
        <Feld
          label="Auszahlung am"
          name="auszahlungAm"
          type="date"
          defaultValue={v?.auszahlungAm ?? ''}
        />
      </div>
      <div className="zeile">
        <Feld
          label="Sollzins %"
          name="zins"
          defaultValue={dezimalText(v?.zinsBp, 2)}
          inputMode="decimal"
          required
        />
        <Feld
          label="Anfängliche Tilgung %"
          name="tilgung"
          defaultValue={dezimalText(v?.tilgungBp, 2)}
          inputMode="decimal"
        />
        <Feld
          label="Monatsrate €"
          name="rate"
          defaultValue={euroText(v?.rateCent)}
          inputMode="decimal"
          required
        />
      </div>
      <div className="zeile">
        <Feld
          label="Zinsbindung bis"
          name="zinsbindungBis"
          type="date"
          defaultValue={v?.zinsbindungBis ?? ''}
        />
        <Feld
          label="Sondertilgung pro Jahr €"
          name="sondertilgung"
          defaultValue={euroText(v?.sondertilgungCentPa)}
          inputMode="decimal"
        />
      </div>
      <div className="zeile">
        <Feld
          label="Restschuld €"
          name="restschuld"
          defaultValue={euroText(v?.restschuldCent)}
          inputMode="decimal"
        />
        <Feld
          label="Restschuld zum"
          name="restschuldStand"
          type="date"
          defaultValue={v?.restschuldStand ?? ''}
        />
      </div>
      <Aenderung giltAb={giltAb} neu={!darlehen} />
    </Formular>
  )
}
