import {
  createDb,
  legeMandantAn,
  legeNachrichtAn,
  legePostfachAn,
  neueVersion,
  ordneNachrichtZu,
  withMandant,
  type Akteur,
  type Db,
} from '@vermieteros/db'
import { sql } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { afterAll, beforeAll, describe, expect, it, inject } from 'vitest'
import { z } from 'zod'
import type { Aufgabe } from '../src/aufgabe'
import { KiFehler } from '../src/client'
import { FakeKiClient } from '../src/fake'
import { fuerNachricht, nachrichtFakten, type NachrichtDaten } from '../src/kontext/nachricht'
import { rendere } from '../src/platzhalter'
import {
  bestaetigeVorschlag,
  EntwurfAbgelehnt,
  erzeugeVorschlag,
  pruefeVorschlag,
  verwirfVorschlag,
} from '../src/vorschlag'

const NUTZER: Akteur = { art: 'nutzer', id: 'test-nutzer' }
const app = createDb(inject('appUrl'), { max: 2 })
const db: Db = app.db
afterAll(() => app.close())

let mandant: string
let einheitId: string
let mvId: string
let nachrichtId: string

const Antwort = z.object({ kategorie: z.enum(['heizung', 'sonstiges']), entwurf: z.string() })
type Antwort = z.infer<typeof Antwort>

/** Testaufgabe nach dem Muster der späteren Antwortvorschläge (WP 1.5). */
const TEST_ANTWORT: Aufgabe<NachrichtDaten, Antwort> = {
  name: 'test_antwort',
  version: 1,
  system: 'Du sortierst Mieteranfragen und entwirfst Antworten. Fakten nur als Platzhalter.',
  nachricht: (d, p) => JSON.stringify({ mail: d, platzhalter: p }),
  ausgabe: Antwort,
  entwuerfe: (a) => [a.entwurf],
}

function umgebung(client: FakeKiClient) {
  return { db, mandantId: mandant, akteur: NUTZER, client, modell: 'fake-modell' }
}

async function ereignisse(typ: string): Promise<Array<{ payload: Record<string, unknown> }>> {
  return withMandant(db, mandant, (tx) =>
    tx.execute<{ payload: Record<string, unknown> }>(
      sql`SELECT payload FROM ereignisse WHERE typ = ${typ} ORDER BY seq`,
    ),
  )
}

beforeAll(async () => {
  mandant = uuidv7()
  await withMandant(db, mandant, async (tx) => {
    await legeMandantAn(tx, {
      id: mandant,
      name: 'Geschwister Muster',
      art: 'allein',
      akteur: NUTZER,
    })
    const o = await neueVersion(tx, {
      entitaet: 'objekt',
      mandantId: mandant,
      akteur: NUTZER,
      gueltigAb: '2024-01-01',
      identitaet: {},
      daten: { bezeichnung: 'Haus am Park', art: 'haus', strasse: 'Parkweg', hausnummer: '3' },
    })
    const e = await neueVersion(tx, {
      entitaet: 'einheit',
      mandantId: mandant,
      akteur: NUTZER,
      gueltigAb: '2024-01-01',
      identitaet: { objektId: o.identId },
      daten: { bezeichnung: 'EG links' },
    })
    einheitId = e.identId
    const p = await neueVersion(tx, {
      entitaet: 'person',
      mandantId: mandant,
      akteur: NUTZER,
      gueltigAb: '2024-01-01',
      identitaet: {},
      daten: {
        rolle: 'mieter',
        vorname: 'Erika',
        nachname: 'Mieterin',
        email: 'erika@example.org',
      },
    })
    const mv = await neueVersion(tx, {
      entitaet: 'mietverhaeltnis',
      mandantId: mandant,
      akteur: NUTZER,
      gueltigAb: '2024-01-01',
      identitaet: { einheitId: e.identId },
      daten: { beginn: '2024-01-01', mieterIds: [p.identId] },
    })
    mvId = mv.identId
    const pf = await legePostfachAn(tx, {
      mandantId: mandant,
      bezeichnung: 'Vermietung',
      host: 'imap.example.org',
      port: 993,
      tls: true,
      benutzer: 'vermietung@example.org',
      passwortChiffre: 'v1:geheim',
      ordner: 'INBOX',
      abrufAb: '2026-09-01',
      akteur: NUTZER,
    })
    nachrichtId = (await legeNachrichtAn(
      tx,
      {
        mandantId: mandant,
        postfachId: pf,
        uidValidity: 1,
        imapUid: 1,
        messageId: null,
        inReplyTo: null,
        referenzen: [],
        vonAdresse: 'erika@example.org',
        vonName: 'Erika Mieterin',
        an: ['vermietung@example.org'],
        betreff: 'Heizung kalt',
        gesendetAm: '2026-10-01T08:00:00Z',
        text: 'Seit gestern bleibt die Heizung kalt.',
        roh: { schluessel: 'roh/1.eml', sha256: 'a'.repeat(64), groesse: 100 },
        anhaenge: [],
      },
      { art: 'system', id: 'test' },
    ))!
    await ordneNachrichtZu(tx, {
      mandantId: mandant,
      nachrichtId,
      mietverhaeltnisId: mvId,
      art: 'absender',
      begruendung: null,
      akteur: { art: 'system', id: 'test' },
    })
  })
})

