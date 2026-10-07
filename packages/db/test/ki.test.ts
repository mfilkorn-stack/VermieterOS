import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { v7 as uuidv7 } from 'uuid'
import {
  aenderungenSeit,
  entscheideKiVorschlag,
  juengsterKiVorschlag,
  ladeKiVorschlag,
  ledgerStand,
  legeKiVorschlagAn,
} from '../src/ki'
import { neueVersion } from '../src/ledger'
import { withMandant } from '../src/mandant'
import type { Akteur } from '../src/schema/index'
import { NUTZER, erwarteFehler, neuerMandant, verbindungen } from './helfer'

const v = verbindungen()
afterAll(() => v.close())

const SYSTEM: Akteur = { art: 'system', id: 'test' }
let mandant: string
let fremd: string
let objektId: string

function inTagen(t: number): string {
  return new Date(Date.now() + t * 86_400_000).toISOString()
}

async function vorschlag(ablaufAm = inTagen(14), akteur: Akteur = SYSTEM): Promise<string> {
  return withMandant(v.app, mandant, (tx) =>
    legeKiVorschlagAn(tx, {
      mandantId: mandant,
      aufgabe: 'test',
      bezug: { entitaet: 'objekt', id: objektId },
      stempel: { ledgerSeq: 1, promptVersion: 'test@1', modell: 'fake' },
      ausgabe: { text: 'Hallo {{mieter.name}}' },
      aufruf: {},
      ablaufAm,
      akteur,
    }),
  )
}

beforeAll(async () => {
  mandant = await neuerMandant(v.app, 'KI')
  fremd = await neuerMandant(v.app, 'KI fremd')
  const o = await withMandant(v.app, mandant, (tx) =>
    neueVersion(tx, {
      entitaet: 'objekt',
      mandantId: mandant,
      akteur: NUTZER,
      gueltigAb: '2020-01-01',
      identitaet: {},
      daten: { bezeichnung: 'Haus KI', art: 'haus', ort: 'Köln' },
    }),
  )
  objektId = o.identId
})

describe('Ledger-Stand und Änderungen seit einem Stempel', () => {
  it('erkennt eine neue Version der referenzierten Entität, nicht anderer', async () => {
    const stand = await withMandant(v.app, mandant, (tx) => ledgerStand(tx))
    expect(stand).toBeGreaterThan(0)
    const ref = [{ entitaet: 'objekt', id: objektId }]
    expect(await withMandant(v.app, mandant, (tx) => aenderungenSeit(tx, stand, ref))).toEqual([])

    await withMandant(v.app, mandant, (tx) =>
      neueVersion(tx, {
        entitaet: 'objekt',
        mandantId: mandant,
        akteur: NUTZER,
        gueltigAb: '2020-01-01',
        identId: objektId,
        begruendung: 'Ort korrigiert',
        daten: { bezeichnung: 'Haus KI', art: 'haus', ort: 'Bonn' },
      }),
    )
    const geaendert = await withMandant(v.app, mandant, (tx) => aenderungenSeit(tx, stand, ref))
    expect(geaendert).toHaveLength(1)
    expect(geaendert[0]).toMatchObject({
      entitaet: 'objekt',
      id: objektId,
      typ: 'version_angelegt',
    })
    const anderes = [{ entitaet: 'objekt', id: uuidv7() }]
    expect(await withMandant(v.app, mandant, (tx) => aenderungenSeit(tx, stand, anderes))).toEqual(
      [],
    )
  })

  it('zählt den Ledger je Mandant', async () => {
    const eigen = await withMandant(v.app, mandant, (tx) => ledgerStand(tx))
    const anderer = await withMandant(v.app, fremd, (tx) => ledgerStand(tx))
    expect(anderer).toBeLessThan(eigen)
  })
})

