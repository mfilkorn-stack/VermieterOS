import { describe, expect, it } from 'vitest'
import {
  betriebskostenabrechnung,
  cent,
  co2Vermieterprozent,
  messdienstUebernehmen,
  type Kostenposition,
  type Messdienstabrechnung,
} from '../src/index'

/**
 * Sollwert: Einzelabrechnung 2024 des Messdienstes für die Einheit aus den Betriebskosten-
 * Sollwerten (nur Beträge). Erdgas, 15.900 kg CO2 auf 643,59 m² = 24,7 kg/m² → Stufe 30 %
 * Vermieter; Kostenanteil der Einheit 1.190,91 / 7.721,36 €; CO2-Kosten 715,26 €.
 */
const MESSDIENST: Messdienstabrechnung = {
  gesamtCent: cent(1_121_592),
  einheitCent: cent(145_510),
  co2: {
    kostenCent: cent(71_526),
    kg: 15_900,
    flaecheQm100: 64_359,
    tage: 366,
    heizWwEinheitCent: cent(119_091),
    heizWwGesamtCent: cent(772_136),
    vermieterLautMessdienstCent: cent(3_310),
  },
  lohnanteil35aCent: cent(11_224),
}
const JAHR = { von: '2024-01-01', bis: '2024-12-31' }
const FLAECHE = { art: 'wohnflaeche', gesamtQm100: 67_179 } as const
const UEBRIGE: Kostenposition[] = [
  ['entwaesserung', 23_105],
  ['strassenreinigung_muell', 73_200],
  ['beleuchtung', 72_648],
  ['versicherung', 213_446],
  ['gebaeudereinigung', 250_839],
  ['strassenreinigung_muell', 74_197],
  ['strassenreinigung_muell', 16_384],
].map(([kostenart, g]) => ({
  kostenart: kostenart as Kostenposition['kostenart'],
  bezeichnung: String(kostenart),
  gesamtCent: cent(g as number),
  schluessel: FLAECHE,
}))
const KABEL: Kostenposition = {
  kostenart: 'antenne_kabel',
  bezeichnung: 'Kabelgebühr',
  gesamtCent: cent(65_102),
  schluessel: { art: 'einheiten', anzahl: 12 },
}

describe('CO2KostAufG: Stufenmodell Wohngebäude', () => {
  it('Grenzen der Stufen', () => {
    expect(co2Vermieterprozent(0)).toBe(0)
    expect(co2Vermieterprozent(11.99)).toBe(0)
    expect(co2Vermieterprozent(12)).toBe(10)
    expect(co2Vermieterprozent(24.7)).toBe(30)
    expect(co2Vermieterprozent(27)).toBe(40)
    expect(co2Vermieterprozent(51.99)).toBe(80)
    expect(co2Vermieterprozent(52)).toBe(95)
    expect(() => co2Vermieterprozent(-1)).toThrow()
  })
})

