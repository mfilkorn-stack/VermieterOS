import { describe, expect, it } from 'vitest'
import { cent, grunderwerbsteuer, referenzwert, type ReferenzEintrag } from '../src/index'

const basis = {
  quelle: 'Test',
  geprueftAm: '2026-10-06',
  pruefenBis: '2027-10-06',
  erfasstAm: '2026-10-06T00:00:00Z',
  mandantId: null,
}

// Bremen: 5,0 % bis 30.06.2025, 5,5 % ab 01.07.2025
const bremen: ReferenzEintrag<{ satzPromille: number }>[] = [
  {
    ...basis,
    id: 'a',
    wert: { satzPromille: 50 },
    gueltigVon: '2014-01-01',
    gueltigBis: '2025-06-30',
  },
  { ...basis, id: 'b', wert: { satzPromille: 55 }, gueltigVon: '2025-07-01', gueltigBis: null },
]

describe('referenzwert', () => {
  it('wählt den am Stichtag geltenden Wert, Grenzen inklusive', () => {
    expect(referenzwert(bremen, '2025-06-30', '2026-10-06').eintrag?.id).toBe('a')
    expect(referenzwert(bremen, '2025-07-01', '2026-10-06').eintrag?.id).toBe('b')
    expect(referenzwert(bremen, '2025-07-01', '2026-10-06').status).toBe('gueltig')
  })

  it('meldet fehlende Werte vor Beginn der Reihe', () => {
    expect(referenzwert(bremen, '2010-01-01', '2026-10-06')).toEqual({
      status: 'fehlt',
      eintrag: null,
    })
  })

  it('meldet überfällige Prüfung, verwendet den Wert aber weiter', () => {
    const r = referenzwert(bremen, '2026-01-01', '2028-01-01')
    expect(r.status).toBe('ungeprueft')
    expect(r.eintrag?.id).toBe('b')
  })

  it('meldet ausgelaufene Werte (z. B. Mietspiegel) mit dem letzten bekannten Eintrag', () => {
    const mietspiegel: ReferenzEintrag<number>[] = [
      { ...basis, id: 'ms', wert: 1, gueltigVon: '2023-01-01', gueltigBis: '2024-12-31' },
    ]
    expect(referenzwert(mietspiegel, '2025-06-01', '2026-10-06')).toMatchObject({
      status: 'abgelaufen',
      eintrag: { id: 'ms' },
    })
  })

  it('Mandantenwert vor globalem, Korrektur (spätere Erfassung) vor Original', () => {
    const e: ReferenzEintrag<number>[] = [
      { ...basis, id: 'global', wert: 1, gueltigVon: '2020-01-01', gueltigBis: null },
      {
        ...basis,
        id: 'korrektur',
        wert: 2,
        gueltigVon: '2020-01-01',
        gueltigBis: null,
        erfasstAm: '2026-11-01T00:00:00Z',
      },
    ]
    expect(referenzwert(e, '2025-01-01', '2026-12-01').eintrag?.id).toBe('korrektur')
    e.push({
      ...basis,
      id: 'mandant',
      wert: 3,
      gueltigVon: '2019-01-01',
      gueltigBis: null,
      mandantId: 'm1',
    })
    expect(referenzwert(e, '2025-01-01', '2026-12-01').eintrag?.id).toBe('mandant')
  })
})

describe('grunderwerbsteuer', () => {
  it('rechnet den Satz und rundet auf volle Euro ab', () => {
    expect(grunderwerbsteuer(cent(18_700_000), 35)).toBe(654_500)
    expect(grunderwerbsteuer(cent(25_012_345), 65)).toBe(1_625_800) // 16.258,80 € → 16.258 €
    expect(() => grunderwerbsteuer(cent(1), 3.5)).toThrow()
  })
})
