import { describe, expect, it } from 'vitest'
import { platzhalterIn, pruefeEntwurf, rendere, RenderFehler } from '../src/platzhalter'

const KATALOG = { 'mieter.name': 'Name', 'objekt.adresse': 'Adresse' }

describe('Platzhalter', () => {
  it('findet Platzhalter ohne Dubletten, auch mit Leerzeichen', () => {
    expect(
      platzhalterIn('Hallo {{mieter.name}}, {{ mieter.name }} und {{objekt.adresse}}'),
    ).toEqual(['mieter.name', 'objekt.adresse'])
  })

  it('ein Entwurf ohne Zahlen und mit bekannten Platzhaltern ist in Ordnung', () => {
    expect(pruefeEntwurf('Guten Tag {{mieter.name}}, wir kümmern uns.', KATALOG)).toEqual([])
  })

  it('Zahlen außerhalb von Platzhaltern fallen auf: Betrag, Datum, Telefonnummer', () => {
    const b = pruefeEntwurf('Die Miete beträgt 650,00 € ab 01.11. – Tel. 0221/123', KATALOG)
    expect(b.map((x) => x.art)).toEqual(['zahl', 'zahl', 'zahl'])
    expect(b).toContainEqual({ art: 'zahl', auszug: '650,00' })
  })

  it('unbekannte Platzhalter fallen auf', () => {
    expect(pruefeEntwurf('Ihre Miete: {{mietkondition.kaltmiete}}', KATALOG)).toEqual([
      { art: 'unbekannter_platzhalter', schluessel: 'mietkondition.kaltmiete' },
    ])
  })

  it('rendert Fakten und bricht ab, wenn ein Wert fehlt', () => {
    expect(rendere('Hallo {{mieter.name}}', { 'mieter.name': 'Erika Muster' })).toBe(
      'Hallo Erika Muster',
    )
    expect(() => rendere('{{mieter.name}} in {{objekt.adresse}}', { 'mieter.name': 'X' })).toThrow(
      RenderFehler,
    )
    expect(() => rendere('{{mieter.name}}', { 'mieter.name': null })).toThrow(/mieter.name/)
  })
})
