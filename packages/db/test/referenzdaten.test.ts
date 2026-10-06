import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { v7 as uuidv7 } from 'uuid'
import { referenzwert } from '@vermieteros/rechenkern'
import { neueVersion } from '../src/ledger'
import { withMandant } from '../src/mandant'
import { datenqualitaet, ladeReferenzdaten } from '../src/qualitaet'
import { referenzdaten } from '../src/schema/index'
import { NUTZER, erwarteFehler, neuerMandant, verbindungen } from './helfer'

const v = verbindungen()
afterAll(() => v.close())

let a: string
let b: string

beforeAll(async () => {
  a = await neuerMandant(v.app, 'Ref A')
  b = await neuerMandant(v.app, 'Ref B')
})

const zeile = (mandantId: string | null) => ({
  id: uuidv7(),
  mandantId,
  art: 'grunderwerbsteuer' as const,
  schluessel: 'BY',
  wert: { satzPromille: 40 },
  gueltigVon: '2020-01-01',
  quelle: 'Test',
  geprueftAm: '2026-01-01',
  pruefenBis: '2027-01-01',
  erfasstVon: 'test',
})

describe('Referenzdaten', () => {
  it('Seed: für jedes Land gilt heute genau ein geprüfter Grunderwerbsteuersatz', async () => {
    const heute = new Date().toISOString().slice(0, 10)
    const laender = [
      'BW',
      'BY',
      'BE',
      'BB',
      'HB',
      'HH',
      'HE',
      'MV',
      'NI',
      'NW',
      'RP',
      'SL',
      'SN',
      'ST',
      'SH',
      'TH',
    ]
    const saetze: Record<string, number> = {}
    for (const l of laender) {
      const e = await withMandant(v.app, a, (tx) =>
        ladeReferenzdaten<{ satzPromille: number }>(tx, 'grunderwerbsteuer', l),
      )
      const r = referenzwert(e, heute, heute)
      expect({ l, status: r.status }).toEqual({ l, status: 'gueltig' })
      saetze[l] = r.eintrag!.wert.satzPromille
    }
    expect(saetze).toEqual({
      BW: 50,
      BY: 35,
      BE: 60,
      BB: 65,
      HB: 55,
      HH: 55,
      HE: 60,
      MV: 60,
      NI: 50,
      NW: 65,
      RP: 50,
      SL: 65,
      SN: 55,
      ST: 50,
      SH: 65,
      TH: 50,
    })
  })

  it('Seed: Satzwechsel nach Vertragsdatum (Bremen 2025, Thüringen 2024)', async () => {
    const satz = async (land: string, datum: string) => {
      const e = await withMandant(v.app, a, (tx) =>
        ladeReferenzdaten<{ satzPromille: number }>(tx, 'grunderwerbsteuer', land),
      )
      return referenzwert(e, datum, '2026-10-06').eintrag?.wert.satzPromille
    }
    expect(await satz('HB', '2025-06-30')).toBe(50)
    expect(await satz('HB', '2025-07-01')).toBe(55)
    expect(await satz('TH', '2023-12-31')).toBe(65)
    expect(await satz('TH', '2024-01-01')).toBe(50)
  })

  it('App darf globale Werte lesen, aber keine anlegen; eigene schon, fremde sieht sie nicht', async () => {
    await erwarteFehler(
      () => withMandant(v.app, a, (tx) => tx.insert(referenzdaten).values(zeile(null))),
      /row-level security/,
    )
    await withMandant(v.app, a, (tx) => tx.insert(referenzdaten).values(zeile(a)))
    const sichtA = await withMandant(v.app, a, (tx) =>
      ladeReferenzdaten(tx, 'grunderwerbsteuer', 'BY'),
    )
    const sichtB = await withMandant(v.app, b, (tx) =>
      ladeReferenzdaten(tx, 'grunderwerbsteuer', 'BY'),
    )
    expect(sichtA.filter((e) => e.mandantId === a)).toHaveLength(1)
    expect(sichtB.filter((e) => e.mandantId !== null)).toHaveLength(0)
    expect(sichtB.length).toBeGreaterThan(0)
  })

  it('ist append-only und prüft Zeiträume', async () => {
    await erwarteFehler(
      () => v.owner.execute(sql`update referenzdaten set quelle = 'x' where schluessel = 'BY'`),
      /append-only/,
    )
    await erwarteFehler(
      () =>
        withMandant(v.app, a, (tx) =>
          tx.insert(referenzdaten).values({ ...zeile(a), gueltigBis: '2019-01-01' }),
        ),
      /referenzdaten_zeitraum_chk/,
    )
  })

  it('Datenqualität nutzt den Satz zum Vertragsdatum und meldet Abweichungen', async () => {
    const objektId = await withMandant(v.app, b, async (tx) => {
      const o = await neueVersion(tx, {
        entitaet: 'objekt',
        mandantId: b,
        akteur: NUTZER,
        gueltigAb: '2025-08-01',
        identitaet: {},
        daten: {
          bezeichnung: 'Bremen',
          art: 'haus',
          bundesland: 'HB',
          kaufvertragDatum: '2025-07-15',
          anschaffungsdatum: '2025-08-01',
          kaufpreisCent: 30_000_000,
          // 5,0 % statt 5,5 %: Satz von vor dem 01.07.2025 angenommen
          anschaffungsnebenkosten: [{ art: 'grunderwerbsteuer', betragCent: 1_500_000 }],
        },
      })
      return o.identId
    })
    const r = await withMandant(v.app, b, (tx) => datenqualitaet(tx, objektId))
    const befund = r?.befunde.find((x) => x.code === 'OBJ_GREST_ABWEICHUNG')
    expect(befund?.text).toContain('16.500,00 €')
  })
})