describe('KI-Vorschläge', () => {
  it('ist offen, schreibt ein Ereignis ohne Ausgabe und ist für andere Mandanten unsichtbar', async () => {
    const id = await vorschlag()
    const x = await withMandant(v.app, mandant, (tx) => ladeKiVorschlag(tx, id))
    expect(x?.status).toBe('offen')
    expect(x?.ausgabe).toEqual({ text: 'Hallo {{mieter.name}}' })
    const [e] = await withMandant(v.app, mandant, (tx) =>
      tx.execute<{ payload: Record<string, unknown> }>(
        sql`SELECT payload FROM ereignisse WHERE typ = 'ki_vorschlag' AND entitaet_id = ${id}`,
      ),
    )
    expect(e?.payload).toMatchObject({ aufgabe: 'test', promptVersion: 'test@1' })
    expect(JSON.stringify(e?.payload)).not.toContain('Hallo')
    expect(await withMandant(v.app, fremd, (tx) => ladeKiVorschlag(tx, id))).toBeNull()
  })

  it('nimmt genau eine Entscheidung an und ist append-only', async () => {
    const id = await vorschlag()
    await withMandant(v.app, mandant, (tx) =>
      entscheideKiVorschlag(tx, {
        mandantId: mandant,
        vorschlagId: id,
        status: 'verworfen',
        grund: 'passt nicht',
        akteur: NUTZER,
      }),
    )
    const x = await withMandant(v.app, mandant, (tx) => ladeKiVorschlag(tx, id))
    expect(x).toMatchObject({ status: 'verworfen', entscheidungGrund: 'passt nicht' })
    await erwarteFehler(
      () =>
        withMandant(v.app, mandant, (tx) =>
          entscheideKiVorschlag(tx, {
            mandantId: mandant,
            vorschlagId: id,
            status: 'bestaetigt',
            akteur: NUTZER,
          }),
        ),
      /duplicate key|ki_vorschlag_entscheidungen_pkey/,
    )
    await erwarteFehler(
      () =>
        withMandant(v.app, mandant, (tx) =>
          tx.execute(sql`UPDATE ki_vorschlaege SET ausgabe = '{}'::jsonb WHERE id = ${id}`),
        ),
      /permission denied|append-only|nicht erlaubt/i,
    )
  })

  it('bestätigen darf nur ein Mensch', async () => {
    const id = await vorschlag()
    await erwarteFehler(
      () =>
        withMandant(v.app, mandant, (tx) =>
          entscheideKiVorschlag(tx, {
            mandantId: mandant,
            vorschlagId: id,
            status: 'bestaetigt',
            akteur: SYSTEM,
          }),
        ),
      /ki_entscheidung_akteur_chk/,
    )
  })

  it('eine Entscheidung zu einem fremden Vorschlag scheitert', async () => {
    const id = await vorschlag()
    await erwarteFehler(
      () =>
        withMandant(v.app, fremd, (tx) =>
          entscheideKiVorschlag(tx, {
            mandantId: fremd,
            vorschlagId: id,
            status: 'verworfen',
            akteur: NUTZER,
          }),
        ),
      /Bezug|mandant|violates/i,
    )
  })

  it('wird nach Ablauf veraltet, ohne dass jemand entscheidet', async () => {
    const id = await vorschlag(new Date(Date.now() + 1_500).toISOString())
    expect((await withMandant(v.app, mandant, (tx) => ladeKiVorschlag(tx, id)))?.status).toBe(
      'offen',
    )
    await new Promise((r) => setTimeout(r, 2_000))
    expect((await withMandant(v.app, mandant, (tx) => ladeKiVorschlag(tx, id)))?.status).toBe(
      'veraltet',
    )
  })

  it('liefert den jüngsten Vorschlag je Aufgabe und Bezug', async () => {
    const id = await vorschlag()
    const j = await withMandant(v.app, mandant, (tx) =>
      juengsterKiVorschlag(tx, 'test', { entitaet: 'objekt', id: objektId }),
    )
    expect(j?.id).toBe(id)
  })

  it('der Worker legt Vorschläge an, entscheidet aber nicht', async () => {
    const id = await withMandant(v.worker, mandant, (tx) =>
      legeKiVorschlagAn(tx, {
        mandantId: mandant,
        aufgabe: 'test',
        bezug: { entitaet: 'objekt', id: objektId },
        stempel: { ledgerSeq: 1 },
        ausgabe: {},
        aufruf: {},
        ablaufAm: inTagen(14),
        akteur: SYSTEM,
      }),
    )
    await erwarteFehler(
      () =>
        withMandant(v.worker, mandant, (tx) =>
          entscheideKiVorschlag(tx, {
            mandantId: mandant,
            vorschlagId: id,
            status: 'verworfen',
            akteur: SYSTEM,
          }),
        ),
      /permission denied/,
    )
  })
})
