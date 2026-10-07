import { describe, expect, it } from 'vitest'
import { jahresabschluss, type AbschlussEingabe } from '../src/index'

const VOLL: AbschlussEingabe = {
  jahr: 2025,
  heute: '2026-05-10',
  weg: true,
  belegeOffen: 0,
  buchungen: 14,
  letzteBuchung: '2025-12-20',
  bk: [{ einheit: 'EG', status: 'festgeschrieben', versendet: true }],
  dokumente: [
    { typ: 'grundsteuer', datum: '2024-11-02', gueltigBis: null },
    { typ: 'hausgeldabrechnung', datum: '2026-04-15', gueltigBis: null },
    { typ: 'zinsbescheinigung', datum: '2026-01-12', gueltigBis: null },
  ],
  darlehen: true,
  steuerpaket: 'festgeschrieben',
}

const stand = (e: AbschlussEingabe) =>
  Object.fromEntries(jahresabschluss(e).punkte.map((p) => [p.code, p.stand]))

describe('Jahresabschluss', () => {
  it('alles beisammen: jeder Punkt erledigt', () => {
    const a = jahresabschluss(VOLL)
    expect(a.laufend).toBe(false)
    expect(a.punkte.map((p) => p.code)).toEqual([
      'belege',
      'buchungen',
      'grundsteuer',
      'hausgeld',
      'zinsen',
      'bk',
      'steuerpaket',
    ])
    expect(a.erledigt).toBe(7)
    expect(a.faellig).toBe(0)
  })

  it('Lücken nach Jahresende sind offen und benannt', () => {
    const a = jahresabschluss({
      ...VOLL,
      belegeOffen: 2,
      bk: [
        { einheit: 'EG', status: 'festgeschrieben', versendet: false },
        { einheit: 'OG', status: 'fehlt', versendet: false },
      ],
      dokumente: [{ typ: 'grundsteuer', datum: '2026-02-01', gueltigBis: null }],
      steuerpaket: 'entwurf',
    })
    expect(a.faellig).toBe(6)
    const t = Object.fromEntries(a.punkte.map((p) => [p.code, p.text]))
    expect(t['belege']).toBe('2 Belege sind noch nicht gebucht.')
    expect(t['bk']).toBe('EG: nicht versendet, OG: nicht angelegt.')
    // Bescheid erst 2026 ausgestellt: gilt nicht für 2025
    expect(t['grundsteuer']).toContain('Kein gültiger')
    expect(t['steuerpaket']).toContain('Entwurf')
  })

  it('Zinsbescheinigung und Hausgeldabrechnung zählen nur für ihr Jahr', () => {
    expect(
      stand({
        ...VOLL,
        dokumente: [
          ...VOLL.dokumente.filter((d) => d.typ === 'grundsteuer'),
          { typ: 'hausgeldabrechnung', datum: '2025-05-01', gueltigBis: null },
          { typ: 'zinsbescheinigung', datum: '2025-01-10', gueltigBis: null },
        ],
      }),
    ).toMatchObject({ hausgeld: 'offen', zinsen: 'offen' })
  })

  it('ohne WEG, ohne Darlehen, ohne Vermietung: Punkte entfallen', () => {
    const a = jahresabschluss({ ...VOLL, weg: false, darlehen: false, bk: [] })
    expect(a.punkte.map((p) => p.code)).not.toContain('hausgeld')
    expect(a.punkte.map((p) => p.code)).not.toContain('zinsen')
    expect(stand({ ...VOLL, bk: [] })['bk']).toBe('entfaellt')
  })

  it('Wächter im laufenden Jahr: was erst nach Jahresende kommt, ist „später“', () => {
    const a = jahresabschluss({
      ...VOLL,
      jahr: 2026,
      heute: '2026-10-07',
      buchungen: 3,
      letzteBuchung: '2026-06-01',
      bk: [{ einheit: 'EG', status: 'fehlt', versendet: false }],
      dokumente: [{ typ: 'grundsteuer', datum: '2024-11-02', gueltigBis: null }],
      steuerpaket: 'offen',
    })
    expect(a.laufend).toBe(true)
    expect(Object.fromEntries(a.punkte.map((p) => [p.code, p.stand]))).toEqual({
      belege: 'erledigt',
      buchungen: 'offen',
      grundsteuer: 'erledigt',
      hausgeld: 'spaeter',
      zinsen: 'spaeter',
      bk: 'spaeter',
      steuerpaket: 'spaeter',
    })
    expect(a.punkte.find((p) => p.code === 'buchungen')!.text).toBe(
      'Letzte Buchung am 01.06.2026, seit über 90 Tagen nichts.',
    )
    expect(a.faellig).toBe(1)
  })

  it('abgelaufener Grundsteuerbescheid zählt nicht', () => {
    expect(
      stand({
        ...VOLL,
        dokumente: [{ typ: 'grundsteuer', datum: '2019-01-01', gueltigBis: '2024-12-31' }],
      })['grundsteuer'],
    ).toBe('offen')
  })
})
