import { describe, expect, it } from 'vitest'
import { pruefeDatenqualitaet, summeBrueche, type ObjektStand } from '../src/datenqualitaet'
import { etwMitStellplatz } from './faelle'

const HEUTE = '2026-10-06'

function haus(): ObjektStand {
  return {
    id: 'o1',
    objekt: {
      bezeichnung: 'Musterstraße 1',
      strasse: 'Musterstraße',
      hausnummer: '1',
      plz: '50667',
      ort: 'Köln',
      bundesland: 'NW',
      art: 'haus',
      baujahr: 1965,
      weg: false,
      grundbuch: [
        {
          art: 'grundbuch',
          amtsgericht: 'Köln',
          blatt: '1',
          flurstuecke: [{ nummer: 'Flst. 1', flaecheQm: 600 }],
        },
      ],
      kaufvertragDatum: '2020-01-15',
      anschaffungsdatum: '2020-03-01',
      kaufpreisCent: 45_000_000,
      anschaffungsnebenkosten: [{ art: 'grunderwerbsteuer', betragCent: 2_925_000 }],
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
    eigentum: { mandantId: 'm', art: 'allein', anteile: [] },
    referenz: { grunderwerbsteuer: { status: 'gueltig', satzPromille: 65, quelle: 'Seed' } },
  }
}

const codes = (o: ObjektStand) =>
  pruefeDatenqualitaet(o, HEUTE)
    .befunde.map((b) => b.code)
    .sort()

describe('pruefeDatenqualitaet: Haus', () => {
  it('ein vollständiges Haus ist überall grün', () => {
    const r = pruefeDatenqualitaet(haus(), HEUTE)
    expect(r.befunde).toEqual([])
    expect(Object.values(r.ampel)).toEqual(['gruen', 'gruen', 'gruen', 'gruen', 'gruen'])
    expect(r.vollstaendig).toBe(true)
  })

  it('fehlende Wohnfläche sperrt Nebenkosten, nicht das Steuerpaket', () => {
    const o = haus()
    o.einheiten[1]!.daten.wohnflaecheQm100 = null
    const r = pruefeDatenqualitaet(o, HEUTE)
    expect(r.ampel.nebenkosten).toBe('rot')
    expect(r.ampel.steuerpaket).toBe('gruen')
    expect(r.befunde.map((b) => b.code)).toEqual(['EINHEIT_WOHNFLAECHE'])
    expect(r.befunde[0]).toMatchObject({ entitaet: 'einheit', id: 'e2' })
  })

  it('fehlende AfA-Daten sperren das Steuerpaket', () => {
    const o = haus()
    o.objekt.afaBeginn = null
    o.objekt.gebaeudeanteilPromille = null
    expect(codes(o)).toEqual(['OBJ_AFA', 'OBJ_GEBAEUDEANTEIL'])
    expect(pruefeDatenqualitaet(o, HEUTE).ampel.steuerpaket).toBe('rot')
  })

  it('AfA-Beginn vor Übergang ist ein Fehler, niedriger Gebäudeanteil nur eine Warnung', () => {
    const o = haus()
    o.objekt.afaBeginn = '2019-01-01'
    o.objekt.gebaeudeanteilPromille = 400
    expect(codes(o)).toEqual(['OBJ_AFA_VOR_ANSCHAFFUNG', 'OBJ_GEBAEUDEANTEIL_NIEDRIG'])
  })

  it('AfA-Satz wird gegen das Baujahr geprüft', () => {
    const o = haus()
    o.objekt.afaSatzPromille = 25 // 2,5 % gilt nur vor 1925
    expect(codes(o)).toEqual(['OBJ_AFA_SATZ'])
    o.objekt.baujahr = null
    o.objekt.afaSatzPromille = 20
    expect(codes(o)).toEqual(['OBJ_BAUJAHR'])
  })

  it('Übergang vor Kaufvertrag ist unmöglich, fehlendes Vertragsdatum eine Warnung', () => {
    const o = haus()
    o.objekt.anschaffungsdatum = '2019-12-01'
    o.objekt.afaBeginn = '2019-12-01'
    expect(codes(o)).toEqual(['OBJ_UEBERGANG_VOR_VERTRAG'])
    o.objekt.kaufvertragDatum = null
    expect(codes(o)).toEqual(['OBJ_KAUFVERTRAG'])
  })

  it('Kauf-Nebenkosten: ohne Positionen und ohne Grunderwerbsteuer jeweils eine Warnung', () => {
    const o = haus()
    o.objekt.anschaffungsnebenkosten = []
    expect(codes(o)).toEqual(['OBJ_NEBENKOSTEN'])
    o.objekt.anschaffungsnebenkosten = [{ art: 'notar_kaufvertrag', betragCent: 100_000 }]
    expect(codes(o)).toEqual(['OBJ_GREST'])
  })

  it('Mietverhältnis ohne Kondition sperrt Nebenkosten und Mieterhöhung', () => {
    const o = haus()
    o.einheiten[0]!.mietverhaeltnisse[0]!.kondition = null
    const r = pruefeDatenqualitaet(o, HEUTE)
    expect(r.ampel.nebenkosten).toBe('rot')
    expect(r.ampel.mieterhoehung).toBe('rot')
    expect(codes(o)).toEqual(['MV_OHNE_KONDITION', 'MV_OHNE_MIETHISTORIE'])
  })

  it('Miteigentumsanteile im eigenen Haus müssen vollständig sein und sich zu 1 summieren', () => {
    const o = haus()
    o.einheiten[0]!.daten.miteigentumsanteilZaehler = 550
    o.einheiten[0]!.daten.miteigentumsanteilNenner = 1000
    expect(codes(o)).toEqual(['MEA_UNVOLLSTAENDIG'])
    o.einheiten[1]!.daten.miteigentumsanteilZaehler = 400
    o.einheiten[1]!.daten.miteigentumsanteilNenner = 1000
    expect(codes(o)).toEqual(['MEA_SUMME'])
    o.einheiten[1]!.daten.miteigentumsanteilZaehler = 450
    expect(codes(o)).toEqual([])
  })

  it('Darlehen ohne Zinsbindung und Restschuld sind Warnungen, Rate 0 ein Fehler', () => {
    const o = haus()
    o.darlehen[0]!.daten.zinsbindungBis = null
    o.darlehen[0]!.daten.restschuldCent = null
    expect(pruefeDatenqualitaet(o, HEUTE).ampel.finanzen).toBe('gelb')
    o.darlehen[0]!.daten.rateCent = 0
    expect(pruefeDatenqualitaet(o, HEUTE).ampel.finanzen).toBe('rot')
  })

  it('beendete Mietverhältnisse lösen keine Personenzahl-Warnung aus', () => {
    const o = haus()
    const mv = o.einheiten[0]!.mietverhaeltnisse[0]!
    mv.kondition!.personenzahl = 0
    expect(codes(o)).toEqual(['KONDITION_PERSONENZAHL'])
    mv.daten.ende = '2025-12-31'
    expect(codes(o)).toEqual([])
  })
})

describe('pruefeDatenqualitaet: ETW mit separatem Stellplatz (Struktur aus echtem Kaufvertrag)', () => {
  it('ist vollständig grün, ohne Fehlalarm für Stellplatz und MEA', () => {
    const r = pruefeDatenqualitaet(etwMitStellplatz(), HEUTE)
    expect(r.befunde).toEqual([])
    expect(r.vollstaendig).toBe(true)
  })

  it('Stellplatz braucht keine Wohnfläche und keinen Miteigentumsanteil', () => {
    const o = etwMitStellplatz()
    const stellplatz = o.einheiten.find((e) => e.daten.typ === 'stellplatz')!
    expect(stellplatz.daten.wohnflaecheQm100).toBeUndefined()
    expect(stellplatz.daten.miteigentumsanteilZaehler).toBeUndefined()
    expect(codes(o)).not.toContain('EINHEIT_WOHNFLAECHE')
    expect(codes(o)).not.toContain('MEA_UNVOLLSTAENDIG')
  })

  it('Wohnung der ETW ohne MEA ist eine Warnung, ohne Wohnungsgrundbuch ebenso', () => {
    const o = etwMitStellplatz()
    const wohnung = o.einheiten.find((e) => e.daten.typ === 'wohnung')!
    wohnung.daten.miteigentumsanteilZaehler = null
    wohnung.daten.miteigentumsanteilNenner = null
    expect(codes(o)).toEqual(['ETW_MEA'])
    o.objekt.grundbuch = o.objekt.grundbuch!.filter((g) => g.art !== 'wohnungsgrundbuch')
    expect(codes(o)).toEqual(['ETW_MEA', 'ETW_OHNE_WOHNUNGSGRUNDBUCH'])
  })

  it('Bruchteilseigentum braucht Anteile, die sich zu 1 summieren', () => {
    const o = etwMitStellplatz()
    o.eigentum!.anteile = [{ zaehler: 1, nenner: 2 }]
    expect(codes(o)).toEqual(['EIGENTUM_ANTEILE'])
    expect(pruefeDatenqualitaet(o, HEUTE).ampel.steuerpaket).toBe('rot')
    o.eigentum!.anteile = [
      { zaehler: 1, nenner: 2 },
      { zaehler: 1, nenner: 3 },
    ]
    expect(codes(o)).toEqual(['EIGENTUM_SUMME'])
    expect(pruefeDatenqualitaet(o, HEUTE).befunde[0]).toMatchObject({
      entitaet: 'mandant',
      id: 'mandant-1',
    })
  })

  it('Alleineigentum mit mehreren Anteilen ist eine Warnung', () => {
    const o = etwMitStellplatz()
    o.eigentum!.art = 'allein'
    expect(codes(o)).toEqual(['EIGENTUM_ALLEIN_MEHRERE'])
  })
})

describe('pruefeDatenqualitaet: Referenzdaten', () => {
  it('fehlendes Bundesland ist eine Warnung in den Stammdaten', () => {
    const o = haus()
    o.objekt.bundesland = null
    expect(codes(o)).toEqual(['OBJ_BUNDESLAND'])
  })

  it('Status des Grunderwerbsteuersatzes wird gemeldet, nicht still verwendet', () => {
    const o = haus()
    o.referenz = { grunderwerbsteuer: { status: 'fehlt', satzPromille: null, quelle: null } }
    expect(codes(o)).toEqual(['REF_GREST_FEHLT'])
    o.referenz = { grunderwerbsteuer: { status: 'abgelaufen', satzPromille: 50, quelle: 'x' } }
    expect(codes(o)).toEqual(['REF_GREST_ABGELAUFEN'])
    o.referenz = { grunderwerbsteuer: { status: 'ungeprueft', satzPromille: 65, quelle: 'x' } }
    expect(codes(o)).toEqual(['REF_GREST_UNGEPRUEFT'])
  })

  it('erfasste Grunderwerbsteuer wird gegen den Satz geprüft', () => {
    const o = haus()
    // 450.000 € × 6,5 % = 29.250 € → passt
    expect(codes(o)).toEqual([])
    o.objekt.anschaffungsnebenkosten = [{ art: 'grunderwerbsteuer', betragCent: 2_800_000 }]
    expect(codes(o)).toEqual(['OBJ_GREST_ABWEICHUNG'])
    expect(pruefeDatenqualitaet(o, HEUTE).befunde[0]!.text).toContain('29.250,00 €')
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
        [1, 4],
        [1, 4],
      ]),
    ).toEqual({ zaehler: 1, nenner: 2 })
    expect(() => summeBrueche([[1, 0]])).toThrow()
  })
})
