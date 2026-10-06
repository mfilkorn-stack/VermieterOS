import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { v7 as uuidv7 } from 'uuid'
import { neueVersion, pruefeKette } from '../src/ledger'
import { withMandant } from '../src/mandant'
import { ereignisse } from '../src/schema/index'
import { NUTZER, erwarteFehler, neuerMandant, verbindungen } from './helfer'

const v = verbindungen()
afterAll(() => v.close())

let mandantA: string
let mandantB: string

beforeAll(async () => {
  mandantA = await neuerMandant(v.app, 'A')
  mandantB = await neuerMandant(v.app, 'B')
})

describe('Ledger: Hash-Kette', () => {
  it('startet bei seq 1 mit Null-prev_hash und liefert 64 Hex-Zeichen', async () => {
    const rows = await withMandant(v.app, mandantA, (tx) =>
      tx.select().from(ereignisse).orderBy(ereignisse.seq),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.seq).toBe(1)
    expect(rows[0]?.typ).toBe('mandant_angelegt')
    expect(rows[0]?.prevHash).toBe('0'.repeat(64))
    expect(rows[0]?.hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('verkettet aufeinanderfolgende Ereignisse und bleibt pro Mandant getrennt', async () => {
    const e1 = await withMandant(v.app, mandantA, (tx) =>
      neueVersion(tx, {
        entitaet: 'objekt',
        mandantId: mandantA,
        akteur: NUTZER,
        gueltigAb: '2025-01-01',
        identitaet: {},
        daten: { bezeichnung: 'Haus 1', art: 'haus' },
      }),
    )
    const e2 = await withMandant(v.app, mandantA, (tx) =>
      neueVersion(tx, {
        entitaet: 'objekt',
        mandantId: mandantA,
        akteur: NUTZER,
        gueltigAb: '2025-01-01',
        identitaet: {},
        daten: { bezeichnung: 'Haus 2', art: 'etw' },
      }),
    )
    expect(e1.seq).toBe(2)
    expect(e2.seq).toBe(3)

    const rows = await withMandant(v.app, mandantA, (tx) =>
      tx.select().from(ereignisse).orderBy(ereignisse.seq),
    )
    expect(rows.map((r) => r.seq)).toEqual([1, 2, 3])
    expect(rows[1]?.prevHash).toBe(rows[0]?.hash)
    expect(rows[2]?.prevHash).toBe(rows[1]?.hash)

    const rowsB = await withMandant(v.app, mandantB, (tx) => tx.select().from(ereignisse))
    expect(rowsB).toHaveLength(1)
    expect(rowsB[0]?.seq).toBe(1)
  })

  it('ignoriert von der Anwendung mitgegebene seq/hash-Werte', async () => {
    const [row] = await withMandant(v.app, mandantB, (tx) =>
      tx
        .insert(ereignisse)
        .values({
          id: uuidv7(),
          mandantId: mandantB,
          typ: 'ki_aufruf',
          akteurArt: 'system',
          akteurId: 'test',
          seq: 999,
          prevHash: 'gefälscht',
          hash: 'gefälscht',
          payload: { a: 1 },
        })
        .returning(),
    )
    expect(row?.seq).toBe(2)
    expect(row?.prevHash).toMatch(/^[0-9a-f]{64}$/)
    expect(row?.hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('Kettenprüfung ist grün für beide Mandanten', async () => {
    const a = await withMandant(v.app, mandantA, (tx) => pruefeKette(tx, mandantA))
    const b = await withMandant(v.app, mandantB, (tx) => pruefeKette(tx, mandantB))
    expect(a).toEqual({ ok: true, geprueft: 3, ersterFehlerSeq: null, fehler: null })
    expect(b).toEqual({ ok: true, geprueft: 2, ersterFehlerSeq: null, fehler: null })
  })

  it('Kettenprüfung liefert ohne Mandantenkontext nichts (RLS)', async () => {
    const r = await v.app.execute(sql`select * from ledger_pruefe_kette(${mandantA})`)
    expect(r[0]).toMatchObject({ ok: true, geprueft: 0 })
  })
})

describe('Ledger: Schreibschutz', () => {
  it('App-Rolle darf nicht ändern oder löschen (fehlendes Recht)', async () => {
    await erwarteFehler(
      () =>
        withMandant(v.app, mandantA, (tx) =>
          tx.execute(sql`update ereignisse set payload = '{}'::jsonb where seq = 1`),
        ),
      /permission denied/i,
    )
    await erwarteFehler(
      () =>
        withMandant(v.app, mandantA, (tx) => tx.execute(sql`delete from ereignisse where seq = 1`)),
      /permission denied/i,
    )
  })

  it('auch der Besitzer wird vom Trigger gestoppt', async () => {
    await erwarteFehler(
      () =>
        v.owner.execute(
          sql`update ereignisse set payload = '{}'::jsonb where mandant_id = ${mandantA} and seq = 1`,
        ),
      /append-only/,
    )
    await erwarteFehler(
      () => v.owner.execute(sql`delete from ereignisse where mandant_id = ${mandantA} and seq = 1`),
      /append-only/,
    )
  })

  it('eine Manipulation am Trigger vorbei fällt bei der Kettenprüfung auf', async () => {
    // Simuliert einen Angreifer mit Superuser-Rechten, der den Schreibschutz abschaltet.
    await v.owner.execute(sql`alter table ereignisse disable trigger ereignisse_append_only`)
    try {
      await v.owner.execute(
        sql`update ereignisse set payload = payload || '{"manipuliert":true}'::jsonb where mandant_id = ${mandantA} and seq = 2`,
      )
    } finally {
      await v.owner.execute(sql`alter table ereignisse enable trigger ereignisse_append_only`)
    }
    const r = await withMandant(v.app, mandantA, (tx) => pruefeKette(tx, mandantA))
    expect(r.ok).toBe(false)
    expect(r.ersterFehlerSeq).toBe(2)
    expect(r.fehler).toMatch(/hash passt nicht/)
    expect(r.geprueft).toBe(1)
  })
})
