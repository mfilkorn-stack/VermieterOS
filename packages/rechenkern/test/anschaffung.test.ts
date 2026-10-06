import { describe, expect, it } from 'vitest'
import {
  afaImJahr,
  afaJahresbetrag,
  afaSatzVorschlag,
  anschaffungskosten,
  anteiligeGrundstuecksflaeche,
  cent,
  fristen,
  grenzeAnschaffungsnaheHk,
  istAnschaffungskosten,
  parseDezimal,
  summe,
} from '../src/index'
import { ANNAHMEN, etwMitStellplatz, VERTRAG } from './faelle'

describe('Anschaffungskosten (ETW mit Stellplatz)', () => {
  const o = etwMitStellplatz().objekt
  const ak = anschaffungskosten(
    cent(o.kaufpreisCent!),
    o.anschaffungsnebenkosten!,
    o.gebaeudeanteilPromille!,
  )

  it('Grundschuldkosten sind Finanzierung, nicht Anschaffungskosten', () => {
    expect(istAnschaffungskosten('grunderwerbsteuer')).toBe(true)
    expect(istAnschaffungskosten('notar_grundschuld')).toBe(false)
    expect(ak.finanzierungskosten).toBe(ANNAHMEN.notarGrundschuldCent)
    expect(ak.nebenkostenAk).toBe(
      VERTRAG.grunderwerbsteuerCent +
        ANNAHMEN.notarKaufvertragCent +
        ANNAHMEN.grundbuchEigentumCent,
    )
  })

  it('teilt auf Grund und Gebäude exakt auf', () => {
    // 187.000 + 6.545 + 1.500 + 600 = 195.645 €; 80 % Gebäude
    expect(ak.gesamt).toBe(19_564_500)
    expect(ak.gebaeude).toBe(15_651_600)
    expect(ak.grund).toBe(3_912_900)
    expect(ak.grund + ak.gebaeude).toBe(ak.gesamt)
  })

  it('15-%-Grenze für anschaffungsnahe Herstellungskosten', () => {
    expect(grenzeAnschaffungsnaheHk(ak.gebaeude)).toBe(2_347_740)
  })

  it('AfA: erstes Jahr monatsgenau, Summe über die Laufzeit genau die Bemessungsgrundlage', () => {
    expect(afaJahresbetrag(ak.gebaeude, 20)).toBe(313_032)
    // Übergang 1. Juli: Juli bis Dezember = 6/12
    expect(afaImJahr(ak.gebaeude, 20, '2021-07-01', 2021)).toBe(156_516)
    expect(afaImJahr(ak.gebaeude, 20, '2021-07-01', 2022)).toBe(313_032)
    expect(afaImJahr(ak.gebaeude, 20, '2021-07-01', 2020)).toBe(0)
    const jahre = Array.from({ length: 60 }, (_, i) =>
      afaImJahr(ak.gebaeude, 20, '2021-07-01', 2021 + i),
    )
    expect(summe(jahre)).toBe(ak.gebaeude)
    expect(jahre.at(-1)).toBe(0)
  })

  it('Monat der Anschaffung zählt voll, auch am Monatsletzten', () => {
    expect(afaImJahr(cent(1_200_000), 20, '2021-12-31', 2021)).toBe(2_000)
    expect(afaImJahr(cent(1_200_000), 20, '2021-01-01', 2021)).toBe(24_000)
  })

  it('wirft bei unsinnigem Gebäudeanteil', () => {
    expect(() => anschaffungskosten(cent(100), [], 1001)).toThrow()
    expect(() => anschaffungskosten(cent(100), [], 12.5)).toThrow()
  })
})

describe('afaSatzVorschlag (§ 7 Abs. 4 EStG)', () => {
  it('Grenzen bei 1925 und 2023', () => {
    expect(afaSatzVorschlag(1924).satzPromille).toBe(25)
    expect(afaSatzVorschlag(1925).satzPromille).toBe(20)
    expect(afaSatzVorschlag(2022).satzPromille).toBe(20)
    expect(afaSatzVorschlag(2023).satzPromille).toBe(30)
    expect(() => afaSatzVorschlag(19)).toThrow()
  })
})

describe('anteiligeGrundstuecksflaeche', () => {
  it('MEA × Flurstücke der ETW plus volle Fläche des Stellplatzes', () => {
    // 795 m² × 8889/100000 = 70,668 m² → 7067; + 14 m² = 84,67 m²
    expect(anteiligeGrundstuecksflaeche(etwMitStellplatz().objekt.grundbuch!)).toBe(8467)
  })
})

describe('fristen', () => {
  it('Spekulationsfrist ab Kaufvertrag, 15-%-Zeitraum ab Übergang', () => {
    expect(fristen(VERTRAG.kaufvertragDatum, ANNAHMEN.anschaffungsdatum)).toEqual({
      spekulationsfristEnde: '2031-04-30',
      anschaffungsnaheHkEnde: '2024-07-01',
    })
    expect(fristen(null, null)).toEqual({
      spekulationsfristEnde: null,
      anschaffungsnaheHkEnde: null,
    })
  })
  it('29. Februar wird im Nicht-Schaltjahr zum 28.', () => {
    expect(fristen('2020-02-29', null).spekulationsfristEnde).toBe('2030-02-28')
  })
})

describe('parseDezimal', () => {
  it('Flächen, Zimmer, Prozent', () => {
    expect(parseDezimal('72,50', 2)).toBe(7250)
    expect(parseDezimal('72.5', 2)).toBe(7250)
    expect(parseDezimal('1.234,5', 2)).toBe(123450)
    expect(parseDezimal('2,5', 1)).toBe(25)
    expect(parseDezimal('2', 1)).toBe(20)
    expect(parseDezimal('88,89', 2)).toBe(8889)
    expect(parseDezimal('464', 0)).toBe(464)
  })
  it('deutsches Format hat bei Mehrdeutigkeit Vorrang', () => {
    expect(parseDezimal('1.234', 3)).toBe(1_234_000)
  })
  it('wirft bei Unsinn', () => {
    expect(() => parseDezimal('', 2)).toThrow()
    expect(() => parseDezimal('7,255', 2)).toThrow()
    expect(() => parseDezimal('abc', 2)).toThrow()
    expect(() => parseDezimal('2,5', 0)).toThrow()
  })
})
