'use client'

import { BETRKV_KOSTENARTEN } from '@vermieteros/schema'
import { useState } from 'react'
import type { BkRoh, MessdienstRoh, PositionRoh } from '@/lib/bk'
import { KOSTENART_TEXT } from '@/lib/journal-text'

const SCHLUESSEL: ReadonlyArray<readonly [PositionRoh['schluessel'], string, string]> = [
  ['wohnflaeche', 'Wohnfläche', 'Gesamtfläche m²'],
  ['einheiten', 'Einheiten', 'Anzahl Einheiten'],
  ['mea', 'Miteigentumsanteile', 'MEA gesamt'],
  ['personen', 'Personenmonate', 'Personenmonate gesamt'],
  ['direkt', 'direkt', 'Betrag der Einheit €'],
]
const groesseText = (s: PositionRoh['schluessel']) =>
  SCHLUESSEL.find(([w]) => w === s)?.[2] ?? 'Bezugsgröße'

type Nutzung = { id: string; text: string; soll: string }

/**
 * Eingaben einer Betriebskostenabrechnung: Kostenpositionen (meist aus der Hausgeldabrechnung
 * der WEG), Abrechnung des Messdienstes, abweichende Ist-Vorauszahlungen. Alles geht als JSON
 * an die Server Action; geprüft und umgerechnet wird dort.
 */
