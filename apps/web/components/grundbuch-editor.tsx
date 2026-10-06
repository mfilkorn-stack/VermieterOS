'use client'

import { useState } from 'react'

export type FlurstueckRoh = { nummer: string; bezeichnung: string; flaeche: string }
export type GrundbuchRoh = {
  art: string
  amtsgericht: string
  blatt: string
  meaZaehler: string
  meaNenner: string
  flurstuecke: FlurstueckRoh[]
}

const leeresFlurstueck = (): FlurstueckRoh => ({ nummer: '', bezeichnung: '', flaeche: '' })
const leererEintrag = (): GrundbuchRoh => ({
  art: 'grundbuch',
  amtsgericht: '',
  blatt: '',
  meaZaehler: '',
  meaNenner: '',
  flurstuecke: [leeresFlurstueck()],
})

/** Grundbuchblätter mit Flurstücken. Schreibt alles als JSON in ein verstecktes Feld. */
export function GrundbuchEditor({ name, anfang }: { name: string; anfang: GrundbuchRoh[] }) {
  const [eintraege, setEintraege] = useState<GrundbuchRoh[]>(anfang)
  const setze = (i: number, teil: Partial<GrundbuchRoh>) =>
    setEintraege((alt) => alt.map((e, j) => (j === i ? { ...e, ...teil } : e)))
  const setzeFlst = (i: number, k: number, teil: Partial<FlurstueckRoh>) =>
    setze(i, {
      flurstuecke: eintraege[i]!.flurstuecke.map((f, j) => (j === k ? { ...f, ...teil } : f)),
    })

  return (
    <div className="editor" data-testid="grundbuch-editor">
      <input type="hidden" name={name} value={JSON.stringify(eintraege)} />
      {eintraege.map((e, i) => (
        <fieldset key={i} data-testid={`grundbuch-${i}`}>
          <legend>Grundbuchblatt {i + 1}</legend>
          <label>
            Art
            <select
              value={e.art}
              onChange={(x) => setze(i, { art: x.target.value })}
              aria-label="Art"
            >
              <option value="grundbuch">Grundbuch</option>
              <option value="wohnungsgrundbuch">Wohnungsgrundbuch</option>
              <option value="teileigentumsgrundbuch">Teileigentumsgrundbuch</option>
            </select>
          </label>
          <label>
            Amtsgericht
            <input
              value={e.amtsgericht}
              onChange={(x) => setze(i, { amtsgericht: x.target.value })}
            />
          </label>
          <label>
            Blatt
            <input value={e.blatt} onChange={(x) => setze(i, { blatt: x.target.value })} />
          </label>
          <div className="zeile">
            <label>
              Miteigentumsanteil (Zähler)
              <input
                value={e.meaZaehler}
                placeholder="z. B. 88,89"
                onChange={(x) => setze(i, { meaZaehler: x.target.value })}
              />
            </label>
            <label>
              Nenner
              <input
                value={e.meaNenner}
                placeholder="z. B. 1000"
                onChange={(x) => setze(i, { meaNenner: x.target.value })}
              />
            </label>
          </div>
          <p className="leise">
            Leer lassen bei Alleineigentum am Flurstück (z. B. separater Stellplatz).
          </p>
          {e.flurstuecke.map((f, k) => (
            <div key={k} className="zeile" data-testid={`flurstueck-${i}-${k}`}>
              <label>
                Flurstück
                <input
                  value={f.nummer}
                  onChange={(x) => setzeFlst(i, k, { nummer: x.target.value })}
                />
              </label>
              <label>
                Bezeichnung
                <input
                  value={f.bezeichnung}
                  onChange={(x) => setzeFlst(i, k, { bezeichnung: x.target.value })}
                />
              </label>
              <label>
                Fläche m²
                <input
                  value={f.flaeche}
                  inputMode="numeric"
                  onChange={(x) => setzeFlst(i, k, { flaeche: x.target.value })}
                />
              </label>
              {e.flurstuecke.length > 1 ? (
                <button
                  type="button"
                  className="zweit"
                  onClick={() => setze(i, { flurstuecke: e.flurstuecke.filter((_, j) => j !== k) })}
                >
                  Entfernen
                </button>
              ) : null}
            </div>
          ))}
          <div className="zeile">
            <button
              type="button"
              className="zweit"
              onClick={() => setze(i, { flurstuecke: [...e.flurstuecke, leeresFlurstueck()] })}
            >
              Flurstück hinzufügen
            </button>
            <button
              type="button"
              className="zweit"
              onClick={() => setEintraege((alt) => alt.filter((_, j) => j !== i))}
            >
              Blatt entfernen
            </button>
          </div>
        </fieldset>
      ))}
      <button
        type="button"
        className="zweit"
        onClick={() => setEintraege((alt) => [...alt, leererEintrag()])}
      >
        Grundbuchblatt hinzufügen
      </button>
    </div>
  )
}
