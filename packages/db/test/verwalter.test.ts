import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { fachdaten, letzteVersion, neueVersion } from '../src/ledger'
import { withMandant } from '../src/mandant'
import { NUTZER, neuerMandant, verbindungen } from './helfer'

const v = verbindungen()
afterAll(() => v.close())

let a: string
beforeAll(async () => {
  a = await neuerMandant(v.app, 'Verwalter A')
})

describe('Verwalter in den Stammdaten', () => {
  it('wird versioniert gespeichert und steht in der Sicht', async () => {
    const verwalter = [
      { art: 'weg' as const, firma: 'Muster WEG-Verwaltung', email: 'weg@example.org' },
      { art: 'miet' as const, firma: 'Beispiel Mietverwaltung', telefon: '0221 999' },
    ]
    const o = await withMandant(v.app, a, (tx) =>
      neueVersion(tx, {
        entitaet: 'objekt',
        mandantId: a,
        akteur: NUTZER,
        gueltigAb: '2024-01-01',
        identitaet: {},
        daten: { bezeichnung: 'Musterweg 1', art: 'etw', weg: true, verwalter },
      }),
    )
    const [r] = await withMandant(v.app, a, (tx) =>
      tx.execute<{ verwalter: unknown }>(
        sql`select verwalter from objekte_aktuell where objekt_id = ${o.identId}`,
      ),
    )
    expect(r!.verwalter).toEqual(verwalter)
    const daten = await withMandant(v.app, a, async (tx) =>
      fachdaten('objekt', (await letzteVersion(tx, 'objekt', o.identId))!),
    )
    expect(daten.verwalter?.map((x) => x.firma)).toEqual([
      'Muster WEG-Verwaltung',
      'Beispiel Mietverwaltung',
    ])
  })
})
