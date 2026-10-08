import type { HandwerkerZeile } from '@vermieteros/db'
import { GEWERKE } from '@vermieteros/schema'
import { handwerkerSpeichern } from '@/app/(app)/handwerker/aktionen'
import { GEWERK_TEXT } from '@/lib/betrieb-text'
import { Adresssuche } from './adresssuche'
import { Aenderung, Feld } from './felder'
import { Firmensuche } from './firmensuche'
import { Formular } from './formular'

export function HandwerkerFormular({
  h,
  objekte,
  heute,
  firmensuche,
  adresssuche,
}: {
  h?: HandwerkerZeile
  objekte: Array<{ id: string; bezeichnung: string }>
  heute: string
  firmensuche: boolean
  adresssuche: boolean
}) {
  return (
    <Formular aktion={handwerkerSpeichern} knopf="Handwerker speichern" testId="handwerker">
      {h ? <input type="hidden" name="handwerkerId" value={h.id} /> : null}
      {firmensuche ? <Firmensuche /> : null}
      <div className="zeile">
        <Feld label="Firma oder Name" name="firma" defaultValue={h?.firma ?? ''} required />
        <Feld
          label="Ansprechpartner"
          name="ansprechpartner"
          defaultValue={h?.ansprechpartner ?? ''}
        />
      </div>
      <fieldset>
        <legend>Gewerke</legend>
        <div className="haken-gruppe">
          {GEWERKE.map((g) => (
            <label key={g} className="haken">
              <input
                type="checkbox"
                name="gewerke"
                value={g}
                defaultChecked={h?.gewerke.includes(g)}
              />
              {GEWERK_TEXT[g]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="zeile">
        <Feld label="Telefon" name="telefon" type="tel" defaultValue={h?.telefon ?? ''} />
        <Feld label="E-Mail" name="email" type="email" defaultValue={h?.email ?? ''} />
      </div>
      <Feld
        label="Webseite"
        name="webseite"
        type="url"
        placeholder="https://"
        defaultValue={h?.webseite ?? ''}
      />
      {adresssuche ? <Adresssuche /> : null}
      <div className="zeile">
        <Feld label="Straße" name="strasse" defaultValue={h?.strasse ?? ''} />
        <Feld label="Hausnummer" name="hausnummer" defaultValue={h?.hausnummer ?? ''} />
        <Feld label="PLZ" name="plz" inputMode="numeric" defaultValue={h?.plz ?? ''} />
        <Feld label="Ort" name="ort" defaultValue={h?.ort ?? ''} />
      </div>
      <div className="zeile">
        <label className="haken">
          <input type="checkbox" name="notdienst" defaultChecked={h?.notdienst ?? false} />
          Notdienst außerhalb der Geschäftszeiten
        </label>
        <Feld
          label="Notdienst-Telefon"
          name="notdienstTelefon"
          type="tel"
          defaultValue={h?.notdienstTelefon ?? ''}
        />
      </div>
      {objekte.length > 1 ? (
        <fieldset>
          <legend>Zuständig für (keine Auswahl: alle Objekte)</legend>
          <div className="haken-gruppe">
            {objekte.map((o) => (
              <label key={o.id} className="haken">
                <input
                  type="checkbox"
                  name="objektIds"
                  value={o.id}
                  defaultChecked={h?.objektIds.includes(o.id)}
                />
                {o.bezeichnung}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <label>
        Bewertung
        <select name="bewertung" defaultValue={h?.bewertung ?? ''}>
          <option value="">keine</option>
          <option value="5">5 · sehr gut</option>
          <option value="4">4 · gut</option>
          <option value="3">3 · in Ordnung</option>
          <option value="2">2 · mäßig</option>
          <option value="1">1 · schlecht</option>
        </select>
      </label>
      <label>
        Notizen
        <textarea name="notizen" rows={3} defaultValue={h?.notizen ?? ''} />
      </label>
      <Aenderung giltAb={h?.gueltigAb ?? heute} {...(h ? {} : { neu: true })} />
    </Formular>
  )
}
