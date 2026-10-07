import { describe, expect, it } from 'vitest'
import {
  betriebskostenabrechnung,
  cent,
  monate,
  vorauszahlungSoll,
  type Kostenposition,
} from '../src/index'

/**
 * Sollwert: echte Betriebskostenabrechnung 2022 einer Eigentumswohnung (Musterobjekt, ohne
 * Namen und Anschrift). WEG mit 12 Einheiten und 671,79 m², Einheit 59,72 m², Mieter ab
 * 01.02.2022, Vorauszahlung 146 € im Monat. Kosten aus der Hausgeldabrechnung der WEG,
 * Heizung/Wasser direkt laut Messdienst, Grundsteuer laut Bescheid.
 */
const FLAECHE = { art: 'wohnflaeche', gesamtQm100: 67_179 } as const
const POSITIONEN: Kostenposition[] = [
  {
    kostenart: 'grundsteuer',
    bezeichnung: 'Grundsteuer',
    gesamtCent: cent(17_714),
    schluessel: { art: 'direkt', einheitCent: cent(17_714) },
  },
  {
    kostenart: 'heizung',
    bezeichnung: 'Heizung/Wasser/Abwasser laut Messdienst',
    gesamtCent: cent(1_063_856),
    schluessel: { art: 'direkt', einheitCent: cent(146_513) },
  },
  {
    kostenart: 'entwaesserung',
    bezeichnung: 'Niederschlagswasser',
    gesamtCent: cent(22_384),
    schluessel: FLAECHE,
  },
  {
    kostenart: 'strassenreinigung_muell',
    bezeichnung: 'Restmüll',
    gesamtCent: cent(73_200),
    schluessel: FLAECHE,
  },
  {
    kostenart: 'antenne_kabel',
    bezeichnung: 'Kabelgebühr',
    gesamtCent: cent(130_919),
    schluessel: { art: 'einheiten', anzahl: 12 },
  },
  {
    kostenart: 'beleuchtung',
    bezeichnung: 'Strom allgemein',
    gesamtCent: cent(385_406),
    schluessel: FLAECHE,
  },
  {
    kostenart: 'versicherung',
    bezeichnung: 'Gebäudeversicherung',
    gesamtCent: cent(146_958),
    schluessel: FLAECHE,
  },
  {
    kostenart: 'gebaeudereinigung',
    bezeichnung: 'Hausreinigung',
    gesamtCent: cent(135_504),
    schluessel: FLAECHE,
  },
  {
    kostenart: 'strassenreinigung_muell',
    bezeichnung: 'Winterdienst',
    gesamtCent: cent(68_645),
    schluessel: FLAECHE,
  },
  {
    kostenart: 'gartenpflege',
    bezeichnung: 'Gartenpflege',
    gesamtCent: cent(61_078),
    schluessel: FLAECHE,
  },
  {
    kostenart: 'strassenreinigung_muell',
    bezeichnung: 'Straßenreinigung',
    gesamtCent: cent(16_385),
    schluessel: FLAECHE,
  },
]
const JAHR = { von: '2022-01-01', bis: '2022-12-31' }
const EINHEIT = { wohnflaecheQm100: 5_972 }

/** Mieteranteile 11/12 aus der Original-Tabelle (dort zweimal gerundet) */
const ORIGINAL = [16238, 134304, 1824, 5965, 10001, 31406, 11975, 11042, 5594, 4978, 1336]

describe('Betriebskosten: Sollwert Abrechnung 2022', () => {
  const vz = vorauszahlungSoll([{ ab: '2021-01-01', monatCent: cent(14_600) }], {
    von: '2022-02-01',
    bis: '2022-12-31',
  })
  const a = betriebskostenabrechnung({
    zeitraum: JAHR,
    einheit: EINHEIT,
    positionen: POSITIONEN,
    nutzungen: [
      {
        id: 'mieter',
        zeitraum: { von: '2022-02-01', bis: '2022-12-31' },
        personen: 2,
        vorauszahlungenCent: vz,
      },
    ],
  })
  const m = a.mieter[0]!

  it('Jahresanteile der Einheit wie in der Tabelle', () => {
    expect(a.jahresanteil.map((z) => z.anteilCent)).toEqual([
      17714, 146513, 1990, 6507, 10910, 34261, 13064, 12046, 6102, 5430, 1457,
    ])
    expect(a.jahresanteil.reduce((s, z) => s + z.anteilCent, 0)).toBe(255_994)
  })

  it('Mieteranteil Februar bis Dezember: elf Monate, jede Zeile einmal gerundet', () => {
    expect(m.monate).toBe(11)
    expect(m.zeilen.map((z) => z.anteilCent)).toEqual([
      16238, 134304, 1824, 5965, 10001, 31406, 11975, 11042, 5594, 4977, 1335,
    ])
    // Original: höchstens 1 Cent je Zeile Abweichung (dort zweimal gerundet) …
    m.zeilen.forEach((z, i) => expect(Math.abs(z.anteilCent - ORIGINAL[i]!)).toBeLessThanOrEqual(1))
    // … und die Summe ist die Summe der Zeilen; im Original 2.346,61 bei Zeilensumme 2.346,63.
    expect(m.kostenCent).toBe(234_661)
  })

  it('Vorauszahlungen nur für den Abrechnungszeitraum: 11 × 146 €', () => {
    expect(vz).toBe(160_600)
    // Original hatte 12 × 146 € angerechnet und kam auf 594,61 €.
    expect(m.saldoCent).toBe(74_061)
  })

  it('Januar war Leerstand: trägt der Vermieter, Summe geht auf den Cent auf', () => {
    expect(a.leerstandCent + m.kostenCent).toBe(255_994)
    expect(a.leerstand[0]!.anteilCent).toBe(17714 - 16238)
  })

  it('weist auf die Zwischenablesung der Heizkosten hin', () => {
    expect(m.hinweise.map((h) => h.code)).toEqual(['heizkosten_zeitanteilig'])
  })
})

