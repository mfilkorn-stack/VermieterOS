import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { v7 as uuidv7 } from 'uuid'
import { neueVersion } from '../src/ledger'
import { withMandant } from '../src/mandant'
import { ereignisse, mandanten, objekte, objektVersionen } from '../src/schema/index'
import { NUTZER, erwarteFehler, neuerMandant, verbindungen } from './helfer'

const v = verbindungen()
afterAll(() => v.close())

let a: string
let b: string

beforeAll(async () => {
  a = await neuerMandant(v.app, 'Mandant A')
  b = await neuerMandant(v.app, 'Mandant B')
  await withMandant(v.app, a, (tx) =>
    neueVersion(tx, {
      entitaet: 'objekt',
      mandantId: a,
      akteur: NUTZER,
      gueltigAb: '2025-01-01',
      identitaet: {},
      daten: { bezeichnung: 'Nur A', art: 'haus' },
    }),
  )
})

describe('Row-Level-Security', () => {
  it('Mandant B sieht nichts von Mandant A', async () => {
    const [o, ov, e, m] = await withMandant(v.app, b, (tx) =>
      Promise.all([
        tx.select().from(objekte),
        tx.select().from(objektVersionen),
        tx.select().from(ereignisse),
        tx.select().from(mandanten),
      ]),
    )
    expect(o).toHaveLength(0)
    expect(ov).toHaveLength(0)
    expect(e.map((x) => x.mandantId)).toEqual([b])
    expect(m.map((x) => x.id)).toEqual([b])
  })

  it('Mandant A sieht genau seine Daten, auch über die Sicht', async () => {
    const o = await withMandant(v.app, a, (tx) => tx.select().from(objekte))
    expect(o).toHaveLength(1)
    const sicht = await withMandant(v.app, a, (tx) =>
      tx.execute(sql`select bezeichnung from objekte_aktuell`),
    )
    expect(sicht.map((r) => r['bezeichnung'])).toEqual(['Nur A'])
    const sichtB = await withMandant(v.app, b, (tx) =>
      tx.execute(sql`select bezeichnung from objekte_aktuell`),
    )
    expect(sichtB).toHaveLength(0)
  })

  it('ohne Mandantenkontext: keine Zeilen, kein Schreiben', async () => {
    expect(await v.app.select().from(objekte)).toHaveLength(0)
    expect(await v.app.select().from(mandanten)).toHaveLength(0)
    expect(await v.app.select().from(ereignisse)).toHaveLength(0)
    await erwarteFehler(
      () => v.app.insert(objekte).values({ id: uuidv7(), mandantId: a }),
      /row-level security/,
    )
  })

  it('im Kontext von B kann nicht für A geschrieben werden', async () => {
    await erwarteFehler(
      () =>
        withMandant(v.app, b, (tx) => tx.insert(objekte).values({ id: uuidv7(), mandantId: a })),
      /row-level security/,
    )
    await erwarteFehler(
      () =>
        withMandant(v.app, b, (tx) =>
          tx.insert(ereignisse).values({
            id: uuidv7(),
            mandantId: a,
            typ: 'ki_aufruf',
            akteurArt: 'system',
            akteurId: 'x',
          }),
        ),
      /row-level security/,
    )
  })

  it('Mandant kann nicht gelöscht werden', async () => {
    await erwarteFehler(
      () => v.owner.execute(sql`delete from mandanten where id = ${a}`),
      /kein DELETE/,
    )
  })

  it('withMandant lehnt kaputte IDs ab, bevor etwas die Datenbank erreicht', async () => {
    await erwarteFehler(
      () => withMandant(v.app, "x'; drop table", async () => 1),
      /ungültige mandantId/,
    )
  })
})

describe('Bezüge über Mandantengrenzen', () => {
  it('Einheit, Darlehen und Mieter können nicht auf fremde Identitäten zeigen', async () => {
    const objektA = await withMandant(v.app, a, async (tx) => {
      const [o] = await tx.select({ id: objekte.id }).from(objekte)
      return o!.id
    })
    await erwarteFehler(
      () =>
        withMandant(v.app, b, (tx) =>
          neueVersion(tx, {
            entitaet: 'einheit',
            mandantId: b,
            akteur: NUTZER,
            gueltigAb: '2025-01-01',
            identitaet: { objektId: objektA },
            daten: { bezeichnung: 'Kuckucksei' },
          }),
        ),
      /gehört nicht zum Mandanten/,
    )
    await erwarteFehler(
      () =>
        withMandant(v.app, b, (tx) =>
          neueVersion(tx, {
            entitaet: 'darlehen',
            mandantId: b,
            akteur: NUTZER,
            gueltigAb: '2025-01-01',
            identitaet: { objektId: objektA },
            daten: { bank: 'X', nominalCent: 1, zinsBp: 1, rateCent: 1 },
          }),
        ),
      /gehört nicht zum Mandanten/,
    )

    // Mieter aus Mandant A in einem Mietverhältnis von B
    const mieterA = await withMandant(v.app, a, (tx) =>
      neueVersion(tx, {
        entitaet: 'person',
        mandantId: a,
        akteur: NUTZER,
        gueltigAb: '2025-01-01',
        identitaet: {},
        daten: { rolle: 'mieter', nachname: 'Fremd' },
      }),
    )
    await erwarteFehler(
      () =>
        withMandant(v.app, b, async (tx) => {
          const o = await neueVersion(tx, {
            entitaet: 'objekt',
            mandantId: b,
            akteur: NUTZER,
            gueltigAb: '2025-01-01',
            identitaet: {},
            daten: { bezeichnung: 'B', art: 'haus' },
          })
          const e = await neueVersion(tx, {
            entitaet: 'einheit',
            mandantId: b,
            akteur: NUTZER,
            gueltigAb: '2025-01-01',
            identitaet: { objektId: o.identId },
            daten: { bezeichnung: 'EG' },
          })
          await neueVersion(tx, {
            entitaet: 'mietverhaeltnis',
            mandantId: b,
            akteur: NUTZER,
            gueltigAb: '2025-01-01',
            identitaet: { einheitId: e.identId },
            daten: { beginn: '2025-01-01', mieterIds: [mieterA.identId] },
          })
        }),
      /Mieter gehört nicht zum Mandanten/,
    )
  })
})
