import Link from 'next/link'
import { BUNDESLAENDER, BUNDESLAND_NAME } from '@vermieteros/schema'
import { notFound, redirect } from 'next/navigation'
import { Adresssuche } from '@/components/adresssuche'
import { Aenderung, Auswahl, Feld } from '@/components/felder'
import { AusKaufvertrag } from '@/components/aus-kaufvertrag'
import { Formular } from '@/components/formular'
import { GrundbuchEditor } from '@/components/grundbuch-editor'
import { adresssucheAn } from '@/lib/adresse'
import { gueltigerKaufvertrag, ladeAkte } from '@/lib/akte'
import { darf, mitMandant } from '@/lib/sitzung'
import { grundbuchZuRoh } from '@/lib/umwandeln'
import { stammdatenSpeichern } from '../aktionen'

export default async function StammdatenSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await darf({ stammdaten: ['schreiben'] }))) redirect(`/objekte/${id}`)
  const { akte, kaufvertrag } = await mitMandant(async (tx) => ({
    akte: await ladeAkte(tx, id),
    kaufvertrag: await gueltigerKaufvertrag(tx, id),
  }))
  if (!akte) notFound()
  const o = akte.objekt
  return (
    <>
      <nav className="brotkrumen" aria-label="Pfad">
        <Link href={'/objekte'}>Objekte</Link>
        <span aria-hidden>/</span>
        <Link href={`/objekte/${id}`}>{o.bezeichnung}</Link>
        <span aria-hidden>/</span>
        <span>Stammdaten</span>
      </nav>
      <div className="karte">
        <h1>Stammdaten und Grundbuch</h1>
        <AusKaufvertrag objektId={id} kaufvertrag={kaufvertrag} />
        <Formular aktion={stammdatenSpeichern} knopf="Änderungen speichern" testId="stammdaten">
          <input type="hidden" name="objektId" value={id} />
          <Feld label="Bezeichnung" name="bezeichnung" defaultValue={o.bezeichnung} required />
          <Auswahl
            label="Art"
            name="art"
            defaultValue={o.art}
            optionen={[
              ['haus', 'Haus'],
              ['etw', 'Eigentumswohnung'],
            ]}
          />
          {adresssucheAn() ? <Adresssuche /> : null}
          <div className="zeile">
            <Feld label="Straße" name="strasse" defaultValue={o.strasse ?? ''} />
            <Feld label="Hausnummer" name="hausnummer" defaultValue={o.hausnummer ?? ''} />
          </div>
          <div className="zeile">
            <Feld label="PLZ" name="plz" defaultValue={o.plz ?? ''} inputMode="numeric" />
            <Feld label="Ort" name="ort" defaultValue={o.ort ?? ''} />
          </div>
          <Auswahl
            label="Bundesland"
            name="bundesland"
            defaultValue={o.bundesland}
            leer="Bitte wählen"
            optionen={BUNDESLAENDER.map((b) => [b, BUNDESLAND_NAME[b]] as const)}
          />
          <Feld
            label="Baujahr (Fertigstellung)"
            name="baujahr"
            defaultValue={o.baujahr ?? ''}
            inputMode="numeric"
            hinweis="Bestimmt den gesetzlichen AfA-Satz."
          />
          <label className="haken">
            <input type="checkbox" name="weg" defaultChecked={o.weg} /> Teil einer
            Wohnungseigentümergemeinschaft (WEG)
          </label>
          <h2>Grundbuch</h2>
          <p className="leise">
            Ein Blatt pro Grundbuch. Eine Eigentumswohnung mit separat gekauftem Stellplatz hat
            zwei: das Wohnungsgrundbuch mit Miteigentumsanteil und das Grundbuch des Stellplatzes
            ohne.
          </p>
          <GrundbuchEditor name="grundbuch" anfang={grundbuchZuRoh(o.grundbuch)} />
          <Aenderung giltAb={o.gueltigAb} />
        </Formular>
      </div>
    </>
  )
}
