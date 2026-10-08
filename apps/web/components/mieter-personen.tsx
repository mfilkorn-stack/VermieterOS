'use client'

import { UserPlus, X } from 'lucide-react'
import { useState } from 'react'
import { Feld } from './felder'

/**
 * Personen einer Mietpartei (z. B. Paar oder WG). Jede Zeile schickt vorname, nachname, email
 * und telefon; die Aktion liest sie mit getAll in derselben Reihenfolge.
 */
export function MieterPersonen() {
  const [zeilen, setZeilen] = useState([0])
  const [naechste, setNaechste] = useState(1)

  return (
    <div data-testid="mieter-personen">
      {zeilen.map((z, i) => (
        <fieldset key={z}>
          <legend>{zeilen.length > 1 ? 'Person ' + (i + 1) : 'Mieter'}</legend>
          <div className="zeile">
            <Feld label="Vorname" name="vorname" />
            <Feld label="Nachname" name="nachname" required />
          </div>
          <div className="zeile">
            <Feld label="E-Mail" name="email" type="email" />
            <Feld label="Telefon" name="telefon" />
          </div>
          {i > 0 ? (
            <button
              type="button"
              className="knopf zweit klein"
              onClick={() => setZeilen(zeilen.filter((x) => x !== z))}
            >
              <X size={14} aria-hidden /> Person {i + 1} entfernen
            </button>
          ) : null}
        </fieldset>
      ))}
      <button
        type="button"
        className="knopf zweit klein"
        onClick={() => {
          setZeilen([...zeilen, naechste])
          setNaechste(naechste + 1)
        }}
      >
        <UserPlus size={14} aria-hidden /> Weitere Person (Paar, WG)
      </button>
    </div>
  )
}
