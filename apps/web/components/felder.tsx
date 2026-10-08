import { useId, type InputHTMLAttributes, type ReactNode } from 'react'

type FeldProps = {
  label: string
  name: string
  hinweis?: ReactNode
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'name'>

/** Beschriftetes Eingabefeld. Zahlen als Text, damit „1.234,56“ möglich ist. */
export function Feld({ label, name, hinweis, ...rest }: FeldProps) {
  const hinweisId = useId()
  // Hinweis außerhalb des Labels: sonst wird er Teil des Feldnamens (Screenreader, Tests).
  return (
    <div className="feld">
      <label>
        {label}
        {rest.required ? <Pflicht /> : null}
        <input name={name} aria-describedby={hinweis ? hinweisId : undefined} {...rest} />
      </label>
      {hinweis ? (
        <span id={hinweisId} className="leise">
          {hinweis}
        </span>
      ) : null}
    </div>
  )
}

/** Kennzeichen für Pflichtfelder; der Screenreader liest „Pflichtfeld“, nicht den Stern. */
export function Pflicht() {
  return (
    <span className="pflicht" title="Pflichtfeld">
      <span aria-hidden> *</span>
      <span className="sr-only"> (Pflichtfeld)</span>
    </span>
  )
}

export function Auswahl({
  label,
  name,
  optionen,
  defaultValue,
  leer,
  required,
}: {
  label: string
  name: string
  optionen: ReadonlyArray<readonly [string, string]>
  defaultValue?: string | null | undefined
  /** Text für eine leere Auswahl; ohne Angabe gibt es keine. */
  leer?: string
  required?: boolean
}) {
  return (
    <label>
      {label}
      {required ? <Pflicht /> : null}
      <select
        name={name}
        required={required}
        defaultValue={defaultValue ?? (leer !== undefined ? '' : optionen[0]?.[0])}
      >
        {leer !== undefined ? <option value="">{leer}</option> : null}
        {optionen.map(([wert, text]) => (
          <option key={wert} value={wert}>
            {text}
          </option>
        ))}
      </select>
    </label>
  )
}

/** „Gilt ab“ und Begründung für Änderungen an bestehenden Datensätzen. */
export function Aenderung({ giltAb, neu }: { giltAb: string; neu?: boolean }) {
  return (
    <fieldset className="aenderung">
      <legend>Zeitpunkt</legend>
      <Feld
        label="Gilt ab"
        name="giltAb"
        type="date"
        defaultValue={giltAb}
        required
        hinweis={
          neu
            ? 'Ab wann diese Angaben gelten.'
            : 'Für Korrekturen unverändert lassen. Für echte Änderungen (Umbau, neue Konditionen) das Datum der Änderung.'
        }
      />
      {neu ? null : (
        <Feld
          label="Begründung"
          name="begruendung"
          hinweis="Nur nötig, wenn ein vorhandener Wert geändert wird."
        />
      )}
    </fieldset>
  )
}
