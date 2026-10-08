'use client'

import type { BelegObjekt } from '@vermieteros/db'
import {
  BETRKV_KOSTENARTEN,
  STEUERKATEGORIEN_AUSGABE,
  STEUERKATEGORIEN_EINNAHME,
  type JournalRichtung,
  type Steuerkategorie,
} from '@vermieteros/schema'
import { Plus, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Feld } from '@/components/felder'
import { KOSTENART_TEXT, STEUERKATEGORIE_TEXT } from '@/lib/journal-text'

export type BuchungVorgabe = {
  richtung?: JournalRichtung
  gegenpartei?: string | null
  rechnungsnummer?: string | null
  rechnungsdatum?: string | null
  zahlungsdatum?: string | null
  leistungVon?: string | null
  leistungBis?: string | null
  /** Euro als Text, z. B. „481,50“ */
  brutto?: string | null
  umsatzsteuer?: string | null
  steuerkategorie?: Steuerkategorie | null
  kostenart?: string | null
  umlagefaehig?: boolean
  verteilungJahre?: number | null
  beschreibung?: string | null
  objektId?: string | null
  /** Mehrere Objekte: je eine Zeile, Beträge leer = gleichmäßig aufteilen */
  objektIds?: string[]
}

type Zeile = { schluessel: number; objektId: string; einheitId: string; betrag: string }

/**
 * Felder einer Buchung. Kostenart und „umlagefähig“ nur bei Betriebskosten, Verteilung nur bei
 * Erhaltungsaufwand; der Server verwirft, was zur Kategorie nicht passt. Mehrere Objekte:
 * Beträge leer lassen = gleichmäßig aufteilen.
 */
