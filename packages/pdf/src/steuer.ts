import { formatEuro, type Cent } from '@vermieteros/rechenkern'
import type { Block, Brief } from './brief'

/**
 * Übersicht Einkünfte aus Vermietung und Verpachtung (WP 2.6) für den Steuerberater: Einnahmen,
 * Werbungskosten, Überschuss, Aufteilung nach Miteigentum, Hinweise. Vorbereitung der Anlage V,
 * keine Steuererklärung.
 */
export type SteuerUebersichtDaten = {
  mandant: string
  objekt: string
  anschrift: string[]
  jahr: number
  ausgestellt: string
  einnahmen: Array<{ bezeichnung: string; betragCent: number }>
  einnahmenCent: number
  werbungskosten: Array<{ bezeichnung: string; betragCent: number }>
  werbungskostenCent: number
  ueberschussCent: number
  verteilt: Array<{
    belegnummer: string
    jahrDerZahlung: number
    jahre: number
    anteilCent: number
  }>
  aufteilung: Array<{
    name: string
    einnahmenCent: number
    werbungskostenCent: number
    ueberschussCent: number
  }>
  hinweise: string[]
  grundlagen: string[]
}

const euro = (c: number) => formatEuro(c as Cent)

export function steuerUebersichtBrief(d: SteuerUebersichtDaten): Brief {
  const bloecke: Block[] = [
    {
      art: 'felder',
      zeilen: [
        ['Eigentümergemeinschaft', d.mandant],
        ['Objekt', [d.objekt, ...d.anschrift].join(', ')],
        ['Veranlagungsjahr', String(d.jahr)],
      ],
    },
    {
      art: 'tabelle',
      spalten: [{ titel: 'Einnahmen' }, { titel: 'Betrag', breiteMm: 32, rechts: true }],
      zeilen: [
        ...d.einnahmen.map((z) => ({ zellen: [z.bezeichnung, euro(z.betragCent)] })),
        { zellen: ['Summe Einnahmen', euro(d.einnahmenCent)], fett: true },
      ],
    },
    {
      art: 'tabelle',
      spalten: [{ titel: 'Werbungskosten' }, { titel: 'Betrag', breiteMm: 32, rechts: true }],
      zeilen: [
        ...d.werbungskosten.map((z) => ({ zellen: [z.bezeichnung, euro(z.betragCent)] })),
        { zellen: ['Summe Werbungskosten', euro(d.werbungskostenCent)], fett: true },
        {
          zellen: [d.ueberschussCent >= 0 ? 'Überschuss' : 'Verlust', euro(d.ueberschussCent)],
          fett: true,
        },
      ],
    },
  ]
  if (d.verteilt.length)
    bloecke.push({
      art: 'tabelle',
      spalten: [
        { titel: 'Verteilter Erhaltungsaufwand (§ 82b EStDV)' },
        { titel: 'gezahlt', breiteMm: 20 },
        { titel: 'Jahre', breiteMm: 16, rechts: true },
        { titel: 'Anteil', breiteMm: 30, rechts: true },
      ],
      zeilen: d.verteilt.map((v) => ({
        zellen: [
          `Beleg ${v.belegnummer}`,
          String(v.jahrDerZahlung),
          String(v.jahre),
          euro(v.anteilCent),
        ],
      })),
    })
  if (d.aufteilung.length)
    bloecke.push({
      art: 'tabelle',
      spalten: [
        { titel: 'Aufteilung nach Miteigentum' },
        { titel: 'Einnahmen', breiteMm: 30, rechts: true },
        { titel: 'Werbungsk.', breiteMm: 30, rechts: true },
        { titel: 'Ergebnis', breiteMm: 30, rechts: true },
      ],
      zeilen: d.aufteilung.map((a) => ({
        zellen: [
          a.name,
          euro(a.einnahmenCent),
          euro(a.werbungskostenCent),
          euro(a.ueberschussCent),
        ],
      })),
    })
  if (d.hinweise.length) {
    bloecke.push({ art: 'text', fett: true, text: 'Hinweise' })
    for (const h of d.hinweise) bloecke.push({ art: 'hinweis', text: h })
  }
  bloecke.push({ art: 'text', fett: true, text: 'Grundlagen' })
  for (const g of d.grundlagen) bloecke.push({ art: 'hinweis', text: g })
  return {
    titel: `Einkünfte aus Vermietung ${d.jahr} · ${d.objekt}`,
    absender: [d.mandant],
    empfaenger: [],
    ort: null,
    datum: d.ausgestellt,
    betreff: `Einkünfte aus Vermietung und Verpachtung ${d.jahr}\nVorbereitung der Anlage V · ${d.objekt}`,
    bloecke,
  }
}
