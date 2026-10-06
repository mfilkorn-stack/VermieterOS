import { describe, expect, it } from 'vitest'
import {
  anteil,
  cent,
  formatEuro,
  parseEuro,
  rundeKaufmaennisch,
  summe,
  tageImJahr,
  tageInklusive,
  verteile,
} from '../src/index'

describe('cent', () => {
  it('akzeptiert nur ganze Zahlen', () => {
    expect(cent(12345)).toBe(12345)
    expect(() => cent(1.5)).toThrow(RangeError)
    expect(() => cent(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError)
  })
})

describe('parseEuro', () => {
  it('liest deutsches und englisches Format', () => {
    expect(parseEuro('1.234,56')).toBe(123456)
    expect(parseEuro('1,234.56')).toBe(123456)
    expect(parseEuro('1234,5')).toBe(123450)
    expect(parseEuro('1234.5')).toBe(123450)
    expect(parseEuro('-12')).toBe(-1200)
    expect(parseEuro(' 850,00 € ')).toBe(85000)
    expect(parseEuro('0,07')).toBe(7)
    expect(parseEuro('1.234')).toBe(123400) // drei Stellen nach Trenner = Tausender
    // Komma mit drei Stellen ist mehrdeutig (Tausender oder Dezimal) und wird abgelehnt.
    expect(() => parseEuro('12,345')).toThrow()
  })
  it('wirft bei unlesbarem Text', () => {
    expect(() => parseEuro('')).toThrow()
    expect(() => parseEuro('1,2,3')).toThrow()
    expect(() => parseEuro('12,3456')).toThrow()
    expect(() => parseEuro('abc')).toThrow()
  })
})

describe('formatEuro', () => {
  it('formatiert mit Tausenderpunkt und Komma', () => {
    expect(formatEuro(cent(123456))).toBe('1.234,56 €')
    expect(formatEuro(cent(-7))).toBe('-0,07 €')
    expect(formatEuro(cent(100000000), false)).toBe('1.000.000,00')
  })
  it('ist invers zu parseEuro', () => {
    for (const n of [0, 1, 99, 100, 123456, -98765, 999999999]) {
      expect(parseEuro(formatEuro(cent(n)))).toBe(n)
    }
  })
})

describe('rundeKaufmaennisch', () => {
  it('rundet halbe weg von null', () => {
    expect(rundeKaufmaennisch(2.5)).toBe(3)
    expect(rundeKaufmaennisch(-2.5)).toBe(-3)
    expect(rundeKaufmaennisch(2.4999)).toBe(2)
    expect(rundeKaufmaennisch(1.005 * 100)).toBe(101) // 100.49999999999999 → Epsilon fängt es
  })
})

describe('anteil', () => {
  it('rechnet Umsatzsteuer korrekt', () => {
    expect(anteil(cent(10000), 0.19)).toBe(1900)
    expect(anteil(cent(8403), 0.19)).toBe(1597) // 1596.57
  })
})

describe('verteile', () => {
  it('summiert immer exakt auf den Gesamtbetrag', () => {
    const faelle: Array<[number, number[]]> = [
      [100, [1, 1, 1]],
      [1000, [33.3, 33.3, 33.4]],
      [99999, [72.5, 48, 60.25, 110]],
      [1, [5, 5]],
      [-100, [1, 1, 1]],
      [123457, [1, 0, 2]],
    ]
    for (const [gesamt, gewichte] of faelle) {
      const anteile = verteile(cent(gesamt), gewichte)
      expect(summe(anteile)).toBe(gesamt)
      expect(anteile).toHaveLength(gewichte.length)
    }
  })

  it('verteilt nach Wohnfläche wie eine Nebenkostenabrechnung', () => {
    // 3 Wohnungen: 72,50 m², 48,00 m², 60,25 m². Müllabfuhr 1.234,56 €.
    const anteile = verteile(cent(123456), [7250, 4800, 6025])
    // Rohwerte: 49519.004, 32784.996, 41152.000 → Rest 1 Cent an die größte Nachkommastelle (Pos. 1)
    expect(anteile).toEqual([49519, 32785, 41152])
    expect(summe(anteile)).toBe(123456)
  })

  it('gibt Null-Gewichten null Cent', () => {
    expect(verteile(cent(1000), [0, 1])).toEqual([0, 1000])
  })

  it('ist deterministisch bei Gleichstand', () => {
    expect(verteile(cent(1), [1, 1])).toEqual([1, 0])
    expect(verteile(cent(2), [1, 1, 1])).toEqual([1, 1, 0])
  })

  it('wirft bei ungültigen Gewichten', () => {
    expect(() => verteile(cent(100), [])).toThrow()
    expect(() => verteile(cent(100), [0, 0])).toThrow()
    expect(() => verteile(cent(100), [-1, 2])).toThrow()
  })
})

describe('Tage', () => {
  it('zählt inklusive', () => {
    expect(tageInklusive('2025-01-01', '2025-12-31')).toBe(365)
    expect(tageInklusive('2024-01-01', '2024-12-31')).toBe(366)
    expect(tageInklusive('2025-03-15', '2025-03-15')).toBe(1)
    expect(tageInklusive('2025-03-29', '2025-04-02')).toBe(5) // über die Zeitumstellung
  })
  it('kennt Schaltjahre', () => {
    expect(tageImJahr(2024)).toBe(366)
    expect(tageImJahr(2025)).toBe(365)
    expect(tageImJahr(2100)).toBe(365)
    expect(tageImJahr(2000)).toBe(366)
  })
  it('wirft bei verdrehtem Intervall', () => {
    expect(() => tageInklusive('2025-02-01', '2025-01-01')).toThrow()
  })
})
