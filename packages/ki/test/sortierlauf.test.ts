import {
  createDb,
  geltendeKiVorschlaege,
  legeMandantAn,
  legeNachrichtAn,
  legePostfachAn,
  withMandant,
  type Akteur,
} from '@vermieteros/db'
import { v7 as uuidv7 } from 'uuid'
import { afterAll, beforeAll, describe, expect, it, inject } from 'vitest'
import { KiFehler } from '../src/client'
import { FakeKiClient } from '../src/fake'
import { sortiereNeueNachrichten } from '../src/sortierlauf'

const NUTZER: Akteur = { art: 'nutzer', id: 'test-nutzer' }
const app = createDb(inject('appUrl'), { max: 2 })
// Der Worker sortiert mit seiner eigenen Rolle; der Test prüft damit auch deren Rechte.
const worker = createDb(inject('workerUrl'), { max: 2 })
afterAll(async () => {
  await app.close()
  await worker.close()
})

let mandant: string
const ids: string[] = []
const log: string[] = []

const sortierung = {
  kategorie: 'heizung_wasser',
  dringlichkeit: 'hoch',
  frist: null,
  zusammenfassung: 'Heizung ausgefallen',
  begruendung: 'Heizung, Winter',
}

beforeAll(async () => {
  mandant = uuidv7()
  await withMandant(app.db, mandant, async (tx) => {
    await legeMandantAn(tx, { id: mandant, name: 'Sortierlauf', art: 'allein', akteur: NUTZER })
    const pf = await legePostfachAn(tx, {
      mandantId: mandant,
      bezeichnung: 'Vermietung',
      host: 'imap.example.org',
      port: 993,
      tls: true,
      benutzer: 'v@example.org',
      passwortChiffre: 'v1:x',
      ordner: 'INBOX',
      abrufAb: '2026-09-01',
      akteur: NUTZER,
    })
    for (const [i, betreff] of ['Heizung kalt', 'Frage'].entries()) {
      ids.push(
        (await legeNachrichtAn(
          tx,
          {
            mandantId: mandant,
            postfachId: pf,
            uidValidity: 1,
            imapUid: i + 1,
            messageId: null,
            inReplyTo: null,
            referenzen: [],
            vonAdresse: 'm@example.org',
            vonName: 'Mieter',
            an: [],
            betreff,
            gesendetAm: null,
            text: 'Text',
            roh: { schluessel: `roh/${i}.eml`, sha256: String(i).repeat(64), groesse: 1 },
            anhaenge: [],
          },
          { art: 'system', id: 'test' },
        ))!,
      )
    }
  })
})

const lauf = (client: FakeKiClient, limit = 10) =>
  sortiereNeueNachrichten({
    db: worker.db,
    client,
    mandantIds: [mandant, mandant],
    limit,
    log: (t) => log.push(t),
  })

describe('Sortierlauf im Worker', () => {
  it('bricht nach zwei Fehlversuchen je Mail ab, statt weiter Kosten zu erzeugen', async () => {
    const kaputt = () => new KiFehler('überlastet', 'verweigert')
    expect(await lauf(new FakeKiClient(kaputt, kaputt), 1)).toEqual({ sortiert: 0, fehler: 1 })
    expect(await lauf(new FakeKiClient(kaputt), 1)).toEqual({ sortiert: 0, fehler: 1 })
    expect(log.join('\n')).toMatch(/gescheitert/)
  })

  it('sortiert die übrigen Mails mit der Worker-Rolle, ein zweiter Lauf hat nichts mehr zu tun', async () => {
    // Die erste Mail hat zwei Fehlversuche und bleibt liegen; nur die zweite wird sortiert.
    expect(await lauf(new FakeKiClient(sortierung))).toEqual({ sortiert: 1, fehler: 0 })
    expect(await lauf(new FakeKiClient())).toEqual({ sortiert: 0, fehler: 0 })
    const v = await withMandant(app.db, mandant, (tx) =>
      geltendeKiVorschlaege(tx, 'sortierung', ids),
    )
    expect([...v.keys()]).toEqual([ids[1]])
    expect(v.get(ids[1]!)?.ausgabe).toMatchObject({ kategorie: 'heizung_wasser' })
  })
})