export function BuchungFelder({
  objekte,
  vorgabe,
  richtungWaehlbar,
  hinweise = {},
}: {
  objekte: BelegObjekt[]
  vorgabe: BuchungVorgabe
  richtungWaehlbar: boolean
  /** Herkunft eines vorbelegten Werts, z. B. „S. 1: „Rechnungsbetrag: 481,50 €““ */
  hinweise?: Partial<Record<keyof BuchungVorgabe, ReactNode>>
}) {
  const [richtung, setRichtung] = useState<JournalRichtung>(vorgabe.richtung ?? 'ausgabe')
  const kategorien = richtung === 'einnahme' ? STEUERKATEGORIEN_EINNAHME : STEUERKATEGORIEN_AUSGABE
  const [kategorie, setKategorie] = useState<string>(
    vorgabe.steuerkategorie && (kategorien as readonly string[]).includes(vorgabe.steuerkategorie)
      ? vorgabe.steuerkategorie
      : '',
  )
  const [zeilen, setZeilen] = useState<Zeile[]>(
    (vorgabe.objektIds?.length ? vorgabe.objektIds : [vorgabe.objektId ?? '']).map(
      (objektId, schluessel) => ({ schluessel, objektId, einheitId: '', betrag: '' }),
    ),
  )
  const aendere = (i: number, z: Partial<Zeile>) =>
    setZeilen((alt) => alt.map((x, j) => (j === i ? { ...x, ...z } : x)))

  return (
    <>
      {richtungWaehlbar ? (
        <fieldset className="wahl" data-testid="buchung-richtung">
          <legend>Art</legend>
          {(['ausgabe', 'einnahme'] as const).map((r) => (
            <label key={r} className="inline">
              <input
                type="radio"
                name="richtung"
                value={r}
                checked={richtung === r}
                onChange={() => {
                  setRichtung(r)
                  setKategorie('')
                }}
              />
              {r === 'ausgabe' ? 'Ausgabe' : 'Einnahme'}
            </label>
          ))}
        </fieldset>
      ) : null}
      <Feld
        label={richtung === 'einnahme' ? 'Zahler' : 'Lieferant'}
        name="gegenpartei"
        defaultValue={vorgabe.gegenpartei ?? ''}
        required
        hinweis={hinweise.gegenpartei}
      />
      <div className="feldreihe">
        <Feld
          label="Betrag (brutto, €)"
          name="brutto"
          inputMode="decimal"
          defaultValue={vorgabe.brutto ?? ''}
          required
          hinweis={hinweise.brutto}
        />
        <Feld
          label="darin Umsatzsteuer (€)"
          name="umsatzsteuer"
          inputMode="decimal"
          defaultValue={vorgabe.umsatzsteuer ?? ''}
          hinweis={hinweise.umsatzsteuer}
        />
      </div>
      <div className="feldreihe">
        <Feld
          label="Zahlungsdatum"
          name="zahlungsdatum"
          type="date"
          defaultValue={vorgabe.zahlungsdatum ?? ''}
          required
          hinweis={
            hinweise.zahlungsdatum ?? 'Tag der Zahlung laut Kontoauszug; zählt für die Steuer.'
          }
        />
        <Feld
          label="Rechnungsdatum"
          name="rechnungsdatum"
          type="date"
          defaultValue={vorgabe.rechnungsdatum ?? ''}
          hinweis={hinweise.rechnungsdatum}
        />
      </div>
      <div className="feldreihe">
        <Feld
          label="Leistung von"
          name="leistungVon"
          type="date"
          defaultValue={vorgabe.leistungVon ?? ''}
          hinweis={hinweise.leistungVon ?? 'Zählt für die Nebenkostenabrechnung.'}
        />
        <Feld
          label="Leistung bis"
          name="leistungBis"
          type="date"
          defaultValue={vorgabe.leistungBis ?? ''}
          hinweis={hinweise.leistungBis}
        />
      </div>
      <Feld
        label="Rechnungsnummer"
        name="rechnungsnummer"
        defaultValue={vorgabe.rechnungsnummer ?? ''}
        hinweis={hinweise.rechnungsnummer}
      />
      <label>
        Kategorie
        <select
          name="steuerkategorie"
          value={kategorie}
          onChange={(e) => setKategorie(e.target.value)}
          required
        >
          <option value="">Bitte wählen</option>
          {kategorien.map((k) => (
            <option key={k} value={k}>
              {STEUERKATEGORIE_TEXT[k]}
            </option>
          ))}
        </select>
      </label>
      {hinweise.steuerkategorie ? <p className="leise">{hinweise.steuerkategorie}</p> : null}
      {kategorie === 'erhaltungsaufwand' ? (
        <label>
          Abzug
          <select name="verteilungJahre" defaultValue={vorgabe.verteilungJahre ?? ''}>
            <option value="">sofort im Zahlungsjahr</option>
            {[2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                verteilt auf {n} Jahre (§ 82b EStDV)
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {kategorie === 'betriebskosten' ? (
        <div className="feldreihe">
          <label>
            Kostenart (§ 2 BetrKV)
            <select name="kostenart" defaultValue={vorgabe.kostenart ?? ''}>
              <option value="">keine Angabe</option>
              {BETRKV_KOSTENARTEN.map((k) => (
                <option key={k} value={k}>
                  {KOSTENART_TEXT[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="inline">
            <input
              type="checkbox"
              name="umlagefaehig"
              defaultChecked={vorgabe.umlagefaehig ?? false}
            />
            umlagefähig
          </label>
        </div>
      ) : null}

      <fieldset data-testid="buchung-aufteilung">
        <legend>Objekt{zeilen.length > 1 ? 'e' : ''}</legend>
        {zeilen.map((z, i) => {
          const o = objekte.find((x) => x.id === z.objektId)
          return (
            <div className="feldreihe" key={z.schluessel} data-testid="anteil">
              <label>
                Objekt
                <select
                  name="anteilObjekt"
                  value={z.objektId}
                  onChange={(e) => aendere(i, { objektId: e.target.value, einheitId: '' })}
                  required
                >
                  <option value="">Bitte wählen</option>
                  {objekte.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.bezeichnung}
                    </option>
                  ))}
                </select>
              </label>
              {o && o.einheiten.length > 0 ? (
                <label>
                  Einheit
                  <select
                    name="anteilEinheit"
                    value={z.einheitId}
                    onChange={(e) => aendere(i, { einheitId: e.target.value })}
                  >
                    <option value="">ganzes Objekt</option>
                    {o.einheiten.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.bezeichnung}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <input type="hidden" name="anteilEinheit" value="" />
              )}
              {zeilen.length > 1 ? (
                <>
                  <Feld
                    label="Anteil (€)"
                    name="anteilBetrag"
                    inputMode="decimal"
                    value={z.betrag}
                    onChange={(e) => aendere(i, { betrag: e.target.value })}
                  />
                  <button
                    type="button"
                    className="zweit symbol"
                    aria-label="Zeile entfernen"
                    onClick={() => setZeilen((alt) => alt.filter((_, j) => j !== i))}
                  >
                    <X size={16} aria-hidden />
                  </button>
                </>
              ) : (
                <input type="hidden" name="anteilBetrag" value="" />
              )}
            </div>
          )
        })}
        {hinweise.objektId ? <p className="leise">{hinweise.objektId}</p> : null}
        {zeilen.length > 1 ? (
          <p className="leise">Anteile leer lassen: der Betrag wird gleichmäßig aufgeteilt.</p>
        ) : null}
        {objekte.length > zeilen.length ? (
          <button
            type="button"
            className="zweit"
            onClick={() =>
              setZeilen((alt) => [
                ...alt,
                {
                  schluessel: Math.max(...alt.map((x) => x.schluessel)) + 1,
                  objektId: '',
                  einheitId: '',
                  betrag: '',
                },
              ])
            }
            data-testid="anteil-hinzu"
          >
            <Plus size={16} aria-hidden /> Auf weiteres Objekt aufteilen
          </button>
        ) : null}
      </fieldset>
      <Feld label="Notiz" name="beschreibung" defaultValue={vorgabe.beschreibung ?? ''} />
    </>
  )
}