describe('Kontext-Builder für Mails', () => {
  it('liefert Inhalt ohne Mailadressen, Platzhalter-Katalog und Referenzen', async () => {
    const k = await withMandant(db, mandant, (tx) => fuerNachricht(tx, nachrichtId))
    expect(k.daten).toMatchObject({
      betreff: 'Heizung kalt',
      absender: 'Erika Mieterin',
      zuordnung: { einheit: 'EG links', objekt: 'Haus am Park' },
    })
    expect(JSON.stringify(k.daten)).not.toContain('@')
    expect(Object.keys(k.platzhalter)).toContain('mieter.name')
    expect(k.referenzen.map((r) => r.entitaet).sort()).toEqual([
      'einheit',
      'mietverhaeltnis',
      'nachricht',
      'objekt',
    ])
  })
})

describe('Vorschläge', () => {
  it('erzeugt einen Vorschlag mit Stempel, protokolliert ohne Inhalt, rendert Fakten beim Bestätigen', async () => {
    const client = new FakeKiClient({
      kategorie: 'heizung',
      entwurf: 'Guten Tag {{mieter.name}}, wir schicken jemanden in {{objekt.adresse}}.',
    })
    const v = await erzeugeVorschlag(umgebung(client), TEST_ANTWORT, (tx) =>
      fuerNachricht(tx, nachrichtId),
    )
    // Das Modell sieht Platzhalter, keine Werte
    expect(client.anfragen[0]!.nachricht).toContain('mieter.name')
    expect(client.anfragen[0]!.nachricht).not.toContain('Parkweg')
    expect(client.anfragen[0]!.modell).toBe('fake-modell')

    const p = await pruefeVorschlag({ db, mandantId: mandant }, v.id)
    expect(p.status).toBe('offen')
    expect(p.vorschlag.stempel).toMatchObject({
      promptVersion: 'test_antwort@1',
      modell: 'fake-modell',
    })

    const aufrufe = await ereignisse('ki_aufruf')
    expect(aufrufe.at(-1)?.payload).toMatchObject({ ok: true, promptVersion: 'test_antwort@1' })
    expect(JSON.stringify(aufrufe)).not.toContain('Heizung kalt')

    const b = await bestaetigeVorschlag({ db, mandantId: mandant, akteur: NUTZER }, v.id)
    expect(b.status).toBe('bestaetigt')
    const fakten = await withMandant(db, mandant, (tx) => nachrichtFakten(tx, nachrichtId))
    expect(rendere(v.ausgabe.entwurf, fakten)).toBe(
      'Guten Tag Erika Mieterin, wir schicken jemanden in Parkweg 3.',
    )
  })

  it('lehnt einen Entwurf mit Zahl oder unbekanntem Platzhalter ab und legt nichts an', async () => {
    const vorher = (await ereignisse('ki_vorschlag')).length
    const client = new FakeKiClient(
      { kategorie: 'heizung', entwurf: 'Ihre Miete von 650 € bleibt.' },
      { kategorie: 'heizung', entwurf: 'Ihre Miete {{mietkondition.kaltmiete}} bleibt.' },
    )
    const bau = (tx: Parameters<typeof fuerNachricht>[0]) => fuerNachricht(tx, nachrichtId)
    await expect(erzeugeVorschlag(umgebung(client), TEST_ANTWORT, bau)).rejects.toBeInstanceOf(
      EntwurfAbgelehnt,
    )
    await expect(erzeugeVorschlag(umgebung(client), TEST_ANTWORT, bau)).rejects.toThrow(
      /mietkondition.kaltmiete/,
    )
    expect((await ereignisse('ki_vorschlag')).length).toBe(vorher)
    expect((await ereignisse('ki_aufruf')).at(-1)?.payload).toMatchObject({
      ok: false,
      fehler: 'entwurf',
    })
  })

  it('verwirft eine Ausgabe, die nicht zum Schema passt, und protokolliert Modellfehler', async () => {
    const bau = (tx: Parameters<typeof fuerNachricht>[0]) => fuerNachricht(tx, nachrichtId)
    const falsch = new FakeKiClient({ kategorie: 'wasserrohrbruch', entwurf: 'x' })
    await expect(erzeugeVorschlag(umgebung(falsch), TEST_ANTWORT, bau)).rejects.toMatchObject({
      art: 'ungueltig',
    })
    const kaputt = new FakeKiClient(new KiFehler('abgelehnt', 'verweigert'))
    await expect(erzeugeVorschlag(umgebung(kaputt), TEST_ANTWORT, bau)).rejects.toMatchObject({
      art: 'verweigert',
    })
    expect((await ereignisse('ki_aufruf')).at(-1)?.payload).toMatchObject({
      ok: false,
      fehler: 'verweigert',
    })
  })

  it('wird veraltet, wenn sich eine referenzierte Entität ändert, und nicht bestätigt', async () => {
    const client = new FakeKiClient({ kategorie: 'heizung', entwurf: 'Danke, {{mieter.name}}.' })
    const v = await erzeugeVorschlag(umgebung(client), TEST_ANTWORT, (tx) =>
      fuerNachricht(tx, nachrichtId),
    )
    await withMandant(db, mandant, (tx) =>
      neueVersion(tx, {
        entitaet: 'einheit',
        mandantId: mandant,
        akteur: NUTZER,
        gueltigAb: '2024-01-01',
        identId: einheitId,
        begruendung: 'umbenannt',
        daten: { bezeichnung: 'Erdgeschoss links' },
      }),
    )
    const b = await bestaetigeVorschlag({ db, mandantId: mandant, akteur: NUTZER }, v.id)
    expect(b.status).toBe('veraltet')
    if (b.status === 'veraltet') expect(b.gruende.join()).toMatch(/einheit .*version_angelegt/)
    // Der Befund ist festgehalten, nicht nur berechnet
    expect((await pruefeVorschlag({ db, mandantId: mandant }, v.id)).status).toBe('veraltet')
  })

  it('wird veraltet, wenn die Mail umgeordnet wird', async () => {
    const client = new FakeKiClient({ kategorie: 'heizung', entwurf: 'Danke.' })
    const v = await erzeugeVorschlag(umgebung(client), TEST_ANTWORT, (tx) =>
      fuerNachricht(tx, nachrichtId),
    )
    await withMandant(db, mandant, (tx) =>
      ordneNachrichtZu(tx, {
        mandantId: mandant,
        nachrichtId,
        mietverhaeltnisId: null,
        art: 'aufgehoben',
        begruendung: 'falsch zugeordnet',
        akteur: NUTZER,
      }),
    )
    expect((await pruefeVorschlag({ db, mandantId: mandant }, v.id)).status).toBe('veraltet')
  })

  it('verwerfen ist endgültig', async () => {
    const client = new FakeKiClient({ kategorie: 'sonstiges', entwurf: 'Danke.' })
    const v = await erzeugeVorschlag(umgebung(client), TEST_ANTWORT, (tx) =>
      fuerNachricht(tx, nachrichtId),
    )
    await verwirfVorschlag({ db, mandantId: mandant, akteur: NUTZER }, v.id, 'unpassend')
    const b = await bestaetigeVorschlag({ db, mandantId: mandant, akteur: NUTZER }, v.id)
    expect(b.status).toBe('verworfen')
  })
})
