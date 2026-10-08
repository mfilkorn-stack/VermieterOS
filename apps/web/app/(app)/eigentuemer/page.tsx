import { letzteVersion, schema } from '@vermieteros/db'
import { summeBrueche } from '@vermieteros/rechenkern'
import { sql } from 'drizzle-orm'
import { Adresssuche } from '@/components/adresssuche'
import { Feld } from '@/components/felder'
import { Formular } from '@/components/formular'
import { adresssucheAn } from '@/lib/adresse'
import { bruchText, datumAnzeige } from '@/lib/format'
import { darf, mitMandant } from '@/lib/sitzung'
import { anteilAendern, eigentuemerAnlegen } from './aktionen'

const ART_TEXT = {
  allein: 'Alleineigentum',
  ehepaar: 'Ehepaar',
  bruchteil: 'Bruchteilsgemeinschaft',
  gbr: 'GbR',
}

export default async function EigentuemerSeite() {
  const { mandant, eintraege } = await mitMandant(async (tx) => {
    const [mandant] = await tx.select().from(schema.mandanten)
    const ids = await tx.execute<{ id: string; person_id: string }>(
      sql`select id, person_id from eigentumsanteile order by erstellt_am`,
    )
    const eintraege = []
    for (const r of ids) {
      const a = await letzteVersion(tx, 'eigentumsanteil', r.id)
      const p = await letzteVersion(tx, 'person', r.person_id)
      if (a && p)
        eintraege.push({ id: r.id, name: [p.vorname, p.nachname].filter(Boolean).join(' '), a })
    }
    return { mandant, eintraege }
  })
  const schreiben = await darf({ stammdaten: ['schreiben'] })
  const summe = eintraege.length
    ? summeBrueche(eintraege.map((e) => [e.a.zaehler, e.a.nenner]))
    : { zaehler: 0, nenner: 1 }

  return (
    <>
      <h1>Eigentümer · {mandant?.name}</h1>
      <p className="leise">
        {mandant ? ART_TEXT[mandant.art] : ''}. Die Anteile bestimmen die Aufteilung der Einkünfte
        im Steuerpaket (gesonderte und einheitliche Feststellung).
      </p>
      <ul className="liste" data-testid="eigentuemerliste">
        {eintraege.map((e) => {
          const [z, n] = bruchText(e.a)
          return (
            <li key={e.id} className="karte">
              <div className="zeile">
                <strong>{e.name}</strong>
                <span>
                  {z}/{n} · seit {datumAnzeige(e.a.gueltigAb)}
                </span>
              </div>
              {schreiben ? (
                <details>
                  <summary>Anteil ändern</summary>
                  <Formular aktion={anteilAendern} knopf="Änderungen speichern">
                    <input type="hidden" name="anteilId" value={e.id} />
                    <div className="zeile">
                      <Feld label="Anteil Zähler" name="zaehler" defaultValue={z} />
                      <Feld label="Nenner" name="nenner" defaultValue={n} />
                    </div>
                    <Feld
                      label="Gilt ab"
                      name="giltAb"
                      type="date"
                      defaultValue={e.a.gueltigAb}
                      required
                    />
                    <Feld label="Begründung" name="begruendung" />
                  </Formular>
                </details>
              ) : null}
            </li>
          )
        })}
      </ul>
      <p
        data-testid="anteile-summe"
        className={summe.zaehler === summe.nenner ? 'leise' : 'fehler'}
      >
        Summe der Anteile: {summe.zaehler}/{summe.nenner}
      </p>
      {schreiben ? (
        <div className="karte">
          <h2>Eigentümer hinzufügen</h2>
          <Formular aktion={eigentuemerAnlegen} knopf="Eigentümer anlegen" testId="eigentuemer">
            <div className="zeile">
              <Feld label="Vorname" name="vorname" />
              <Feld label="Nachname" name="nachname" required />
            </div>
            {adresssucheAn() ? <Adresssuche /> : null}
            <div className="zeile">
              <Feld label="Straße" name="strasse" />
              <Feld label="Hausnummer" name="hausnummer" />
              <Feld label="PLZ" name="plz" inputMode="numeric" />
              <Feld label="Ort" name="ort" />
            </div>
            <p className="leise">Die Anschrift steht als Vermieter auf Bescheinigungen.</p>
            <div className="zeile">
              <Feld label="Anteil Zähler" name="zaehler" placeholder="1" required />
              <Feld label="Nenner" name="nenner" placeholder="2" required />
            </div>
            <Feld
              label="Gilt ab"
              name="giltAb"
              type="date"
              required
              hinweis="In der Regel der Erwerb."
            />
          </Formular>
        </div>
      ) : null}
    </>
  )
}