/**
 * Zweiter Sollwert: Einzelabrechnung 2024 der WEG für dieselbe Einheit (Hausgeldabrechnung
 * der Verwaltung, nur Beträge). Jede Zeile auf den Cent wie die Verwaltung; umlagefähig sind
 * nur die Betriebskosten nach § 2 BetrKV, Verwaltung, Bankspesen und Reparaturen nicht.
 */
describe('Betriebskosten: Sollwert WEG-Einzelabrechnung 2024', () => {
  const bk = (
    kostenart: Kostenposition['kostenart'],
    bezeichnung: string,
    gesamt: number,
    schluessel: Kostenposition['schluessel'] = FLAECHE,
  ): Kostenposition => ({ kostenart, bezeichnung, gesamtCent: cent(gesamt), schluessel })
  const positionen = [
    bk('heizung', 'Heizung/Wasser/Abwasser laut Messdienst', 1_121_592, {
      art: 'direkt',
      einheitCent: cent(145_510),
    }),
    bk('entwaesserung', 'Niederschlagswasser', 23_105),
    bk('strassenreinigung_muell', 'Restmüll', 73_200),
    bk('antenne_kabel', 'Kabelgebühr', 65_102, { art: 'einheiten', anzahl: 12 }),
    bk('beleuchtung', 'Strom allgemein', 72_648),
    bk('versicherung', 'Gebäudeversicherung', 213_446),
    bk('gebaeudereinigung', 'Hausreinigung', 250_839),
    bk('strassenreinigung_muell', 'Winterdienst', 74_197),
    bk('strassenreinigung_muell', 'Straßenreinigung', 16_384),
  ]
  const a = betriebskostenabrechnung({
    zeitraum: { von: '2024-01-01', bis: '2024-12-31' },
    einheit: EINHEIT,
    positionen,
    nutzungen: [
      {
        id: 'mieter',
        zeitraum: { von: '2024-01-01', bis: '2024-12-31' },
        personen: 2,
        vorauszahlungenCent: vorauszahlungSoll([{ ab: '2023-12-01', monatCent: cent(18_900) }], {
          von: '2024-01-01',
          bis: '2024-12-31',
        }),
      },
    ],
  })
  const m = a.mieter[0]!

  it('jede Zeile wie die Verwaltung, Summe 2.152,80 €', () => {
    expect(m.zeilen.map((z) => z.anteilCent)).toEqual([
      145_510, 2_054, 6_507, 5_425, 6_458, 18_975, 22_299, 6_596, 1_456,
    ])
    expect(m.kostenCent).toBe(215_280)
    expect(a.leerstandCent).toBe(0)
  })

  it('Verwaltung und Reparaturen rechnet der Kern ebenso nach, sie gehören aber nicht in die Mieterabrechnung', () => {
    const nicht = [
      [8_791, 781],
      [23_800, 2_116],
      [22_361, 1_988],
      [46_279, 4_114],
      [1_396, 124],
      [79_992, 7_111],
      [671_808, 59_722], // Zuführung Rücklage
    ]
    for (const [gesamt, soll] of nicht) {
      expect(
        betriebskostenabrechnung({
          zeitraum: JAHR,
          einheit: EINHEIT,
          positionen: [bk('sonstige_betriebskosten', 'x', gesamt!)],
          nutzungen: [],
        }).jahresanteil[0]!.anteilCent,
      ).toBe(soll)
    }
  })

  it('weist auf das Ende der Kabel-Umlage zum 30.06.2024 hin', () => {
    expect(m.hinweise.map((h) => h.code)).toEqual(['kabel_nebenkostenprivileg'])
  })
})