describe('Messdienst übernehmen: Sollwert 2024', () => {
  const u = messdienstUebernehmen(MESSDIENST)

  it('rechnet die CO2-Aufteilung des Messdienstes nach', () => {
    expect(u.co2!.kgProQmJahr).toBeCloseTo(24.705, 3)
    expect(u.co2!.vermieterProzent).toBe(30)
    expect(u.co2!.anteilEinheit).toBeCloseTo(0.1542, 4)
    expect(u.co2!.vermieterCent).toBe(3_310)
    expect(u.co2!.mieterCent).toBe(7_722)
    expect(u.hinweise).toEqual([])
  })

  it('umlagefähig 1.422,00 €: Messdienstbetrag minus CO2-Anteil des Vermieters', () => {
    expect(u.umlageCent).toBe(142_200)
    expect(u.positionen.map((p) => p.schluessel)).toEqual([
      { art: 'direkt', einheitCent: 145_510 },
      { art: 'direkt', einheitCent: -3_310 },
    ])
  })

  it('in der Mieterabrechnung: 2.119,70 € statt 2.152,80 €, Lohnanteil § 35a ausgewiesen', () => {
    const a = betriebskostenabrechnung({
      zeitraum: JAHR,
      einheit: { wohnflaecheQm100: 5_972 },
      positionen: [...u.positionen, ...UEBRIGE, KABEL],
      nutzungen: [{ id: 'm', zeitraum: JAHR, personen: 2, vorauszahlungenCent: cent(226_800) }],
      lohnanteil35aCent: u.lohnanteil35aCent,
    })
    const m = a.mieter[0]!
    expect(m.kostenCent).toBe(211_970)
    expect(m.saldoCent).toBe(211_970 - 226_800)
    expect(m.lohnanteil35aCent).toBe(11_224)
    expect(m.hinweise.map((h) => h.code)).toEqual(['kabel_nebenkostenprivileg'])
  })

  it('meldet fehlende oder abweichende CO2-Angaben', () => {
    expect(
      messdienstUebernehmen({
        gesamtCent: MESSDIENST.gesamtCent,
        einheitCent: MESSDIENST.einheitCent,
      }).hinweise[0]!.code,
    ).toBe('co2_fehlt')
    const ab = messdienstUebernehmen({
      ...MESSDIENST,
      co2: { ...MESSDIENST.co2!, vermieterLautMessdienstCent: cent(2_000) },
    })
    expect(ab.hinweise.map((h) => h.code)).toEqual(['co2_abweichung'])
    expect(ab.co2!.vermieterCent).toBe(3_310)
  })

  it('Abrechnungszeitraum unter einem Jahr wird für die Stufe hochgerechnet', () => {
    const halb = messdienstUebernehmen({
      ...MESSDIENST,
      co2: { ...MESSDIENST.co2!, kg: 7_000, tage: 183, vermieterLautMessdienstCent: cent(0) },
    })
    // 7.000 kg / 643,59 m² × 365/183 = 21,7 kg → 20 %
    expect(halb.co2!.vermieterProzent).toBe(20)
  })
})

describe('Messdienst übernehmen: Zwischenablesung bei Mieterwechsel', () => {
  const u = messdienstUebernehmen({
    ...MESSDIENST,
    jeNutzung: { alt: cent(60_000), neu: cent(80_000) },
  })
  const a = betriebskostenabrechnung({
    zeitraum: JAHR,
    einheit: { wohnflaecheQm100: 5_972 },
    positionen: u.positionen,
    nutzungen: [
      {
        id: 'alt',
        zeitraum: { von: '2024-01-01', bis: '2024-05-31' },
        personen: 1,
        vorauszahlungenCent: cent(0),
      },
      {
        id: 'neu',
        zeitraum: { von: '2024-07-01', bis: '2024-12-31' },
        personen: 2,
        vorauszahlungenCent: cent(0),
      },
    ],
  })

  it('Beträge laut Ablesung, CO2-Abzug im Verhältnis, Rest als Leerstand', () => {
    const [alt, neu] = a.mieter
    expect(alt!.zeilen[0]!.anteilCent).toBe(60_000)
    expect(neu!.zeilen[0]!.anteilCent).toBe(80_000)
    const abzug =
      alt!.zeilen[1]!.anteilCent + neu!.zeilen[1]!.anteilCent + a.leerstand[1]!.anteilCent
    expect(abzug).toBe(-3_310)
    expect(a.leerstand[0]!.anteilCent).toBe(145_510 - 140_000)
    // kein Hinweis auf Zwischenablesung, sie liegt vor
    expect(alt!.hinweise).toEqual([])
  })

  it('lehnt Beträge über dem der Einheit und fehlende Nutzungen ab', () => {
    expect(() => messdienstUebernehmen({ ...MESSDIENST, jeNutzung: { a: cent(150_000) } })).toThrow(
      /übersteigen/,
    )
    expect(() =>
      betriebskostenabrechnung({
        zeitraum: JAHR,
        einheit: { wohnflaecheQm100: 5_972 },
        positionen: u.positionen,
        nutzungen: [{ id: 'dritter', zeitraum: JAHR, personen: 1, vorauszahlungenCent: cent(0) }],
      }),
    ).toThrow(/kein Betrag für Nutzung dritter/)
  })
})
