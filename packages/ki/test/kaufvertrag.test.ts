import { describe, expect, it } from 'vitest'
import {
  bruchAus,
  flaecheAus,
  gebaeudeanteilAus,
  werteKaufvertragAus,
  type KaufvertragAuszug,
} from '../src/aufgaben/kaufvertrag'
import { seitenTexte } from '../src/pdf'
import { musterKaufvertrag } from '../src/testpdf'

const f = (wert: string, seite: number, zitat: string) => ({ wert, seite, zitat })

const AUSZUG: KaufvertragAuszug = {
  kaufvertrag_datum: f('30.04.2021', 1, 'Verhandelt zu Musterstadt am 30.04.2021'),
  uebergang_nutzen_lasten: null,
  kaufpreis: f('187.000,00 €', 3, 'Der Kaufpreis beträgt 187.000,00 €.'),
  anteil_grund_boden: f('37.400,00 €', 3, 'Davon entfallen auf den Grund und Boden 37.400,00 €.'),
  grundbuch: [
    {
      art: 'wohnungsgrundbuch',
      amtsgericht: f('Musterstadt', 2, 'Wohnungsgrundbuch des Amtsgerichts Musterstadt'),
      blatt: f('W-1', 2, 'von Musterdorf Blatt W-1'),
      miteigentumsanteil: f('88,89/1.000', 2, '88,89/1.000 Miteigentumsanteil'),
      flurstuecke: [
        {
          nummer: f('Flurstück A', 2, 'an Flurstück A mit 464 m²'),
          flaeche: f('464 m²', 2, 'Flurstück A mit 464 m²'),
        },
        {
          nummer: f('Flurstück B', 2, 'Flurstück B mit 331 m²'),
          flaeche: f('331 m²', 2, 'Flurstück B mit 331 m²'),
        },
      ],
    },
    {
      art: 'teileigentumsgrundbuch',
      amtsgericht: f('Musterstadt', 2, 'Teileigentumsgrundbuch des Amtsgerichts Musterstadt'),
      blatt: f('G-2', 2, 'Blatt G-2'),
      miteigentumsanteil: null,
      // erfundene Fläche: darf das Blatt nicht übernehmbar machen
      flurstuecke: [
        {
          nummer: f('Flurstück C', 2, 'Stellplatz auf Flurstück C'),
          flaeche: f('41 m²', 2, 'Flurstück C mit 41 m²'),
        },
      ],
    },
  ],
  hinweise: ['Übergang mit vollständiger Zahlung des Kaufpreises'],
}

describe('Kaufvertrag: Fundstellen prüfen', () => {
  it('Eckdaten belegt und normiert', async () => {
    const { felder } = werteKaufvertragAus(AUSZUG, await seitenTexte(musterKaufvertrag()))
    const a = Object.fromEntries(felder.map((x) => [x.feld, x]))
    expect(a['kaufvertrag_datum']).toMatchObject({ pruefung: 'belegt', normiert: '2021-04-30' })
    expect(a['kaufpreis']).toMatchObject({ pruefung: 'belegt', normiert: 18_700_000 })
    expect(a['anteil_grund_boden']).toMatchObject({ pruefung: 'belegt', normiert: 3_740_000 })
    expect(a['uebergang_nutzen_lasten']).toBeUndefined()
  })

  it('Grundbuchblatt nur übernehmbar, wenn jede Angabe belegt ist', async () => {
    const { grundbuch } = werteKaufvertragAus(AUSZUG, await seitenTexte(musterKaufvertrag()))
    expect(grundbuch[0]).toMatchObject({
      pruefung: 'belegt',
      eintrag: {
        art: 'wohnungsgrundbuch',
        amtsgericht: 'Musterstadt',
        blatt: 'W-1',
        miteigentumsanteil: { zaehler: 8889, nenner: 100000 },
        flurstuecke: [
          { nummer: 'Flurstück A', flaecheQm: 464 },
          { nummer: 'Flurstück B', flaecheQm: 331 },
        ],
      },
    })
    expect(grundbuch[1]!.pruefung).toBe('nicht_belegt')
  })

  it('Scan ohne Text: nicht prüfbar', () => {
    const { felder, grundbuch } = werteKaufvertragAus(AUSZUG, [])
    expect(felder.every((x) => x.pruefung === 'scan')).toBe(true)
    expect(grundbuch[0]!.pruefung).toBe('scan')
  })
})

describe('Lesen von Brüchen, Flächen und Gebäudeanteil', () => {
  it('bruchAus', () => {
    expect(bruchAus('88,89/1.000')).toEqual({ zaehler: 8889, nenner: 100000 })
    expect(bruchAus('125/10.000 Miteigentumsanteil')).toEqual({ zaehler: 125, nenner: 10000 })
    expect(bruchAus('1/2')).toEqual({ zaehler: 1, nenner: 2 })
    expect(bruchAus('3/2')).toBeNull()
    expect(bruchAus('ein Halb')).toBeNull()
  })

  it('flaecheAus', () => {
    expect(flaecheAus('464 m²')).toBe(464)
    expect(flaecheAus('1.250 qm')).toBe(1250)
    expect(flaecheAus('14,6 m2')).toBe(15)
    expect(flaecheAus('464')).toBeNull()
  })

  it('gebaeudeanteilAus', () => {
    expect(gebaeudeanteilAus(18_700_000, 3_740_000)).toBe(800)
    expect(gebaeudeanteilAus(18_700_000, 20_000_000)).toBeNull()
  })
})
