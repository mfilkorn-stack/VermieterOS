import { describe, expect, it } from 'vitest'
import { pruefeDatenqualitaet, summeBrueche, type ObjektStand } from '../src/datenqualitaet'

const HEUTE = '2026-10-06'

function vollstaendigesObjekt(): ObjektStand {
  return {
    id: 'o1',
    objekt: {
      bezeichnung: 'Musterstraße 1',
      strasse: 'Musterstraße',
      hausnummer: '1',
      plz: '50667',
      ort: 'Köln',
      art: 'haus',
      weg: false,
      anschaffungsdatum: '2020-03-01',
      kaufpreisCent: 45_000_000,
      anschaffungsnebenkostenCent: 4_500_000,
      gebaeudeanteilPromille: 750,
      afaSatzPromille: 20,
      afaBeginn: '2020-03-01',
    },
    einheiten: [
      {
        id: 'e1',
        daten: { bezeichnung: 'EG', typ: 'wohnung', wohnflaecheQm100: 7250 },
        mietverhaeltnisse: [
          {
            id: 'm1',
            daten: {
              beginn: '2024-04-01',
              kuendigungsfristMonate: 3,
              kautionArt: 'bar',
              mieterIds: ['p1'],
            },
            kondition: {
              gueltigAb: '2024-04-01',
              kaltmieteCent: 85000,
              vorauszahlungBkCent: 18000,
              vorauszahlungHkCent: 9000,
              mietart: 'vergleich',
              personenzahl: 2,
              grund: 'vertrag',
            },
          },
        ],
      },
      {
        id: 'e2',
        daten: { bezeichnung: 'OG', typ: 'wohnung', wohnflaecheQm100: 6000 },
        mietverhaeltnisse: [],
      },
    ],
    darlehen: [
      {
        id: 'd1',
        daten: {
          bank: 'Sparkasse',
          nominalCent: 25_000_000,
          zinsBp: 145,
          rateCent: 71_875,
          zinsbindungBis: '2030-02-28',
          restschuldCent: 21_000_000,
          restschuldStand: '2025-12-31',
        },
      },
    ],
  }
}

