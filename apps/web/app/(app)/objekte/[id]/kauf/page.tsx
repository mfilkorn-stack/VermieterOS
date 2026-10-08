import { ladeReferenzdaten } from '@vermieteros/db'
import { afaSatzVorschlag, cent, grunderwerbsteuer, referenzwert } from '@vermieteros/rechenkern'
import { BUNDESLAND_NAME } from '@vermieteros/schema'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Aenderung, Feld } from '@/components/felder'
import { AusKaufvertrag } from '@/components/aus-kaufvertrag'
import { Formular } from '@/components/formular'
import { NebenkostenEditor } from '@/components/nebenkosten-editor'
import { gueltigerKaufvertrag, ladeAkte } from '@/lib/akte'
import { datumAnzeige, euroAnzeige, euroText, prozentText } from '@/lib/format'
import { darf, mitMandant } from '@/lib/sitzung'
import { nebenkostenZuRoh } from '@/lib/umwandeln'
import { kaufSpeichern } from '../aktionen'

export default async function KaufSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await darf({ stammdaten: ['schreiben'] }))) redirect(`/objekte/${id}`)
  const daten = await mitMandant(async (tx) => {
    const akte = await ladeAkte(tx, id)
    const bl = akte?.objekt.bundesland
    const grest = bl
      ? await ladeReferenzdaten<{ satzPromille: number }>(tx, 'grunderwerbsteuer', bl)
      : []
    return { akte, grest, kaufvertrag: await gueltigerKaufvertrag(tx, id) }
  })
  const { akte, kaufvertrag } = daten
  if (!akte) notFound()
  const o = akte.objekt
  const stichtag = o.kaufvertragDatum ?? o.anschaffungsdatum
  const heute = new Date().toISOString().slice(0, 10)
  const grest = o.bundesland && stichtag ? referenzwert(daten.grest, stichtag, heute) : null
  const vorschlag = o.baujahr ? afaSatzVorschlag(o.baujahr) : null

  return (
    <>
      <nav className="brotkrumen" aria-label="Pfad">
        <Link href={'/objekte'}>Objekte</Link>
        <span aria-hidden>/</span>
        <Link href={`/objekte/${id}`}>{o.bezeichnung}</Link>
        <span aria-hidden>/</span>
        <span>Kauf und Abschreibung</span>
      </nav>
      <div className="karte">
        <h1>Kauf und Abschreibung</h1>
        <p className="leise">
          Quelle: Kaufvertrag, Kostenrechnungen von Notar und Grundbuchamt, GrESt-Bescheid.
        </p>
        <AusKaufvertrag objektId={id} kaufvertrag={kaufvertrag} />
        <Formular aktion={kaufSpeichern} knopf="Änderungen speichern" testId="kauf">
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
          <p className="leise" data-testid="grest-hinweis">
            {!o.bundesland ? (
              <>
                Für einen Vorschlag zur Grunderwerbsteuer das Bundesland unter{' '}
                <Link href={`/objekte/${id}/stammdaten`}>Stammdaten</Link> wählen.
              </>
            ) : !stichtag ? (
              'Für einen Vorschlag zur Grunderwerbsteuer das Datum des Kaufvertrags angeben.'
            ) : !grest?.eintrag || grest.status === 'abgelaufen' ? (
              `Für ${BUNDESLAND_NAME[o.bundesland]} am ${datumAnzeige(stichtag)} ist kein Grunderwerbsteuersatz hinterlegt.`
            ) : (
              <>
                Grunderwerbsteuer {BUNDESLAND_NAME[o.bundesland]} bei Vertrag am{' '}
                {datumAnzeige(stichtag)}: {prozentText(grest.eintrag.wert.satzPromille)} %
                {o.kaufpreisCent != null
                  ? `, also ${euroAnzeige(grunderwerbsteuer(cent(o.kaufpreisCent), grest.eintrag.wert.satzPromille))}`
                  : ''}{' '}
                (Quelle: {grest.eintrag.quelle}
                {grest.status === 'ungeprueft' ? ', Prüfung überfällig' : ''}).
              </>
            )}
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
    </>
  )
}
