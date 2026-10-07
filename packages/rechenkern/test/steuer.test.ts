import { describe, expect, it } from 'vitest'
import { anlageV, sollImJahr, type SteuerEingabe } from '../src/index'

const j = (
  id: string,
  zahlungsdatum: string,
  steuerkategorie: string,
  betragCent: number,
  umsatzsteuerCent = 0,
  verteilungJahre: number | null = null,
) => ({
  id,
  belegnummer: `${zahlungsdatum.slice(0, 4)}-${id}`,
  zahlungsdatum,
  steuerkategorie,
  verteilungJahre,
  betragCent,
  umsatzsteuerCent,
})

/** Eigentumswohnung (Musterwerte aus den Sollwerten 2024), zwei Eigentümer je 1/2. */
const BASIS: SteuerEingabe = {
  jahr: 2024,
  mietzeiten: [
    {
      mietverhaeltnisId: 'mv',
      von: '2022-02-01',
      bis: '2099-12-31',
      stufen: [
        { ab: '2022-02-01', kaltCent: 65_000, vorauszahlungCent: 14_600 },
        { ab: '2023-12-01', kaltCent: 65_000, vorauszahlungCent: 18_900 },
      ],
    },
  ],
  bkSalden: [
    { mietverhaeltnisId: 'mv', jahr: 2024, saldoCent: 59_461 },
    { mietverhaeltnisId: 'mv', jahr: 2025, saldoCent: 2_884 },
  ],
  journal: [
    j('1', '2024-03-01', 'betriebskosten', 17_714),
    j('2', '2024-05-10', 'erhaltungsaufwand', 119_000, 19_000),
    j('3', '2023-06-01', 'erhaltungsaufwand', 300_000, 47_899, 3),
    j('4', '2024-02-01', 'mieteinnahmen', 65_000),
    j('5', '2024-12-31', 'schuldzinsen', 400_000),
    j('6', '2024-01-20', 'verwaltungskosten', 5_000),
  ],
  afa: { gebaeudeCent: 15_651_600, satzPromille: 20, beginn: '2022-02-01' },
  anschaffungsdatum: '2022-01-15',
  korrekturen: {
    hausgeld: { gezahltCent: 414_221, zufuehrungCent: 59_722, entnahmeCent: 7_111 },
    schuldzinsenCent: 412_300,
  },
  eigentuemer: [
    { personId: 'a', name: 'Eigentümer A', zaehler: 1, nenner: 2 },
    { personId: 'b', name: 'Eigentümer B', zaehler: 1, nenner: 2 },
  ],
}

describe('Anlage V: Einnahmen und Werbungskosten', () => {
  const r = anlageV(BASIS)
  const wert = (l: { bezeichnung: string; betragCent: number }[], start: string) =>
    l.find((z) => z.bezeichnung.startsWith(start))?.betragCent

  it('Sollmiete als bezahlt, Umlagen, BK-Saldo im Jahr des Zuflusses', () => {
    expect(wert(r.einnahmen, 'Mieteinnahmen')).toBe(12 * 65_000)
    expect(wert(r.einnahmen, 'Umlagen')).toBe(12 * 18_900)
    expect(wert(r.einnahmen, 'Nachzahlungen')).toBe(59_461)
    expect(r.einnahmenCent).toBe(780_000 + 226_800 + 59_461)
    expect(r.befunde.map((b) => b.code)).toContain('journal_mieten_ignoriert')
  })

  it('AfA, Zinsen laut Bescheinigung, Erhaltung sofort und verteilt, Hausgeld nach BFH', () => {
    expect(wert(r.werbungskosten, 'Absetzung')).toBe(313_032)
    expect(wert(r.werbungskosten, 'Schuldzinsen')).toBe(412_300)
    expect(wert(r.werbungskosten, 'Erhaltungsaufwand, sofort')).toBe(119_000)
    expect(r.verteilt).toEqual([
      { belegnummer: '2023-3', jahrDerZahlung: 2023, jahre: 3, anteilCent: 100_000 },
    ])
    expect(wert(r.werbungskosten, 'Hausgeld')).toBe(414_221 - 59_722 + 7_111)
    expect(wert(r.werbungskosten, 'Betriebskosten')).toBe(17_714)
    expect(wert(r.werbungskosten, 'Verwaltungskosten')).toBe(5_000)
    expect(r.werbungskostenCent).toBe(
      313_032 + 412_300 + 119_000 + 100_000 + 361_610 + 17_714 + 5_000,
    )
    expect(r.ueberschussCent).toBe(r.einnahmenCent - r.werbungskostenCent)
  })

  it('Aufteilung nach Miteigentum geht auf den Cent auf', () => {
    expect(r.aufteilung).toHaveLength(2)
    expect(r.aufteilung.reduce((s, a) => s + a.ueberschussCent, 0)).toBe(r.ueberschussCent)
    expect(
      Math.abs(r.aufteilung[0]!.einnahmenCent - r.aufteilung[1]!.einnahmenCent),
    ).toBeLessThanOrEqual(1)
  })

  it('15-%-Grenze: netto seit Anschaffung, Fehler bei Überschreitung', () => {
    expect(r.anschaffungsnah).toEqual({
      bisDatum: '2025-01-15',
      grenzeCent: 2_347_740,
      nettoCent: 100_000 + 252_101,
    })
    const viel = anlageV({
      ...BASIS,
      journal: [...BASIS.journal, j('7', '2024-08-01', 'erhaltungsaufwand', 2_500_000, 399_160)],
    })
    expect(viel.befunde.map((b) => b.code)).toContain('anschaffungsnah_ueberschritten')
    const spaet = anlageV({ ...BASIS, jahr: 2026 })
    expect(spaet.anschaffungsnah).toBeNull()
  })

  it('ohne AfA-Daten, ohne Eigentümer: Befunde statt Fehler', () => {
    const r2 = anlageV({ ...BASIS, afa: null, eigentuemer: [] })
    expect(r2.befunde.map((b) => b.code)).toEqual(
      expect.arrayContaining(['afa_fehlt', 'eigentuemer_fehlen']),
    )
    expect(r2.aufteilung).toEqual([])
  })

  it('nachträgliche Herstellungskosten erhöhen die AfA ab dem Zahlungsjahr', () => {
    const r3 = anlageV({
      ...BASIS,
      journal: [...BASIS.journal, j('8', '2024-09-01', 'herstellungskosten', 1_000_000)],
    })
    expect(wert(r3.werbungskosten, 'Absetzung')).toBe(313_032 + 20_000)
  })
})

describe('Sollmiete im Jahr', () => {
  it('Einzug im Februar, Erhöhung der Vorauszahlung im Dezember', () => {
    expect(sollImJahr(BASIS.mietzeiten[0]!, 2022)).toEqual({
      kaltCent: 715_000,
      umlagenCent: 160_600,
    })
    expect(sollImJahr(BASIS.mietzeiten[0]!, 2023)).toEqual({
      kaltCent: 780_000,
      umlagenCent: 11 * 14_600 + 18_900,
    })
    expect(sollImJahr(BASIS.mietzeiten[0]!, 2021)).toEqual({ kaltCent: 0, umlagenCent: 0 })
  })
})
