'use client'

import { useState } from 'react'

export type NebenkostenRoh = { art: string; bezeichnung: string; betrag: string; bezahltAm: string }

export const NEBENKOSTEN_TEXT: ReadonlyArray<readonly [string, string]> = [
  ['grunderwerbsteuer', 'Grunderwerbsteuer'],
  ['notar_kaufvertrag', 'Notar Kaufvertrag'],
  ['grundbuch_eigentum', 'Grundbuch Eigentumsumschreibung'],
  ['makler', 'Makler'],
  ['gutachten', 'Gutachten'],
  ['sonstige_anschaffung', 'Sonstige Anschaffungsnebenkosten'],
  ['notar_grundschuld', 'Notar Grundschuld (Finanzierung)'],
  ['grundbuch_grundschuld', 'Grundbuch Grundschuld (Finanzierung)'],
  ['sonstige_finanzierung', 'Sonstige Finanzierungskosten'],
]

const leer = (): NebenkostenRoh => ({
  art: 'grunderwerbsteuer',
  bezeichnung: '',
  betrag: '',
  bezahltAm: '',
})

/** Kauf-Nebenkosten als Positionen. Finanzierungskosten zählen nicht zu den Anschaffungskosten. */
export function NebenkostenEditor({ name, anfang }: { name: string; anfang: NebenkostenRoh[] }) {
  const [zeilen, setZeilen] = useState<NebenkostenRoh[]>(anfang)
  const setze = (i: number, teil: Partial<NebenkostenRoh>) =>
    setZeilen((alt) => alt.map((z, j) => (j === i ? { ...z, ...teil } : z)))
  return (
    <div className="editor" data-testid="nebenkosten-editor">
      <input type="hidden" name={name} value={JSON.stringify(zeilen)} />
      {zeilen.map((z, i) => (
        <div key={i} className="zeile" data-testid={`nebenkosten-${i}`}>
          <label>
            Art
            <select value={z.art} onChange={(x) => setze(i, { art: x.target.value })}>
              {NEBENKOSTEN_TEXT.map(([wert, text]) => (
                <option key={wert} value={wert}>
                  {text}
                </option>
              ))}
            </select>
          </label>
          <label>
            Betrag €
            <input
              value={z.betrag}
              inputMode="decimal"
              onChange={(x) => setze(i, { betrag: x.target.value })}
            />
          </label>
          <label>
            Bezahlt am
            <input
              type="date"
              value={z.bezahltAm}
              onChange={(x) => setze(i, { bezahltAm: x.target.value })}
            />
          </label>
          <button
            type="button"
            className="zweit"
            onClick={() => setZeilen((alt) => alt.filter((_, j) => j !== i))}
          >
            Entfernen
          </button>
        </div>
      ))}
      <button type="button" className="zweit" onClick={() => setZeilen((alt) => [...alt, leer()])}>
        Position hinzufügen
      </button>
    </div>
  )
}
