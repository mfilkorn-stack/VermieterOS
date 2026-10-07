import type { JournalEintragDaten } from '@vermieteros/schema'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { bucheJournal } from '../src/journal'
import { neueVersion, storniereVersion } from '../src/ledger'
import { withMandant } from '../src/mandant'
import {
  ladeSteuerpaket,
  listeSteuerpakete,
  steuerEigentuemer,
  steuerJournal,
  steuerMietzeiten,
} from '../src/steuer'
import { NUTZER, erwarteFehler, neuerMandant, verbindungen } from './helfer'

const v = verbindungen()
afterAll(() => v.close())

let a: string
let b: string
let haus: string
let anderes: string

beforeAll(async () => {
  a = await neuerMandant(v.app, 'Steuer A')
  b = await neuerMandant(v.app, 'Steuer B')
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
    haus = (await neu('objekt', {}, { bezeichnung: 'Haus', art: 'etw' })).identId
    anderes = (await neu('objekt', {}, { bezeichnung: 'Anderes', art: 'etw' })).identId
    const e = await neu('einheit', { objektId: haus }, { bezeichnung: 'EG' })
    const p = await neu('person', {}, { rolle: 'mieter', nachname: 'Mieter' })
    const mv = await neu(
      'mietverhaeltnis',
      { einheitId: e.identId },
      { beginn: '2022-02-01', mieterIds: [p.identId] },
    )
    await neu(
      'mietkondition',
      { mietverhaeltnisId: mv.identId },
      { kaltmieteCent: 65_000, vorauszahlungBkCent: 14_600 },
      '2022-02-01',
    )
    for (const [vorname, z] of [
      ['Erste', 1],
      ['Zweite', 1],
    ] as const) {
      const ei = await neu('person', {}, { rolle: 'eigentuemer', vorname, nachname: 'Muster' })
      await neu('eigentumsanteil', { personId: ei.identId }, { zaehler: z, nenner: 2 })
    }
    const buchung = (daten: Partial<JournalEintragDaten>) =>
      bucheJournal(tx, {
        mandantId: a,
        akteur: NUTZER,
        daten: {
          richtung: 'ausgabe',
          gegenpartei: 'Handwerk GmbH',
          zahlungsdatum: '2024-05-10',
          bruttoCent: 119_000,
          umsatzsteuerCent: 19_000,
          steuerkategorie: 'erhaltungsaufwand',
          umlagefaehig: false,
          anteile: [{ objektId: haus, betragCent: 119_000 }],
          ...daten,
        } as JournalEintragDaten,
      })
    await buchung({})
    // Steuerberatung zur Hälfte auf zwei Objekte
    await buchung({
      steuerkategorie: 'verwaltungskosten',
      bruttoCent: 20_000,
      umsatzsteuerCent: 3_193,
      anteile: [
        { objektId: haus, betragCent: 10_000 },
        { objektId: anderes, betragCent: 10_000 },
      ],
    })
    await buchung({ zahlungsdatum: '2025-02-01' })
  })
})

describe('Steuerpaket: Daten je Objekt', () => {
  it('Journal-Anteile des Objekts bis zum Jahr, Umsatzsteuer anteilig', async () => {
    const j = await withMandant(v.app, a, (tx) => steuerJournal(tx, haus, 2024))
    expect(j.map((x) => [x.steuerkategorie, x.betragCent, x.umsatzsteuerCent])).toEqual([
      ['erhaltungsaufwand', 119_000, 19_000],
      ['verwaltungskosten', 10_000, 1_597],
    ])
  })

  it('Mietzeiten mit Stufen und Eigentümer mit Anteilen', async () => {
    const m = await withMandant(v.app, a, (tx) => steuerMietzeiten(tx, haus))
    expect(m).toHaveLength(1)
    expect(m[0]).toMatchObject({
      mieter: ['Mieter'],
      von: '2022-02-01',
      bis: '9999-12-31',
      stufen: [{ ab: '2022-02-01', kaltCent: 65_000, vorauszahlungCent: 14_600 }],
    })
    const e = await withMandant(v.app, a, (tx) => steuerEigentuemer(tx))
    expect(e.map((x) => [x.name, x.zaehler, x.nenner])).toEqual([
      ['Erste Muster', 1, 2],
      ['Zweite Muster', 1, 2],
    ])
    expect(await withMandant(v.app, b, (tx) => steuerMietzeiten(tx, haus))).toEqual([])
  })

  it('Steuerpaket: eines je Objekt und Jahr, festgeschrieben gesperrt, Korrektur per Storno', async () => {
    const id = await withMandant(
      v.app,
      a,
      async (tx) =>
        (
          await neueVersion(tx, {
            entitaet: 'steuerpaket',
            mandantId: a,
            akteur: NUTZER,
            gueltigAb: '2025-03-01',
            identitaet: { objektId: haus, jahr: 2024 },
            daten: { status: 'entwurf', mietausfallCent: 0 },
          })
        ).identId,
    )
    // Festschreiben verlangt Überschuss und Paket
    await erwarteFehler(
      () =>
        withMandant(v.app, a, (tx) =>
          neueVersion(tx, {
            entitaet: 'steuerpaket',
            mandantId: a,
            akteur: NUTZER,
            gueltigAb: '2025-03-02',
            identId: id,
            begruendung: 'Festschreibung',
            daten: { status: 'festgeschrieben' },
          }),
        ),
      /steuerpaket_fest_chk/,
    )
    const dok = await withMandant(v.app, a, (tx) =>
      neueVersion(tx, {
        entitaet: 'dokument',
        mandantId: a,
        akteur: NUTZER,
        gueltigAb: '2025-03-02',
        identitaet: {
          objektId: haus,
          dateiHash: 'a'.repeat(64),
          speicherSchluessel: 'x/y.zip',
          dateiname: 'steuerpaket.zip',
          mime: 'application/zip',
          groesseBytes: 10,
        },
        daten: { typ: 'steuerpaket', status: 'gueltig', titel: 'Steuerpaket 2024' },
      }),
    )
    const fest = await withMandant(v.app, a, (tx) =>
      neueVersion(tx, {
        entitaet: 'steuerpaket',
        mandantId: a,
        akteur: NUTZER,
        gueltigAb: '2025-03-02',
        identId: id,
        begruendung: 'Festschreibung',
        daten: {
          status: 'festgeschrieben',
          ueberschussCent: -12_345,
          paketDokumentId: dok.identId,
        },
      }),
    )
    const nochmal = () =>
      withMandant(v.app, a, (tx) =>
        neueVersion(tx, {
          entitaet: 'steuerpaket',
          mandantId: a,
          akteur: NUTZER,
          gueltigAb: '2025-03-03',
          identId: id,
          begruendung: 'Korrektur',
          daten: { status: 'entwurf' },
        }),
      )
    await erwarteFehler(nochmal, /festgeschrieben/)
    expect((await withMandant(v.app, a, (tx) => listeSteuerpakete(tx)))[0]).toMatchObject({
      jahr: 2024,
      status: 'festgeschrieben',
      dokumentId: dok.identId,
    })
    await withMandant(v.app, a, (tx) =>
      storniereVersion(tx, {
        entitaet: 'steuerpaket',
        mandantId: a,
        versionId: fest.versionId,
        akteur: NUTZER,
        grund: 'Zinsbescheinigung nachgereicht',
      }),
    )
    await nochmal()
    const p = await withMandant(v.app, a, (tx) => ladeSteuerpaket(tx, haus, 2024))
    expect(p!.version.status).toBe('entwurf')
    expect(await withMandant(v.app, b, (tx) => listeSteuerpakete(tx))).toEqual([])
  })
})
