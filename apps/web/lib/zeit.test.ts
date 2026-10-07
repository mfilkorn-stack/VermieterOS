import { describe, expect, it } from 'vitest'
import { berlinZuIso, isoZuBerlin } from './zeit'

describe('Berliner Ortszeit', () => {
  it('Sommer- und Winterzeit', () => {
    expect(berlinZuIso('2026-07-01T10:30')).toBe('2026-07-01T08:30:00.000Z')
    expect(berlinZuIso('2026-12-01T10:30')).toBe('2026-12-01T09:30:00.000Z')
  })
  it('rund um die Umstellung', () => {
    expect(berlinZuIso('2026-03-29T01:30')).toBe('2026-03-29T00:30:00.000Z')
    expect(berlinZuIso('2026-03-29T03:30')).toBe('2026-03-29T01:30:00.000Z')
    expect(berlinZuIso('2026-10-25T04:00')).toBe('2026-10-25T03:00:00.000Z')
  })
  it('hin und zurück', () => {
    for (const z of ['2026-01-15T07:05', '2026-08-31T23:59', '2026-10-07T00:00'])
      expect(isoZuBerlin(berlinZuIso(z))).toBe(z)
  })
  it('wirft bei Unsinn', () => {
    expect(() => berlinZuIso('gestern')).toThrow()
  })
})
