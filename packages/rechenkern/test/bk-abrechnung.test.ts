import type { BkAbrechnungDaten, BkPosition } from '@vermieteros/schema'
import { describe, expect, it } from 'vitest'
import { abrechnungsfrist, fristStatus, pruefeBkAbrechnung, rechneBkAbrechnung } from '../src/index'

/** Sollwert 2024 (nur Beträge): WEG-Einzelabrechnung, Messdienst, Grundsteuer wie 2022. */
const FL = { art: 'wohnflaeche', gesamtQm100: 67_179 } as const
const pos = (
  kostenart: BkPosition['kostenart'],
  bezeichnung: string,
  gesamtCent: number,
  schluessel: BkPosition['schluessel'] = FL,
): BkPosition => ({ kostenart, bezeichnung, gesamtCent, schluessel })

const DATEN_2024: BkAbrechnungDaten = {
  zeitraumVon: '2024-01-01',
  zeitraumBis: '2024-12-31',
  status: 'entwurf',
  positionen: [
    pos('grundsteuer', 'Grundsteuer', 17_714, { art: 'direkt', einheitCent: 17_714 }),
    pos('entwaesserung', 'Niederschlagswasser', 23_105),
    pos('strassenreinigung_muell', 'Restmüll', 73_200),
    pos('antenne_kabel', 'Kabelgebühr', 65_102, { art: 'einheiten', anzahl: 12 }),
    pos('beleuchtung', 'Strom allgemein', 72_648),
    pos('versicherung', 'Gebäudeversicherung', 213_446),
    pos('gebaeudereinigung', 'Hausreinigung', 250_839),
    pos('strassenreinigung_muell', 'Winterdienst', 74_197),
    pos('strassenreinigung_muell', 'Straßenreinigung', 16_384),
  ],
  messdienst: {
    gesamtCent: 1_121_592,
    einheitCent: 145_510,
    co2: {
      kostenCent: 71_526,
      kg: 15_900,
      flaecheQm100: 64_359,
      tage: 366,
      heizWwEinheitCent: 119_091,
      heizWwGesamtCent: 772_136,
      vermieterLautMessdienstCent: 3_310,
    },
    lohnanteil35aCent: 11_224,
  },
}
const MIETER = {
  mietverhaeltnisId: '0190a000-0000-7000-8000-000000000001',
  von: '2024-01-01',
  bis: '2024-12-31',
  personen: 2,
  vorauszahlungen: [
    { ab: '2022-02-01', monatCent: 14_600 },
    { ab: '2023-12-01', monatCent: 18_900 },
  ],
}

describe('Betriebskostenabrechnung 2024 aus gespeicherten Daten', () => {
  const e = rechneBkAbrechnung({
    daten: DATEN_2024,
    einheit: { wohnflaecheQm100: 5_972 },
    mietzeiten: [MIETER],
    heute: '2025-11-20',
  })
  const m = e.abrechnung.mieter[0]!

  it('Kosten 2.296,84 €, Vorauszahlung 12 × 189 €, Nachzahlung 28,84 €', () => {
    expect(m.kostenCent).toBe(229_684)
    expect(e.vorauszahlungen[MIETER.mietverhaeltnisId]).toEqual({
      sollCent: 226_800,
      angerechnetCent: 226_800,
    })
    expect(m.saldoCent).toBe(2_884)
    expect(m.lohnanteil35aCent).toBe(11_224)
    expect(m.zeilen[1]!.bezeichnung).toMatch(/CO2/)
    expect(m.zeilen[1]!.anteilCent).toBe(-3_310)
  })

  it('erfasste Ist-Vorauszahlungen gehen vor dem Soll', () => {
    const ist = rechneBkAbrechnung({
      daten: { ...DATEN_2024, vorauszahlungen: { [MIETER.mietverhaeltnisId]: 220_000 } },
      einheit: { wohnflaecheQm100: 5_972 },
      mietzeiten: [MIETER],
      heute: '2025-11-20',
    })
    expect(ist.abrechnung.mieter[0]!.saldoCent).toBe(229_684 - 220_000)
  })

  it('Frist naht: Warnung; Kabel-Hinweis aus dem Kern', () => {
    expect(e.fristBis).toBe('2025-12-31')
    expect(e.befunde.map((b) => b.code)).toEqual(['frist_naht'])
    expect(m.hinweise.map((h) => h.code)).toEqual(['kabel_nebenkostenprivileg'])
  })
})

