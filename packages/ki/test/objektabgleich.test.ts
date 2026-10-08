import { describe, expect, it } from 'vitest'
import { objekteImText } from '../src/objektabgleich'

const OBJEKTE = [
  { id: 'o1', bezeichnung: 'Musterweg 1', anschrift: 'Musterweg 1, 99999 Musterstadt' },
  { id: 'o2', bezeichnung: 'Haus am Markt', anschrift: 'Beispielstraße 7, 99999 Musterstadt' },
  { id: 'o3', bezeichnung: 'Ohne Anschrift', anschrift: null },
]

describe('objekteImText', () => {
  it('findet Straße und Hausnummer, auch als „Str.“ und ohne Komma', () => {
    expect(
      objekteImText(['Rechnung', 'Verbrauchsstelle: Musterweg 1 99999 Musterstadt'], OBJEKTE),
    ).toEqual([{ objektId: 'o1', seite: 2, treffer: 'Musterweg 1' }])
    expect(objekteImText(['Leistungsort Beispielstr. 7'], OBJEKTE).map((t) => t.objektId)).toEqual([
      'o2',
    ])
  })

  it('mehrere Objekte auf einem Beleg', () => {
    const t = objekteImText(['Musterweg 1 und Beispielstraße 7, je 50 %'], OBJEKTE)
    expect(t.map((x) => x.objektId)).toEqual(['o1', 'o2'])
  })

  it('keine Teiltreffer bei anderer Hausnummer', () => {
    expect(objekteImText(['Musterweg 10, 99999 Musterstadt'], OBJEKTE)).toEqual([])
    expect(objekteImText(['Musterweg 1a'], OBJEKTE)).toEqual([])
    expect(objekteImText(['Beispielstraße 77'], OBJEKTE)).toEqual([])
  })

  it('Scan ohne Text: nichts', () => {
    expect(objekteImText([], OBJEKTE)).toEqual([])
    expect(objekteImText(['  '], OBJEKTE)).toEqual([])
  })
})