export function BkEditor({ anfang, nutzungen }: { anfang: BkRoh; nutzungen: Nutzung[] }) {
  const [d, setD] = useState<BkRoh>(anfang)
  const setPos = (i: number, teil: Partial<PositionRoh>) =>
    setD((alt) => ({
      ...alt,
      positionen: alt.positionen.map((p, j) => (j === i ? { ...p, ...teil } : p)),
    }))
  const setMd = (teil: Partial<MessdienstRoh>) =>
    setD((alt) => ({ ...alt, messdienst: { ...alt.messdienst, ...teil } }))
  const letzteGroesse = (s: PositionRoh['schluessel']) =>
    [...d.positionen].reverse().find((p) => p.schluessel === s && p.groesse)?.groesse ?? ''
  const md = d.messdienst

  return (
    <div className="editor" data-testid="bk-editor">
      <input type="hidden" name="daten" value={JSON.stringify(d)} />
      <div className="zeile">
        <label>
          Zeitraum von
          <input
            type="date"
            value={d.zeitraumVon}
            onChange={(e) => setD({ ...d, zeitraumVon: e.target.value })}
          />
        </label>
        <label>
          bis
          <input
            type="date"
            value={d.zeitraumBis}
            onChange={(e) => setD({ ...d, zeitraumBis: e.target.value })}
          />
        </label>
      </div>

      <h3>Kosten</h3>
      <p className="leise">
        Gesamtkosten der Abrechnungseinheit (Haus oder WEG) und der Schlüssel, nach dem verteilt
        wird. Grundsteuer laut Bescheid: Schlüssel „direkt“.
      </p>
      {d.positionen.map((p, i) => (
        <fieldset key={i} className="bk-position" data-testid="bk-position">
          <div className="zeile">
            <label>
              Bezeichnung
              <input
                value={p.bezeichnung}
                maxLength={120}
                onChange={(e) => setPos(i, { bezeichnung: e.target.value })}
              />
            </label>
            <label>
              Kostenart (§ 2 BetrKV)
              <select
                value={p.kostenart}
                onChange={(e) =>
                  setPos(i, { kostenart: e.target.value as PositionRoh['kostenart'] })
                }
              >
                {BETRKV_KOSTENARTEN.map((k) => (
                  <option key={k} value={k}>
                    {KOSTENART_TEXT[k]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="zeile">
            <label>
              Gesamtkosten €
              <input
                value={p.gesamt}
                inputMode="decimal"
                onChange={(e) => setPos(i, { gesamt: e.target.value })}
              />
            </label>
            <label>
              Schlüssel
              <select
                value={p.schluessel}
                onChange={(e) => {
                  const s = e.target.value as PositionRoh['schluessel']
                  setPos(i, { schluessel: s, groesse: p.groesse || letzteGroesse(s) })
                }}
              >
                {SCHLUESSEL.map(([w, t]) => (
                  <option key={w} value={w}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {groesseText(p.schluessel)}
              <input
                value={p.groesse}
                inputMode="decimal"
                onChange={(e) => setPos(i, { groesse: e.target.value })}
              />
            </label>
            <button
              type="button"
              className="zweit"
              onClick={() => setD({ ...d, positionen: d.positionen.filter((_, j) => j !== i) })}
            >
              Zeile entfernen
            </button>
          </div>
        </fieldset>
      ))}
      <button
        type="button"
        className="zweit"
        data-testid="bk-position-neu"
        onClick={() =>
          setD({
            ...d,
            positionen: [
              ...d.positionen,
              {
                kostenart: 'sonstige_betriebskosten',
                bezeichnung: '',
                gesamt: '',
                schluessel: 'wohnflaeche',
                groesse: letzteGroesse('wohnflaeche'),
              },
            ],
          })
        }
      >
        Kostenposition hinzufügen
      </button>

      <h3>Heizung und Wasser (Messdienst)</h3>
      <label className="haken">
        <input
          type="checkbox"
          checked={md.aktiv}
          onChange={(e) => setMd({ aktiv: e.target.checked })}
        />{' '}
        Abrechnung des Messdienstes liegt vor
      </label>
      {md.aktiv ? (
        <fieldset className="bk-messdienst" data-testid="bk-messdienst">
          <div className="zeile">
            <label>
              Gesamtkosten aller Nutzer €
              <input
                value={md.gesamt}
                inputMode="decimal"
                onChange={(e) => setMd({ gesamt: e.target.value })}
              />
            </label>
            <label>
              Betrag der Einheit €
              <input
                value={md.einheit}
                inputMode="decimal"
                onChange={(e) => setMd({ einheit: e.target.value })}
              />
            </label>
            <label>
              Lohnanteil § 35a €
              <input
                value={md.lohn35a}
                inputMode="decimal"
                onChange={(e) => setMd({ lohn35a: e.target.value })}
              />
            </label>
          </div>
          <p className="leise">
            CO2-Kosten (CO2KostAufG), aus dem Abschnitt zur CO2-Aufteilung der Messdienstabrechnung.
            Leer lassen nur bei Heizung ohne fossile Brennstoffe.
          </p>
          <div className="zeile">
            <label>
              CO2-Kosten Gebäude €
              <input
                value={md.co2Kosten}
                inputMode="decimal"
                onChange={(e) => setMd({ co2Kosten: e.target.value })}
              />
            </label>
            <label>
              CO2 in kg
              <input
                value={md.co2Kg}
                inputMode="decimal"
                onChange={(e) => setMd({ co2Kg: e.target.value })}
              />
            </label>
            <label>
              Wohnfläche Gebäude m²
              <input
                value={md.co2Flaeche}
                inputMode="decimal"
                onChange={(e) => setMd({ co2Flaeche: e.target.value })}
              />
            </label>
            <label>
              Tage
              <input
                value={md.co2Tage}
                inputMode="numeric"
                placeholder="365"
                onChange={(e) => setMd({ co2Tage: e.target.value })}
              />
            </label>
          </div>
          <div className="zeile">
            <label>
              Heizung + Warmwasser Einheit €
              <input
                value={md.heizWwEinheit}
                inputMode="decimal"
                onChange={(e) => setMd({ heizWwEinheit: e.target.value })}
              />
            </label>
            <label>
              Heizung + Warmwasser gesamt €
              <input
                value={md.heizWwGesamt}
                inputMode="decimal"
                onChange={(e) => setMd({ heizWwGesamt: e.target.value })}
              />
            </label>
            <label>
              CO2-Anteil Vermieter laut Messdienst €
              <input
                value={md.vermieterLaut}
                inputMode="decimal"
                onChange={(e) => setMd({ vermieterLaut: e.target.value })}
              />
            </label>
          </div>
          {nutzungen.length > 1 ? (
            <>
              <p className="leise">
                Zwischenablesung bei Mieterwechsel: Beträge je Mietverhältnis. Leer lassen, wenn
                keine vorliegt; dann wird nach Monaten geteilt.
              </p>
              <div className="zeile">
                {nutzungen.map((n) => (
                  <label key={n.id}>
                    {n.text} €
                    <input
                      value={md.jeNutzung[n.id] ?? ''}
                      inputMode="decimal"
                      onChange={(e) =>
                        setMd({ jeNutzung: { ...md.jeNutzung, [n.id]: e.target.value } })
                      }
                    />
                  </label>
                ))}
              </div>
            </>
          ) : null}
        </fieldset>
      ) : null}

      {nutzungen.length ? (
        <>
          <h3>Vorauszahlungen</h3>
          <p className="leise">
            Leer: Soll laut Mietkonditionen. Nur eintragen, wenn tatsächlich etwas anderes gezahlt
            wurde.
          </p>
          <div className="zeile">
            {nutzungen.map((n) => (
              <label key={n.id}>
                {n.text} €
                <input
                  value={d.vorauszahlungen[n.id] ?? ''}
                  inputMode="decimal"
                  placeholder={n.soll}
                  onChange={(e) =>
                    setD({
                      ...d,
                      vorauszahlungen: { ...d.vorauszahlungen, [n.id]: e.target.value },
                    })
                  }
                />
              </label>
            ))}
          </div>
        </>
      ) : null}

      <label>
        Notizen
        <textarea
          rows={2}
          value={d.notizen}
          onChange={(e) => setD({ ...d, notizen: e.target.value })}
        />
      </label>
    </div>
  )
}
