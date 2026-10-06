import { afaSatzVorschlag } from '@vermieteros/rechenkern'
import { notFound, redirect } from 'next/navigation'
import { Aenderung, Feld } from '@/components/felder'
import { Formular } from '@/components/formular'
import { NebenkostenEditor } from '@/components/nebenkosten-editor'
import { ladeAkte } from '@/lib/akte'
import { euroText, prozentText } from '@/lib/format'
import { darf, mitMandant } from '@/lib/sitzung'
import { nebenkostenZuRoh } from '@/lib/umwandeln'
import { kaufSpeichern } from '../aktionen'

export default async function KaufSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await darf({ stammdaten: ['schreiben'] }))) redirect(`/objekte/${id}`)
  const akte = await mitMandant((tx) => ladeAkte(tx, id))
  if (!akte) notFound()
  const o = akte.objekt
  const vorschlag = o.baujahr ? afaSatzVorschlag(o.baujahr) : null

  return (
    <div className="karte">
      <h1>Kauf und Abschreibung</h1>
      <p className="leise">
        Quelle: Kaufvertrag, Kostenrechnungen von Notar und Grundbuchamt, GrESt-Bescheid.
      </p>
      <Formular aktion={kaufSpeichern} knopf="Speichern" testId="kauf">
        <input type="hidden" name="objektId" value={id} />
        <div className="zeile">
          <Feld
            label="Datum Kaufvertrag"
            name="kaufvertragDatum"
            type="date"
            defaultValue={o.kaufvertragDatum ?? ''}
            hinweis="Beurkundung. Startet die zehnjährige Spekulationsfrist."
          />
          <Feld
            label="Übergang von Nutzen und Lasten"
            name="anschaffungsdatum"
            type="date"
            defaultValue={o.anschaffungsdatum ?? ''}
            hinweis="Meist mit Kaufpreiszahlung. Beginn von AfA und 15-%-Zeitraum."
          />
        </div>
        <Feld
          label="Kaufpreis €"
          name="kaufpreis"
          defaultValue={euroText(o.kaufpreisCent)}
          inputMode="decimal"
        />
        <h2>Nebenkosten</h2>
        <p className="leise">
          Grunderwerbsteuer, Notar und Grundbuch für den Kauf zählen zu den Anschaffungskosten.
          Notar und Grundbuch für die Grundschuld sind Finanzierungskosten und sofort abziehbar.
        </p>
        <NebenkostenEditor
          name="nebenkosten"
          anfang={nebenkostenZuRoh(o.anschaffungsnebenkosten)}
        />
        <h2>Aufteilung und AfA</h2>
        <Feld
          label="Gebäudeanteil %"
          name="gebaeudeanteil"
          defaultValue={prozentText(o.gebaeudeanteilPromille)}
          inputMode="decimal"
          hinweis="Aus Kaufvertrag, Arbeitshilfe des BMF zur Kaufpreisaufteilung oder Gutachten. Mit dem Berater abstimmen."
        />
        <div className="zeile">
          <Feld
            label="AfA-Satz %"
            name="afaSatz"
            defaultValue={prozentText(o.afaSatzPromille ?? vorschlag?.satzPromille)}
            inputMode="decimal"
            hinweis={
              vorschlag
                ? `Vorschlag nach Baujahr: ${vorschlag.grundlage}`
                : 'Baujahr unter Stammdaten erfassen.'
            }
          />
          <Feld
            label="AfA-Beginn"
            name="afaBeginn"
            type="date"
            defaultValue={o.afaBeginn ?? ''}
            hinweis="Leer lassen: Übergang von Nutzen und Lasten."
          />
        </div>
        <Aenderung giltAb={o.gueltigAb} />
      </Formular>
    </div>
  )
}
