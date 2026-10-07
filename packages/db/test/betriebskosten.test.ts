import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  bkAbrechnungZuJahr,
  bkNutzungen,
  ladeBkAbrechnung,
  listeBkAbrechnungen,
} from '../src/betriebskosten'
import { neueVersion, storniereVersion } from '../src/ledger'
import { withMandant } from '../src/mandant'
import { NUTZER, erwarteFehler, neuerMandant, verbindungen } from './helfer'

const v = verbindungen()
afterAll(() => v.close())

let a: string
let b: string
let einheit: string
let mvAlt: string
let mvNeu: string

const DATEN = {
  zeitraumVon: '2024-01-01',
  zeitraumBis: '2024-12-31',
  positionen: [
    {
      kostenart: 'grundsteuer' as const,
      bezeichnung: 'Grundsteuer',
      gesamtCent: 17_714,
      schluessel: { art: 'direkt' as const, einheitCent: 17_714 },
    },
  ],
  status: 'entwurf' as const,
}

beforeAll(async () => {
  a = await neuerMandant(v.app, 'BK A')
  b = await neuerMandant(v.app, 'BK B')
  await withMandant(v.app, a, async (tx) => {
    const neu = (entitaet: string, identitaet: object, daten: object, gueltigAb = '2020-01-01') =>
      neueVersion(tx, {
        entitaet,
        mandantId: a,
        akteur: NUTZER,
        gueltigAb,
        identitaet,
        daten,
      } as never)
    const o = await neu('objekt', {}, { bezeichnung: 'Haus', art: 'etw' })
    einheit = (
      await neu('einheit', { objektId: o.identId }, { bezeichnung: 'EG', wohnflaecheQm100: 5_972 })
    ).identId
    const p1 = await neu('person', {}, { rolle: 'mieter', nachname: 'Alt' })
    const p2 = await neu('person', {}, { rolle: 'mieter', vorname: 'Neu', nachname: 'Mieter' })
    mvAlt = (
      await neu(
        'mietverhaeltnis',
        { einheitId: einheit },
        {
          beginn: '2019-01-01',
          ende: '2024-05-31',
          mieterIds: [p1.identId],
        },
      )
    ).identId
    mvNeu = (
      await neu(
        'mietverhaeltnis',
        { einheitId: einheit },
        { beginn: '2024-07-01', mieterIds: [p2.identId] },
      )
    ).identId
    await neu(
      'mietkondition',
      { mietverhaeltnisId: mvAlt },
      {
        kaltmieteCent: 60_000,
        vorauszahlungBkCent: 12_000,
        vorauszahlungHkCent: 3_000,
        personenzahl: 1,
      },
      '2019-01-01',
    )
    const k = await neu(
      'mietkondition',
      { mietverhaeltnisId: mvNeu },
      {
        kaltmieteCent: 65_000,
        vorauszahlungBkCent: 14_600,
        personenzahl: 2,
      },
      '2024-07-01',
    )
    await neueVersion(tx, {
      entitaet: 'mietkondition',
      mandantId: a,
      akteur: NUTZER,
      gueltigAb: '2024-12-01',
      identId: k.identId,
      begruendung: 'Anpassung Vorauszahlung',
      daten: { kaltmieteCent: 65_000, vorauszahlungBkCent: 18_900, personenzahl: 2 },
    } as never)
  })
})

