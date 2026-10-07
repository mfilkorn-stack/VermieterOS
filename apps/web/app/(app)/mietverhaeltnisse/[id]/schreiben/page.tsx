import { ladeZuordnungsKandidaten } from '@vermieteros/db'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Feld } from '@/components/felder'
import { Formular } from '@/components/formular'
import { euroAnzeige } from '@/lib/format'
import { mietverhaeltnisText } from '@/lib/post-text'
import { schreibDaten } from '@/lib/schreiben'
import { darf, mitMandant } from '@/lib/sitzung'
import { heuteBerlin } from '@/lib/zeit'
import { schreibenErstellen } from './aktionen'

function Gemeinsam({
  id,
  art,
  vermieter,
  ort,
}: {
  id: string
  art: string
  vermieter: string
  ort: string | null
}) {
  return (
    <>
      <input type="hidden" name="mietverhaeltnisId" value={id} />
      <input type="hidden" name="art" value={art} />
      <label>
        Vermieter (Name, darunter Anschrift)
        <textarea name="vermieter" rows={3} defaultValue={vermieter} required />
      </label>
      <div className="feldreihe">
        <Feld label="Ort" name="ort" defaultValue={ort ?? ''} />
        <Feld label="Datum" name="ausgestellt" type="date" defaultValue={heuteBerlin()} required />
      </div>
    </>
  )
}

/**
 * Standardschreiben zu einem Mietverhältnis (WP 1.9). Vorbelegt aus den Stammdaten; jedes
 * erstellte Schreiben liegt danach als Dokument am Mietverhältnis.
 */
export default async function SchreibenSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await darf({ stammdaten: ['schreiben'] }))) redirect(`/mietverhaeltnisse/${id}`)
  const daten = await mitMandant(async (tx) => ({
    kopf: (await ladeZuordnungsKandidaten(tx)).find((k) => k.mietverhaeltnisId === id),
    s: await schreibDaten(tx, id),
  }))
  if (!daten.kopf || !daten.s) notFound()
  const { kopf, s } = daten
  const vermieter = [s.vermieter.name, ...s.vermieter.anschrift].join('\n')
  const fehlt = [
    s.vermieter.anschrift.length === 0 ? 'Anschrift des Vermieters (Eigentümer)' : null,
    s.wohnung.anschrift.length === 0 ? 'Anschrift des Objekts' : null,
  ].filter(Boolean)

  return (
    <>
      <nav className="brotkrumen" aria-label="Pfad">
        <Link href={`/mietverhaeltnisse/${id}`}>{kopf.mieterNamen.join(', ') || kopf.einheit}</Link>
        <span aria-hidden>/</span>
        <span>Schreiben</span>
      </nav>
      <h1>Schreiben erstellen</h1>
      <p className="leise">
        {mietverhaeltnisText(kopf)}. Jedes Schreiben wird als PDF mit Prüfsumme am Mietverhältnis
        abgelegt.
      </p>
      {fehlt.length ? (
        <p className="karte" role="status">
          In den Stammdaten fehlt: {fehlt.join(', ')}. Bitte unten ergänzen oder vorher in den
          Stammdaten nachtragen.
        </p>
      ) : null}

      <div className="karte">
        <h2>Wohnungsgeberbestätigung</h2>
        <p className="leise">
          Für die Anmeldung beim Bürgeramt, binnen zwei Wochen nach Ein- oder Auszug (§ 19 BMG).
        </p>
        <Formular
          aktion={schreibenErstellen}
          knopf="PDF erstellen"
          testId="schreiben-wohnungsgeber"
        >
          <Gemeinsam id={id} art="wohnungsgeber" vermieter={vermieter} ort={s.ort} />
          <div className="feldreihe">
            <label>
              Vorgang
              <select name="vorgang" defaultValue={s.mv.ende ? 'auszug' : 'einzug'}>
                <option value="einzug">Einzug</option>
                <option value="auszug">Auszug</option>
              </select>
            </label>
            <Feld
              label="Datum des Ein- oder Auszugs"
              name="datum"
              type="date"
              defaultValue={s.mv.ende ?? s.mv.beginn}
              required
            />
          </div>
          <label>
            Meldepflichtige Personen (eine je Zeile)
            <textarea name="personen" rows={3} defaultValue={s.mieter.join('\n')} required />
          </label>
          <Feld
            label="Eigentümer, falls nicht der Vermieter"
            name="eigentuemer"
            hinweis="Leer lassen, wenn der Vermieter selbst Eigentümer ist."
          />
        </Formular>
      </div>

      <div className="karte">
        <h2>Mietschuldenfreiheitsbescheinigung</h2>
        <p className="leise">
          Für den neuen Vermieter. Bis der Bank-Abgleich kommt, bestätigst du den Zahlungsstand
          selbst.
        </p>
        <Formular
          aktion={schreibenErstellen}
          knopf="PDF erstellen"
          testId="schreiben-mietschuldenfreiheit"
        >
          <Gemeinsam id={id} art="mietschuldenfreiheit" vermieter={vermieter} ort={s.ort} />
          <Feld
            label="Alle Zahlungen geleistet bis"
            name="stichtag"
            type="date"
            defaultValue={heuteBerlin()}
            required
          />
          <label className="inline">
            <input type="checkbox" name="mitBetriebskosten" />
            Auch Nachzahlungen aus Betriebskostenabrechnungen sind beglichen
          </label>
          <label className="inline">
            <input type="checkbox" name="geprueft" required />
            Ich habe die Zahlungen geprüft: Es gibt keine Rückstände.
          </label>
        </Formular>
      </div>

      <div className="karte">
        <h2>Vermieterbescheinigung</h2>
        <p className="leise">
          Miete, Vorauszahlungen, Wohnfläche und Personen für Jobcenter oder Wohngeldstelle.
          {s.kondition
            ? ` Aktuell: ${euroAnzeige(s.kondition.kaltmieteCent)} kalt, ${euroAnzeige(
                s.kondition.vorauszahlungBkCent,
              )} Betriebskosten, ${euroAnzeige(s.kondition.vorauszahlungHkCent)} Heizkosten.`
            : ' Es ist noch keine Miete erfasst.'}
        </p>
        <Formular
          aktion={schreibenErstellen}
          knopf="PDF erstellen"
          testId="schreiben-vermieterbescheinigung"
        >
          <Gemeinsam id={id} art="vermieterbescheinigung" vermieter={vermieter} ort={s.ort} />
          <Feld
            label="Zweck (optional)"
            name="zweck"
            placeholder="z. B. zur Vorlage beim Jobcenter"
          />
        </Formular>
      </div>
    </>
  )
}
