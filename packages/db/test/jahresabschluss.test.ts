import type { JournalEintragDaten } from '@vermieteros/schema'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { abschlussDaten } from '../src/jahresabschluss'
import { bucheJournal } from '../src/journal'
import { neueVersion } from '../src/ledger'
import { withMandant } from '../src/mandant'
import { NUTZER, neuerMandant, verbindungen } from './helfer'

const v = verbindungen()
afterAll(() => v.close())

let a: string
let b: string
let haus: string

beforeAll(async () => {
  a = await neuerMandant(v.app, 'Abschluss A')
  b = await neuerMandant(v.app, 'Abschluss B')
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
    haus = (await neu('objekt', {}, { bezeichnung: 'Musterobjekt', art: 'etw', weg: true })).identId
    const e = await neu('einheit', { objektId: haus }, { bezeichnung: 'EG' })
    const p = await neu('person', {}, { rolle: 'mieter', nachname: 'Mieter' })
    await neu(
      'mietverhaeltnis',
      { einheitId: e.identId },
      { beginn: '2024-03-01', mieterIds: [p.identId] },
    )
    let n = 0
    const dok = (typ: string, objektId: string | null, dokumentdatum: string) =>
      neu(
        'dokument',
        {
          objektId,
          dateiHash: String(++n).padStart(64, '0'),
          speicherSchluessel: `x/${n}`,
          dateiname: `${typ}.pdf`,
          mime: 'application/pdf',
          groesseBytes: 10,
          beleg: typ === 'beleg',
        },
        { typ, status: 'gueltig', titel: typ, dokumentdatum },
      )
    await dok('grundsteuer', haus, '2023-02-01')
    await dok('zinsbescheinigung', haus, '2026-01-15')
    await dok('beleg', haus, '2025-03-01')
    await dok('beleg', null, '2025-03-02')
    await bucheJournal(tx, {
      mandantId: a,
      akteur: NUTZER,
      daten: {
        richtung: 'ausgabe',
        gegenpartei: 'Bank',
        zahlungsdatum: '2025-06-30',
        bruttoCent: 50_000,
        steuerkategorie: 'schuldzinsen',
        umlagefaehig: false,
        anteile: [{ objektId: haus, betragCent: 50_000 }],
      } as JournalEintragDaten,
    })
  })
})

describe('Jahresabschluss: Rohdaten je Objekt', () => {
  it('Belege, Buchungen, BK-Bedarf, Dokumente, Darlehen, Steuerpaket', async () => {
    const [r] = await withMandant(v.app, a, (tx) => abschlussDaten(tx, 2025))
    expect(r).toMatchObject({
      objekt: 'Musterobjekt',
      weg: true,
      belegeOffen: 2,
      buchungen: 1,
      letzteBuchung: '2025-06-30',
      bk: [{ einheit: 'EG', abrechnungId: null, status: 'fehlt', versendet: false }],
      darlehen: true,
      steuerpaket: 'offen',
    })
    expect(r!.dokumente.map((d) => d.typ).sort()).toEqual(['grundsteuer', 'zinsbescheinigung'])
    const [vorher] = await withMandant(v.app, a, (tx) => abschlussDaten(tx, 2023))
    expect(vorher!.bk).toEqual([])
    expect(vorher!.buchungen).toBe(0)
  })

  it('andere Mandanten sehen nichts', async () => {
    expect(await withMandant(v.app, b, (tx) => abschlussDaten(tx, 2025))).toEqual([])
  })
})
