import { extractText, getDocumentProxy } from 'unpdf'
import { describe, expect, it } from 'vitest'
import { briefPdf, steuerUebersichtBrief } from '../src'

describe('Steuer: Übersicht für den Steuerberater', () => {
  it('Einnahmen, Werbungskosten, Ergebnis, Aufteilung und Hinweise', async () => {
    const pdf = await briefPdf(
      steuerUebersichtBrief({
        mandant: 'Musterobjekt GbR',
        objekt: 'Musterobjekt',
        anschrift: ['Musterstraße 1', '99999 Musterstadt'],
        jahr: 2025,
        ausgestellt: '2026-03-01',
        einnahmen: [{ bezeichnung: 'Mieteinnahmen (Soll)', betragCent: 600_000 }],
        einnahmenCent: 600_000,
        werbungskosten: [{ bezeichnung: 'Schuldzinsen', betragCent: 700_000 }],
        werbungskostenCent: 700_000,
        ueberschussCent: -100_000,
        verteilt: [
          { belegnummer: '2024-0003', jahrDerZahlung: 2024, jahre: 3, anteilCent: 10_000 },
        ],
        aufteilung: [
          {
            name: 'Erste Muster',
            einnahmenCent: 300_000,
            werbungskostenCent: 350_000,
            ueberschussCent: -50_000,
          },
          {
            name: 'Zweite Muster',
            einnahmenCent: 300_000,
            werbungskostenCent: 350_000,
            ueberschussCent: -50_000,
          },
        ],
        hinweise: ['Keine AfA: Stammdaten ergänzen.'],
        grundlagen: ['Ausgaben nach Zahlungstag (§ 11 EStG).'],
      }),
    )
    const { text } = await extractText(await getDocumentProxy(new Uint8Array(pdf)), {
      mergePages: true,
    })
    for (const t of [
      'Einkünfte aus Vermietung und Verpachtung 2025',
      'Summe Einnahmen',
      '6.000,00 €',
      'Verlust',
      '-1.000,00 €',
      'Beleg 2024-0003',
      'Zweite Muster',
      'Keine AfA',
      '§ 11 EStG',
    ])
      expect(text).toContain(t)
  })
})
