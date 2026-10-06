import type { ZuordnungsKandidat } from '@vermieteros/db'
import { describe, expect, it } from 'vitest'
import { bestimmeZuordnung } from '../src/zuordnung'

function k(id: string, p: Partial<ZuordnungsKandidat> = {}): ZuordnungsKandidat {
  return {
    mietverhaeltnisId: id,
    beginn: '2024-01-01',
    ende: null,
    mieterEmails: ['mieter@example.org'],
    mieterNamen: ['Mieter'],
    einheit: 'EG links',
    objekt: 'Haus am Park',
    strasse: 'Parkweg',
    hausnummer: '3',
    ...p,
  }
}
const mail = (p: Partial<Parameters<typeof bestimmeZuordnung>[0]> = {}) => ({
  vonAdresse: 'Mieter@Example.org',
  betreff: 'Heizung',
  datum: '2026-10-01T08:00:00Z',
  verlauf: null,
  ...p,
})

describe('bestimmeZuordnung', () => {
  it('Verlauf hat Vorrang vor allem anderen', () => {
    expect(
      bestimmeZuordnung(mail({ verlauf: 'mv-x', vonAdresse: 'fremd@example.org' }), [k('a')]),
    ).toEqual({
      mietverhaeltnisId: 'mv-x',
      art: 'verlauf',
    })
  })

  it('Absender eindeutig, Groß- und Kleinschreibung egal', () => {
    expect(
      bestimmeZuordnung(mail(), [k('a'), k('b', { mieterEmails: ['andere@example.org'] })]),
    ).toEqual({
      mietverhaeltnisId: 'a',
      art: 'absender',
    })
  })

  it('unbekannter Absender bleibt offen', () => {
    expect(bestimmeZuordnung(mail({ vonAdresse: 'handwerker@example.org' }), [k('a')])).toBeNull()
  })

  it('zeitlich: kurz vor Beginn und gut ein Jahr nach Ende noch passend, danach nicht', () => {
    const neu = k('neu', { beginn: '2026-12-01' })
    expect(bestimmeZuordnung(mail(), [neu])?.mietverhaeltnisId).toBe('neu')
    expect(bestimmeZuordnung(mail(), [k('neu', { beginn: '2027-03-01' })])).toBeNull()
    expect(bestimmeZuordnung(mail(), [k('alt', { ende: '2025-09-30' })])?.mietverhaeltnisId).toBe(
      'alt',
    )
    expect(bestimmeZuordnung(mail(), [k('alt', { ende: '2025-08-01' })])).toBeNull()
  })

  it('mehrere Mietverhältnisse desselben Mieters: Betreff entscheidet, sonst offen', () => {
    const zwei = [k('eg', { einheit: 'EG links' }), k('og', { einheit: 'OG' })]
    expect(bestimmeZuordnung(mail({ betreff: 'Wasserschaden OG' }), zwei)).toEqual({
      mietverhaeltnisId: 'og',
      art: 'absender_betreff',
    })
    expect(bestimmeZuordnung(mail({ betreff: 'Frage zur Abrechnung' }), zwei)).toBeNull()
    // Teilwörter zählen nicht: „OG“ steckt in „Logistik“
    expect(bestimmeZuordnung(mail({ betreff: 'Logistik' }), zwei)).toBeNull()
  })

  it('mehrere Treffer im Betreff: offen statt geraten', () => {
    const zwei = [k('eg', { einheit: 'EG' }), k('og', { einheit: 'OG' })]
    expect(bestimmeZuordnung(mail({ betreff: 'EG und OG' }), zwei)).toBeNull()
  })
})
