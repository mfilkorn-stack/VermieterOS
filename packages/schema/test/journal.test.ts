import { describe, expect, it } from 'vitest'
import { behandlung, gleichAufteilen, JournalEintragDaten } from '../src'

const O1 = '01890000-0000-7000-8000-000000000001'
const O2 = '01890000-0000-7000-8000-000000000002'

const wasser = {
  richtung: 'ausgabe',
  gegenpartei: 'Stadtwerke Musterstadt',
  zahlungsdatum: '2026-01-15',
  leistungVon: '2025-01-01',
  leistungBis: '2025-12-31',
  bruttoCent: 48_150,
  umsatzsteuerCent: 3_150,
  steuerkategorie: 'betriebskosten',
  kostenart: 'wasserversorgung',
  umlagefaehig: true,
  anteile: [{ objektId: O1, betragCent: 48_150 }],
}

function fehler(d: unknown): string[] {
  const r = JournalEintragDaten.safeParse(d)
  return r.success ? [] : r.error.issues.map((i) => i.message)
}

describe('JournalEintragDaten', () => {
  it('nimmt eine umlagefähige Wasserrechnung mit zwei Datumsangaben an', () => {
    expect(fehler(wasser)).toEqual([])
  })

  it('verlangt, dass die Anteile den Bruttobetrag ergeben', () => {
    expect(
      fehler({
        ...wasser,
        anteile: [
          { objektId: O1, betragCent: 24_000 },
          { objektId: O2, betragCent: 24_000 },
        ],
      }),
    ).toContain('Die Anteile müssen zusammen den Bruttobetrag ergeben')
  })

  it('lehnt doppelte Objekte in der Aufteilung ab', () => {
    expect(
      fehler({
        ...wasser,
        anteile: [
          { objektId: O1, betragCent: 24_075 },
          { objektId: O1, betragCent: 24_075 },
        ],
      }),
    ).toContain('Ein Objekt ist doppelt aufgeteilt')
  })

  it('umlagefähig nur mit Kostenart und Leistungszeitraum', () => {
    const f = fehler({ ...wasser, kostenart: null, leistungVon: null, leistungBis: null })
    expect(f).toContain('Umlagefähige Kosten brauchen eine Kostenart')
    expect(f).toContain('Umlagefähige Kosten brauchen den Leistungszeitraum')
  })

  it('Kategorie muss zur Richtung passen', () => {
    expect(fehler({ ...wasser, richtung: 'einnahme' })).toContain(
      'Kategorie passt nicht zu Einnahme oder Ausgabe',
    )
  })

  it('verteilen nur bei Erhaltungsaufwand', () => {
    expect(fehler({ ...wasser, verteilungJahre: 3 })).toContain(
      'Verteilen lässt sich nur Erhaltungsaufwand',
    )
    expect(
      fehler({
        ...wasser,
        steuerkategorie: 'erhaltungsaufwand',
        kostenart: null,
        umlagefaehig: false,
        verteilungJahre: 3,
      }),
    ).toEqual([])
  })

  it('Leistungszeitraum vollständig und in der richtigen Reihenfolge', () => {
    expect(fehler({ ...wasser, umlagefaehig: false, leistungBis: null })).toContain(
      'Leistungszeitraum: von und bis angeben',
    )
    expect(fehler({ ...wasser, leistungVon: '2026-01-01' })).toContain(
      'Leistungszeitraum endet vor dem Beginn',
    )
  })
})

describe('behandlung', () => {
  it('leitet die steuerliche Behandlung aus Kategorie und Verteilung ab', () => {
    expect(behandlung('mieteinnahmen')).toBe('einnahme')
    expect(behandlung('erhaltungsaufwand')).toBe('sofort')
    expect(behandlung('erhaltungsaufwand', 4)).toBe('verteilt')
    expect(behandlung('herstellungskosten')).toBe('afa')
    expect(behandlung('nicht_abziehbar')).toBe('privat')
  })
})

describe('gleichAufteilen', () => {
  it('verteilt Rest-Cent so, dass die Summe stimmt', () => {
    expect(gleichAufteilen(10_000, 3)).toEqual([3_334, 3_333, 3_333])
    expect(gleichAufteilen(10_000, 3).reduce((a, b) => a + b)).toBe(10_000)
  })
})