describe('Betriebskostenabrechnung: Datenhaltung', () => {
  it('Mietverhältnisse im Zeitraum mit Vorauszahlungsstufen', async () => {
    const n = await withMandant(v.app, a, (tx) =>
      bkNutzungen(tx, einheit, '2024-01-01', '2024-12-31'),
    )
    expect(n.map((x) => [x.mieter, x.von, x.bis, x.personen])).toEqual([
      [['Alt'], '2024-01-01', '2024-05-31', 1],
      [['Neu Mieter'], '2024-07-01', '2024-12-31', 2],
    ])
    expect(n[1]!.vorauszahlungen).toEqual([
      { ab: '2024-07-01', monatCent: 14_600 },
      { ab: '2024-12-01', monatCent: 18_900 },
    ])
    expect(n[0]!.vorauszahlungen).toEqual([{ ab: '2019-01-01', monatCent: 15_000 }])
  })

  it('eine Abrechnung je Einheit und Jahr, versioniert, nach Festschreibung gesperrt', async () => {
    const id = await withMandant(v.app, a, async (tx) => {
      const r = await neueVersion(tx, {
        entitaet: 'bk_abrechnung',
        mandantId: a,
        akteur: NUTZER,
        gueltigAb: '2025-03-01',
        identitaet: { einheitId: einheit, jahr: 2024 },
        daten: DATEN,
      })
      return r.identId
    })
    await erwarteFehler(
      () =>
        withMandant(v.app, a, (tx) =>
          neueVersion(tx, {
            entitaet: 'bk_abrechnung',
            mandantId: a,
            akteur: NUTZER,
            gueltigAb: '2025-03-01',
            identitaet: { einheitId: einheit, jahr: 2024 },
            daten: DATEN,
          }),
        ),
      /bk_abrechnungen_einheit_jahr_uq|duplicate key/,
    )
    const fest = await withMandant(v.app, a, (tx) =>
      neueVersion(tx, {
        entitaet: 'bk_abrechnung',
        mandantId: a,
        akteur: NUTZER,
        gueltigAb: '2025-03-02',
        identId: id,
        begruendung: 'Festschreibung',
        daten: { ...DATEN, status: 'festgeschrieben' },
      }),
    )
    const neuerEntwurf = () =>
      withMandant(v.app, a, (tx) =>
        neueVersion(tx, {
          entitaet: 'bk_abrechnung',
          mandantId: a,
          akteur: NUTZER,
          gueltigAb: '2025-03-03',
          identId: id,
          begruendung: 'Korrektur',
          daten: DATEN,
        }),
      )
    await erwarteFehler(neuerEntwurf, /festgeschrieben/)
    const liste = await withMandant(v.app, a, (tx) => listeBkAbrechnungen(tx, einheit))
    expect(liste.map((x) => [x.jahr, x.status])).toEqual([[2024, 'festgeschrieben']])

    // Korrektur: Festschreibung stornieren, danach ist wieder der Entwurf maßgeblich.
    await withMandant(v.app, a, (tx) =>
      storniereVersion(tx, {
        entitaet: 'bk_abrechnung',
        mandantId: a,
        versionId: fest.versionId,
        akteur: NUTZER,
        grund: 'Grundsteuerbescheid geändert',
      }),
    )
    await neuerEntwurf()
    const geladen = await withMandant(v.app, a, (tx) => ladeBkAbrechnung(tx, id))
    expect(geladen!.version.status).toBe('entwurf')
    expect(geladen!.jahr).toBe(2024)
    expect(await withMandant(v.app, a, (tx) => bkAbrechnungZuJahr(tx, einheit, 2024))).toBe(id)
  })

  it('Zeitraum höchstens zwölf Monate; Mandanten getrennt', async () => {
    await erwarteFehler(
      () =>
        withMandant(v.app, a, (tx) =>
          neueVersion(tx, {
            entitaet: 'bk_abrechnung',
            mandantId: a,
            akteur: NUTZER,
            gueltigAb: '2025-03-01',
            identitaet: { einheitId: einheit, jahr: 2023 },
            daten: { ...DATEN, zeitraumVon: '2023-01-01', zeitraumBis: '2024-01-01' },
          }),
        ),
      /bk_abrechnung_zeitraum_chk/,
    )
    expect(await withMandant(v.app, b, (tx) => listeBkAbrechnungen(tx, einheit))).toEqual([])
    await erwarteFehler(
      () =>
        withMandant(v.app, b, (tx) =>
          neueVersion(tx, {
            entitaet: 'bk_abrechnung',
            mandantId: b,
            akteur: NUTZER,
            gueltigAb: '2025-03-01',
            identitaet: { einheitId: einheit, jahr: 2022 },
            daten: DATEN,
          }),
        ),
      /gehört nicht zum Mandanten/,
    )
  })
})
