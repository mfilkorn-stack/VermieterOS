'use client'

import { useState } from 'react'

export type NotfallRoh = {
  art: string
  handwerkerId: string
  name: string
  telefon: string
  hinweis: string
}

const leer = (): NotfallRoh => ({
  art: 'heizung',
  handwerkerId: '',
  name: '',
  telefon: '',
  hinweis: '',
})

/** Zeilen der Notfallkarte: Handwerker aus dem Verzeichnis oder freier Kontakt mit Telefon. */
export function NotfallkarteEditor({
  name,
  anfang,
  arten,
  handwerker,
}: {
  name: string
  anfang: NotfallRoh[]
  arten: ReadonlyArray<readonly [string, string]>
  handwerker: Array<{ id: string; firma: string }>
}) {
  const [zeilen, setZeilen] = useState<NotfallRoh[]>(anfang.length ? anfang : [leer()])
  const setze = (i: number, teil: Partial<NotfallRoh>) =>
    setZeilen((alt) => alt.map((z, j) => (j === i ? { ...z, ...teil } : z)))
  return (
    <div className="editor" data-testid="notfallkarte-editor">
      <input type="hidden" name={name} value={JSON.stringify(zeilen)} />
      {zeilen.map((z, i) => (
        <fieldset key={i} data-testid={`notfall-${i}`}>
          <legend>Eintrag {i + 1}</legend>
          <div className="zeile">
            <label>
              Wofür
              <select value={z.art} onChange={(x) => setze(i, { art: x.target.value })}>
                {arten.map(([wert, text]) => (
                  <option key={wert} value={wert}>
                    {text}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Kontakt
              <select
                value={z.handwerkerId}
                onChange={(x) => setze(i, { handwerkerId: x.target.value })}
              >
                <option value="">Freier Kontakt</option>
                {handwerker.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.firma}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {z.handwerkerId ? null : (
            <div className="zeile">
              <label>
                Name
                <input value={z.name} onChange={(x) => setze(i, { name: x.target.value })} />
              </label>
              <label>
                Telefon
                <input
                  type="tel"
                  value={z.telefon}
                  onChange={(x) => setze(i, { telefon: x.target.value })}
                />
              </label>
            </div>
          )}
          <label>
            Hinweis
            <input
              value={z.hinweis}
              placeholder="z. B. Haupthahn im Keller links"
              onChange={(x) => setze(i, { hinweis: x.target.value })}
            />
          </label>
          <button
            type="button"
            className="zweit"
            onClick={() => setZeilen((alt) => alt.filter((_, j) => j !== i))}
          >
            Entfernen
          </button>
        </fieldset>
      ))}
      <button type="button" className="zweit" onClick={() => setZeilen((alt) => [...alt, leer()])}>
        Eintrag hinzufügen
      </button>
    </div>
  )
}
