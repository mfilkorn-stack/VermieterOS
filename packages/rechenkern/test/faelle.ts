import type { ObjektStand } from '../src/datenqualitaet'

/**
 * Testfall nach einem echten Kaufvertrag (2021): Eigentumswohnung mit 88,89/1000 MEA an zwei
 * Flurstücken (464 m² und 331 m²) plus separat gekaufter Stellplatz im Alleineigentum
 * (eigenes Flurstück, 14 m²), Kaufpreis 187.000 € für beides, zwei Erwerber zu je 1/2.
 *
 * Aus dem Vertrag: Struktur, Flächen, MEA, Kaufpreis, Vertragsdatum, Eigentumsanteile.
 * ANNAHMEN (nicht im Vertrag, bis echte Werte vorliegen): Übergang von Nutzen und Lasten,
 * Baujahr, Wohnfläche, Nebenkostenbeträge außer GrESt, Gebäudeanteil.
 * Keine Namen, Adressen, Flurstücksnummern oder Kontodaten aus dem Vertrag.
 */
export const VERTRAG = {
  kaufvertragDatum: '2021-04-30',
  kaufpreisCent: 18_700_000,
  meaZaehler: 8889,
  meaNenner: 100_000,
  flurstueckeQm: [464, 331],
  stellplatzQm: 14,
  /** Bayern 3,5 % */
  grunderwerbsteuerCent: 654_500,
} as const

export const ANNAHMEN = {
  anschaffungsdatum: '2021-07-01',
  baujahr: 1970,
  wohnflaecheQm100: 6500,
  notarKaufvertragCent: 150_000,
  grundbuchEigentumCent: 60_000,
  notarGrundschuldCent: 40_000,
  gebaeudeanteilPromille: 800,
} as const

export function etwMitStellplatz(): ObjektStand {
  return {
    id: 'objekt-etw',
    objekt: {
      bezeichnung: 'ETW mit Stellplatz',
      strasse: 'Musterweg',
      hausnummer: '18',
      plz: '99999',
      ort: 'Musterstadt',
      art: 'etw',
      weg: true,
      baujahr: ANNAHMEN.baujahr,
      grundbuch: [
        {
          art: 'wohnungsgrundbuch',
          amtsgericht: 'Musterstadt',
          blatt: 'W-1',
          miteigentumsanteil: { zaehler: VERTRAG.meaZaehler, nenner: VERTRAG.meaNenner },
          flurstuecke: [
            {
              nummer: 'Flst. A',
              bezeichnung: 'Wohnhaus, Garten',
              flaecheQm: VERTRAG.flurstueckeQm[0],
            },
            {
              nummer: 'Flst. B',
              bezeichnung: 'Wohnhaus, Garten',
              flaecheQm: VERTRAG.flurstueckeQm[1],
            },
          ],
        },
        {
          art: 'grundbuch',
          amtsgericht: 'Musterstadt',
          blatt: 'G-2',
          flurstuecke: [
            { nummer: 'Flst. C', bezeichnung: 'Stellplatz', flaecheQm: VERTRAG.stellplatzQm },
          ],
        },
      ],
      kaufvertragDatum: VERTRAG.kaufvertragDatum,
      anschaffungsdatum: ANNAHMEN.anschaffungsdatum,
      kaufpreisCent: VERTRAG.kaufpreisCent,
      anschaffungsnebenkosten: [
        { art: 'grunderwerbsteuer', betragCent: VERTRAG.grunderwerbsteuerCent },
        { art: 'notar_kaufvertrag', betragCent: ANNAHMEN.notarKaufvertragCent },
        { art: 'grundbuch_eigentum', betragCent: ANNAHMEN.grundbuchEigentumCent },
        { art: 'notar_grundschuld', betragCent: ANNAHMEN.notarGrundschuldCent },
      ],
      gebaeudeanteilPromille: ANNAHMEN.gebaeudeanteilPromille,
      afaSatzPromille: 20,
      afaBeginn: ANNAHMEN.anschaffungsdatum,
    },
    einheiten: [
      {
        id: 'wohnung',
        daten: {
          bezeichnung: 'Wohnung Nr. 1',
          typ: 'wohnung',
          wohnflaecheQm100: ANNAHMEN.wohnflaecheQm100,
          miteigentumsanteilZaehler: VERTRAG.meaZaehler,
          miteigentumsanteilNenner: VERTRAG.meaNenner,
        },
        mietverhaeltnisse: [],
      },
      {
        id: 'stellplatz',
        daten: { bezeichnung: 'Stellplatz', typ: 'stellplatz' },
        mietverhaeltnisse: [],
      },
    ],
    darlehen: [],
    eigentum: {
      mandantId: 'mandant-1',
      art: 'bruchteil',
      anteile: [
        { zaehler: 1, nenner: 2 },
        { zaehler: 1, nenner: 2 },
      ],
    },
  }
}
