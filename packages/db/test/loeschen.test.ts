import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { neueVersion } from '../src/ledger'
import { loesche, loeschHindernisse } from '../src/loeschen'
import { withMandant } from '../src/mandant'
import { NUTZER, erwarteFehler, neuerMandant, verbindungen } from './helfer'

const v = verbindungen()
afterAll(() => v.close())

let a: string
let b: string

beforeAll(async () => {
  a = await neuerMandant(v.app, 'Löschen A')
  b = await neuerMandant(v.app, 'Löschen B')
})

async function anlegen(mandant: string) {
  return withMandant(v.app, mandant, async (tx) => {
    const neu = (entitaet: never, identitaet: object, daten: object) =>
      neueVersion(tx, {
        entitaet,
        mandantId: mandant,
        akteur: NUTZER,
        gueltigAb: '2024-01-01',
        identitaet: identitaet as never,
        daten: daten as never,
      })
    const o = await neu('objekt' as never, {}, { bezeichnung: 'Musterweg 1', art: 'etw' })
    await neu('notfallkarte' as never, { objektId: o.identId }, { eintraege: [] })
    const e = await neu('einheit' as never, { objektId: o.identId }, { bezeichnung: 'Wohnung' })
    const p = await neu('person' as never, {}, { rolle: 'mieter', nachname: 'Beispiel' })
    const mv = await neu(
      'mietverhaeltnis' as never,
      { einheitId: e.identId },
      { beginn: '2024-01-01', mieterIds: [p.identId] },
    )
    return { objekt: o.identId, einheit: e.identId, mv: mv.identId, person: p.identId }
  })
}

const zaehle = (mandant: string, sicht: string, spalte: string, id: string) =>
  withMandant(v.app, mandant, async (tx) => {
    const [r] = await tx.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM ${sql.identifier(sicht)} WHERE ${sql.identifier(spalte)} = ${id}`,
    )
    return r!.n
  })

describe('Löschen von Haus/Wohnung, Einheit, Mietverhältnis', () => {
  it('von unten nach oben; Hindernisse werden genannt; alles bleibt im Ledger', async () => {
    const x = await anlegen(a)
    const p = { mandantId: a, akteur: NUTZER, grund: 'Versehentlich angelegt' }

    expect(await withMandant(v.app, a, (tx) => loeschHindernisse(tx, 'objekt', x.objekt))).toEqual([
      'Einheiten (zuerst löschen)',
    ])
    expect(
      await withMandant(v.app, a, (tx) => loeschHindernisse(tx, 'einheit', x.einheit)),
    ).toEqual(['Mietverhältnisse (zuerst löschen)'])
    await erwarteFehler(
      () => withMandant(v.app, a, (tx) => loesche(tx, 'objekt', x.objekt, p)),
      /Einheiten/,
    )

    await withMandant(v.app, a, (tx) => loesche(tx, 'mietverhaeltnis', x.mv, p))
    expect(await zaehle(a, 'mietverhaeltnisse_aktuell', 'mietverhaeltnis_id', x.mv)).toBe(0)
    expect(await zaehle(a, 'personen_aktuell', 'person_id', x.person)).toBe(0)

    await withMandant(v.app, a, (tx) => loesche(tx, 'einheit', x.einheit, p))
    expect(await zaehle(a, 'einheiten_aktuell', 'einheit_id', x.einheit)).toBe(0)

    await withMandant(v.app, a, (tx) => loesche(tx, 'objekt', x.objekt, p))
    expect(await zaehle(a, 'objekte_aktuell', 'objekt_id', x.objekt)).toBe(0)
    // Notfallkarte gehört nur zum Objekt und geht mit
    const [nk] = await withMandant(v.app, a, (tx) =>
      tx.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM notfallkarten n
        JOIN notfallkarten_aktuell k ON k.notfallkarte_id = n.id WHERE n.objekt_id = ${x.objekt}`),
    )
    expect(nk!.n).toBe(0)
    // Nachvollziehbar: Stornos stehen im Ledger
    const [st] = await withMandant(v.app, a, (tx) =>
      tx.execute<{ n: number }>(
        sql`SELECT count(*)::int AS n FROM ereignisse WHERE typ = 'version_storniert'`,
      ),
    )
    expect(st!.n).toBeGreaterThanOrEqual(5)
  })

  it('ein Ticket hält das Haus fest; fremde Mandanten sehen nichts', async () => {
    const x = await anlegen(a)
    const p = { mandantId: a, akteur: NUTZER, grund: 'Test' }
    await withMandant(v.app, a, async (tx) => {
      await neueVersion(tx, {
        entitaet: 'ticket',
        mandantId: a,
        akteur: NUTZER,
        gueltigAb: '2024-01-01',
        identitaet: { objektId: x.objekt },
        daten: { titel: 'Heizung', status: 'gemeldet', prioritaet: 'normal' },
      })
      await loesche(tx, 'mietverhaeltnis', x.mv, p)
      await loesche(tx, 'einheit', x.einheit, p)
    })
    expect(await withMandant(v.app, a, (tx) => loeschHindernisse(tx, 'objekt', x.objekt))).toEqual([
      'Tickets',
    ])
    // Im fremden Mandanten ist das Objekt unsichtbar; Löschen findet keine Version
    await erwarteFehler(
      () => withMandant(v.app, b, (tx) => loesche(tx, 'objekt', x.objekt, { ...p, mandantId: b })),
      /.+/,
    )
    expect(await zaehle(a, 'objekte_aktuell', 'objekt_id', x.objekt)).toBe(1)
  })
})
