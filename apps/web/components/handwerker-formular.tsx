import type { HandwerkerZeile } from '@vermieteros/db'
import { GEWERKE } from '@vermieteros/schema'
import { handwerkerSpeichern } from '@/app/(app)/handwerker/aktionen'
import { GEWERK_TEXT } from '@/lib/betrieb-text'
import { Aenderung, Feld } from './felder'
import { Formular } from './formular'

export function HandwerkerFormular({
  h,
  objekte,
  heute,
}: {
  h?: HandwerkerZeile
  objekte: Array<{ id: string; bezeichnung: string }>
  heute: string
}) {
  return (
    <Formular aktion={handwerkerSpeichern} knopf="Speichern" testId="handwerker">
      {h ? <input type="hidden" name="handwerkerId" value={h.id} /> : null}
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
