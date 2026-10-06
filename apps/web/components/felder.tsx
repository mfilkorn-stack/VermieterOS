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

export function Auswahl({
  label,
  name,
  optionen,
  defaultValue,
}: {
  label: string
  name: string
  optionen: ReadonlyArray<readonly [string, string]>
  defaultValue?: string | null | undefined
}) {
  return (
    <label>
      {label}
      <select name={name} defaultValue={defaultValue ?? optionen[0]?.[0]}>
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