describe('pruefeDatenqualitaet', () => {
  it('ein vollständiges Objekt ist überall grün', () => {
    const r = pruefeDatenqualitaet(vollstaendigesObjekt(), HEUTE)
    expect(r.befunde).toEqual([])
    expect(r.ampel).toEqual({
      stammdaten: 'gruen',
      nebenkosten: 'gruen',
      steuerpaket: 'gruen',
      mieterhoehung: 'gruen',
      finanzen: 'gruen',
    })
    expect(r.vollstaendig).toBe(true)
  })

  it('fehlende Wohnfläche sperrt Nebenkosten, nicht das Steuerpaket', () => {
    const o = vollstaendigesObjekt()
    o.einheiten[1]!.daten.wohnflaecheQm100 = null
    const r = pruefeDatenqualitaet(o, HEUTE)
    expect(r.ampel.nebenkosten).toBe('rot')
    expect(r.ampel.steuerpaket).toBe('gruen')
    expect(r.befunde.map((b) => b.code)).toEqual(['EINHEIT_WOHNFLAECHE'])
    expect(r.befunde[0]).toMatchObject({ entitaet: 'einheit', id: 'e2' })
    expect(r.vollstaendig).toBe(false)
  })

  it('fehlende AfA-Daten sperren das Steuerpaket', () => {
    const o = vollstaendigesObjekt()
    o.objekt.afaBeginn = null
    o.objekt.gebaeudeanteilPromille = null
    const r = pruefeDatenqualitaet(o, HEUTE)
    expect(r.ampel.steuerpaket).toBe('rot')
    expect(r.befunde.map((b) => b.code).sort()).toEqual(['OBJ_AFA', 'OBJ_GEBAEUDEANTEIL'])
  })

  it('AfA-Beginn vor Anschaffung ist ein Fehler, niedriger Gebäudeanteil nur eine Warnung', () => {
    const o = vollstaendigesObjekt()
    o.objekt.afaBeginn = '2019-01-01'
    o.objekt.gebaeudeanteilPromille = 400
    const r = pruefeDatenqualitaet(o, HEUTE)
    expect(r.befunde.map((b) => `${b.schwere}:${b.code}`).sort()).toEqual([
      'fehler:OBJ_AFA_VOR_ANSCHAFFUNG',
      'warnung:OBJ_GEBAEUDEANTEIL_NIEDRIG',
    ])
  })

  it('Mietverhältnis ohne Kondition sperrt Nebenkosten und Mieterhöhung', () => {
    const o = vollstaendigesObjekt()
    o.einheiten[0]!.mietverhaeltnisse[0]!.kondition = null
    const r = pruefeDatenqualitaet(o, HEUTE)
    expect(r.ampel.nebenkosten).toBe('rot')
    expect(r.ampel.mieterhoehung).toBe('rot')
    expect(r.befunde.map((b) => b.code).sort()).toEqual([
      'MV_OHNE_KONDITION',
      'MV_OHNE_MIETHISTORIE',
    ])
  })

  it('Miteigentumsanteile müssen vollständig sein und sich zu 1 summieren', () => {
    const o = vollstaendigesObjekt()
    o.einheiten[0]!.daten.miteigentumsanteilZaehler = 550
    o.einheiten[0]!.daten.miteigentumsanteilNenner = 1000
    expect(pruefeDatenqualitaet(o, HEUTE).befunde.map((b) => b.code)).toEqual([
      'MEA_UNVOLLSTAENDIG',
    ])

    o.einheiten[1]!.daten.miteigentumsanteilZaehler = 400
    o.einheiten[1]!.daten.miteigentumsanteilNenner = 1000
    expect(pruefeDatenqualitaet(o, HEUTE).befunde.map((b) => b.code)).toEqual(['MEA_SUMME'])

    o.einheiten[1]!.daten.miteigentumsanteilZaehler = 450
    expect(pruefeDatenqualitaet(o, HEUTE).befunde).toEqual([])

    // Unterschiedliche Nenner: 1/2 + 5000/10000 = 1
    o.einheiten[0]!.daten.miteigentumsanteilZaehler = 1
    o.einheiten[0]!.daten.miteigentumsanteilNenner = 2
    o.einheiten[1]!.daten.miteigentumsanteilZaehler = 5000
    o.einheiten[1]!.daten.miteigentumsanteilNenner = 10000
    expect(pruefeDatenqualitaet(o, HEUTE).befunde).toEqual([])
  })

  it('Darlehen ohne Zinsbindung und Restschuld sind Warnungen, Rate 0 ein Fehler', () => {
    const o = vollstaendigesObjekt()
    o.darlehen[0]!.daten.zinsbindungBis = null
    o.darlehen[0]!.daten.restschuldCent = null
    const r1 = pruefeDatenqualitaet(o, HEUTE)
    expect(r1.ampel.finanzen).toBe('gelb')
    o.darlehen[0]!.daten.rateCent = 0
    expect(pruefeDatenqualitaet(o, HEUTE).ampel.finanzen).toBe('rot')
  })

  it('beendete Mietverhältnisse lösen keine Personenzahl-Warnung aus', () => {
    const o = vollstaendigesObjekt()
    const mv = o.einheiten[0]!.mietverhaeltnisse[0]!
    mv.kondition!.personenzahl = 0
    expect(pruefeDatenqualitaet(o, HEUTE).befunde.map((b) => b.code)).toEqual([
      'KONDITION_PERSONENZAHL',
    ])
    mv.daten.ende = '2025-12-31'
    expect(pruefeDatenqualitaet(o, HEUTE).befunde).toEqual([])
  })
})

describe('summeBrueche', () => {
  it('summiert und kürzt', () => {
    expect(
      summeBrueche([
        [1, 2],
        [1, 3],
        [1, 6],
      ]),
    ).toEqual({ zaehler: 1, nenner: 1 })
    expect(
      summeBrueche([
        [1230, 10000],
        [8770, 10000],
      ]),
    ).toEqual({ zaehler: 1, nenner: 1 })
    expect(
      summeBrueche([
        [1, 4],
        [1, 4],
      ]),
    ).toEqual({ zaehler: 1, nenner: 2 })
    expect(() => summeBrueche([[1, 0]])).toThrow()
  })
})