describe('Betriebskosten: Zeitanteile und Schlüssel', () => {
  it('Monate: volle Monate ganz, angebrochene nach Tagen', () => {
    expect(monate(JAHR)).toBe(12)
    expect(monate({ von: '2022-02-01', bis: '2022-12-31' })).toBe(11)
    expect(monate({ von: '2022-01-16', bis: '2022-01-31' })).toBeCloseTo(16 / 31, 12)
    expect(monate({ von: '2024-02-15', bis: '2024-03-31' })).toBeCloseTo(15 / 29 + 1, 12)
    expect(() => monate({ von: '2022-03-01', bis: '2022-02-01' })).toThrow(/vor von/)
  })

  it('Vorauszahlung mit Erhöhung zum 01.12.', () => {
    const stufen = [
      { ab: '2022-02-01', monatCent: cent(14_600) },
      { ab: '2022-12-01', monatCent: cent(18_900) },
    ]
    expect(vorauszahlungSoll(stufen, JAHR)).toBe(10 * 14_600 + 18_900)
  })

  it('Mieterwechsel: Auszug 30.06., Einzug 01.08.; Juli Leerstand', () => {
    const a = betriebskostenabrechnung({
      zeitraum: JAHR,
      einheit: EINHEIT,
      positionen: POSITIONEN,
      nutzungen: [
        {
          id: 'neu',
          zeitraum: { von: '2022-08-01', bis: '2022-12-31' },
          personen: 1,
          vorauszahlungenCent: cent(0),
        },
        {
          id: 'alt',
          zeitraum: { von: '2022-01-01', bis: '2022-06-30' },
          personen: 2,
          vorauszahlungenCent: cent(0),
        },
      ],
    })
    expect(a.mieter.map((x) => [x.id, x.monate])).toEqual([
      ['alt', 6],
      ['neu', 5],
    ])
    const summeMieter = a.mieter.reduce((s, x) => s + x.kostenCent, 0)
    expect(summeMieter + a.leerstandCent).toBe(255_994)
    // Leerstand ≈ ein Zwölftel, bis auf Rundungsreste
    expect(Math.abs(a.leerstandCent - Math.round(255_994 / 12))).toBeLessThanOrEqual(11)
  })

  it('Personenschlüssel: nach Personenmonaten, kein Leerstand', () => {
    const a = betriebskostenabrechnung({
      zeitraum: JAHR,
      einheit: EINHEIT,
      positionen: [
        {
          kostenart: 'wasserversorgung',
          bezeichnung: 'Wasser',
          gesamtCent: cent(120_000),
          schluessel: { art: 'personen', gesamtPersonenmonate: 240 },
        },
      ],
      nutzungen: [
        {
          id: 'm',
          zeitraum: { von: '2022-07-01', bis: '2022-12-31' },
          personen: 2,
          vorauszahlungenCent: cent(10_000),
        },
      ],
    })
    // 2 Personen × 6 Monate / 240 Personenmonate = 1/20
    expect(a.mieter[0]!.kostenCent).toBe(6_000)
    expect(a.mieter[0]!.saldoCent).toBe(-4_000)
    expect(a.leerstandCent).toBe(0)
    expect(a.mieter[0]!.hinweise).toEqual([])
  })

  it('Miteigentumsanteile nur mit Anteil der Einheit', () => {
    const mea: Kostenposition = {
      kostenart: 'versicherung',
      bezeichnung: 'Versicherung',
      gesamtCent: cent(100_000),
      schluessel: { art: 'mea', gesamt: 1000 },
    }
    const nutzung = [{ id: 'm', zeitraum: JAHR, personen: 1, vorauszahlungenCent: cent(0) }]
    expect(
      betriebskostenabrechnung({
        zeitraum: JAHR,
        einheit: { wohnflaecheQm100: 5_000, mea: 89 },
        positionen: [mea],
        nutzungen: nutzung,
      }).mieter[0]!.kostenCent,
    ).toBe(8_900)
    expect(() =>
      betriebskostenabrechnung({
        zeitraum: JAHR,
        einheit: EINHEIT,
        positionen: [mea],
        nutzungen: nutzung,
      }),
    ).toThrow(/Miteigentumsanteil/)
  })

  it('lehnt unstimmige Eingaben ab', () => {
    const n = (von: string, bis: string, id = 'm') => ({
      id,
      zeitraum: { von, bis },
      personen: 1,
      vorauszahlungenCent: cent(0),
    })
    const rechne = (nutzungen: ReturnType<typeof n>[], zeitraum = JAHR) =>
      betriebskostenabrechnung({ zeitraum, einheit: EINHEIT, positionen: POSITIONEN, nutzungen })
    expect(() => rechne([n('2021-12-01', '2022-03-31')])).toThrow(/außerhalb/)
    expect(() =>
      rechne([n('2022-01-01', '2022-06-30', 'a'), n('2022-06-30', '2022-12-31', 'b')]),
    ).toThrow(/überschneiden/)
    expect(() => rechne([], { von: '2022-01-01', bis: '2023-01-31' })).toThrow(/zwölf Monate/)
    expect(() =>
      betriebskostenabrechnung({
        zeitraum: JAHR,
        einheit: { wohnflaecheQm100: 70_000 },
        positionen: POSITIONEN,
        nutzungen: [],
      }),
    ).toThrow(/Gesamtfläche/)
  })
})