describe('Prüfung der Abrechnung', () => {
  it('Abrechnungsfrist: zwölf Monate nach Ende des Zeitraums', () => {
    expect(abrechnungsfrist('2024-12-31')).toBe('2025-12-31')
    expect(abrechnungsfrist('2024-06-30')).toBe('2025-06-30')
    // Ablauf des zwölften Monats: im Schaltjahr der 29. Februar
    expect(abrechnungsfrist('2023-02-28')).toBe('2024-02-29')
  })

  it('abgelaufene Frist ist ein Fehler, festgeschrieben nicht mehr', () => {
    const r = pruefeBkAbrechnung({ daten: DATEN_2024, heute: '2026-01-02', mieter: 1 })
    expect(r.befunde[0]).toMatchObject({ schwere: 'fehler', code: 'frist_abgelaufen' })
    expect(
      pruefeBkAbrechnung({
        daten: { ...DATEN_2024, status: 'festgeschrieben' },
        heute: '2026-01-02',
        mieter: 1,
      }).befunde,
    ).toEqual([])
  })

  it('Vergleich mit dem Vorjahr: Sprünge, fehlende Positionen, Fläche', () => {
    const vorjahr: BkAbrechnungDaten = {
      ...DATEN_2024,
      zeitraumVon: '2023-01-01',
      zeitraumBis: '2023-12-31',
      positionen: [
        pos('beleuchtung', 'Strom allgemein', 385_406),
        pos('versicherung', 'Gebäudeversicherung', 200_000),
        pos('gartenpflege', 'Gartenpflege', 61_078),
        pos('gebaeudereinigung', 'Hausreinigung', 250_000, {
          art: 'wohnflaeche',
          gesamtQm100: 70_000,
        }),
      ],
    }
    const r = pruefeBkAbrechnung({ daten: DATEN_2024, vorjahr, heute: '2025-03-01', mieter: 1 })
    expect(r.befunde.map((b) => b.code)).toEqual([
      'abweichung_vorjahr',
      'fehlt_ggue_vorjahr',
      'gesamtflaeche_geaendert',
    ])
    expect(r.befunde[0]!.text).toMatch(/Strom allgemein: -81 %/)
  })

  it('fehlende Grundsteuer, Heizkosten, Mieter und Nullbeträge', () => {
    const r = pruefeBkAbrechnung({
      daten: {
        ...DATEN_2024,
        messdienst: null,
        positionen: [pos('versicherung', 'Versicherung', 0)],
      },
      heute: '2025-03-01',
      mieter: 0,
    })
    expect(r.befunde.map((b) => b.code)).toEqual([
      'keine_mieter',
      'grundsteuer_fehlt',
      'heizkosten_fehlen',
      'betrag_null',
    ])
  })
})

describe('Frist-Wächter', () => {
  const stufe = (heute: string, versendet = false) =>
    fristStatus('2024-12-31', heute, versendet).stufe
  it('Stufen über das Jahr nach dem Abrechnungszeitraum', () => {
    expect(stufe('2024-11-01')).toBe('laufend')
    expect(stufe('2025-01-02')).toBe('offen')
    expect(stufe('2025-09-30')).toBe('offen')
    expect(stufe('2025-10-01')).toBe('warnung')
    expect(stufe('2025-12-01')).toBe('eskalation')
    expect(stufe('2025-12-31')).toBe('eskalation')
    expect(stufe('2026-01-01')).toBe('abgelaufen')
    expect(stufe('2026-01-01', true)).toBe('erledigt')
  })
  it('Daten der Stufen', () => {
    expect(fristStatus('2024-12-31', '2025-01-01', false)).toMatchObject({
      fristBis: '2025-12-31',
      warnungAb: '2025-09-30',
      eskalationAb: '2025-11-30',
    })
    expect(fristStatus('2024-06-30', '2025-01-01', false).fristBis).toBe('2025-06-30')
  })
})
