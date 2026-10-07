import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { neueVersion } from '../src/ledger'
import { withMandant } from '../src/mandant'
import {
  legePortalNachrichtAn,
  legePortalZugangAn,
  portalAbmelden,
  portalAnmelden,
  portalLinksAnfordern,
  portalLinkFuerZugang,
  portalNachrichtenZuMv,
  portalSitzung,
  portalZugaengeZuMv,
  widerrufePortalZugang,
} from '../src/portal'
import { NUTZER, erwarteFehler, neuerMandant, verbindungen } from './helfer'

const v = verbindungen()
afterAll(() => v.close())

async function mietverhaeltnis(m: string, nachname: string) {
  return withMandant(v.app, m, async (tx) => {
    const neu = <E extends Parameters<typeof neueVersion>[1]['entitaet']>(
      entitaet: E,
      identitaet: object,
      daten: object,
    ) =>
      neueVersion(tx, {
        entitaet,
        mandantId: m,
        akteur: NUTZER,
        gueltigAb: '2024-01-01',
        identitaet,
        daten,
      } as never)
    const o = await neu('objekt', {}, { bezeichnung: 'Haus', art: 'haus' })
    const e = await neu('einheit', { objektId: o.identId }, { bezeichnung: 'EG' })
    const p = await neu('person', {}, { rolle: 'mieter', nachname })
    const mv = await neu(
      'mietverhaeltnis',
      { einheitId: e.identId },
      { beginn: '2024-01-01', mieterIds: [p.identId] },
    )
    return { mv: mv.identId, person: p.identId }
  })
}

let a: string
let b: string
let mvA: { mv: string; person: string }
let zugang: string
const EMAIL = `mieterin.${Date.now()}@example.org`

beforeAll(async () => {
  a = await neuerMandant(v.app, 'Portal A')
  b = await neuerMandant(v.app, 'Portal B')
  mvA = await mietverhaeltnis(a, 'Beispiel')
  zugang = await withMandant(v.app, a, (tx) =>
    legePortalZugangAn(tx, {
      mandantId: a,
      mietverhaeltnisId: mvA.mv,
      personId: mvA.person,
      email: `  ${EMAIL.toUpperCase()} `,
      akteur: NUTZER,
    }),
  )
})

describe('Mieterportal: Anmeldung', () => {
  it('Einmal-Link → Sitzung → Mietverhältnis; derselbe Link nur einmal', async () => {
    const links = await portalLinksAnfordern(v.app, EMAIL.toUpperCase(), 15)
    expect(links).toHaveLength(1)
    expect(links[0]).toMatchObject({ zugangId: zugang, mandantId: a })
    const s = await portalAnmelden(v.app, links[0]!.token, 30)
    expect(s).not.toBeNull()
    expect(await portalSitzung(v.app, s!.sitzung)).toMatchObject({
      mandantId: a,
      mietverhaeltnisId: mvA.mv,
      personId: mvA.person,
      email: EMAIL,
    })
    expect(await portalAnmelden(v.app, links[0]!.token, 30)).toBeNull()
    expect(await portalSitzung(v.app, 'erfunden')).toBeNull()
    await portalAbmelden(v.app, s!.sitzung)
    expect(await portalSitzung(v.app, s!.sitzung)).toBeNull()
  })

  it('unbekannte Adresse: keine Links, keine Auskunft', async () => {
    expect(await portalLinksAnfordern(v.app, 'niemand@example.org', 15)).toEqual([])
  })

  it('höchstens fünf Links je Zugang in 15 Minuten', async () => {
    const m = await neuerMandant(v.app, 'Begrenzung')
    const x = await mietverhaeltnis(m, 'Viel')
    const mail = `viel.${Date.now()}@example.org`
    await withMandant(v.app, m, (tx) =>
      legePortalZugangAn(tx, {
        mandantId: m,
        mietverhaeltnisId: x.mv,
        personId: x.person,
        email: mail,
        akteur: NUTZER,
      }),
    )
    const anzahl = []
    for (let i = 0; i < 7; i++) anzahl.push((await portalLinksAnfordern(v.app, mail, 15)).length)
    expect(anzahl).toEqual([1, 1, 1, 1, 1, 0, 0])
  })

  it('Widerruf beendet Sitzungen und verhindert neue Links', async () => {
    const m = await neuerMandant(v.app, 'Widerruf')
    const x = await mietverhaeltnis(m, 'Weg')
    const mail = `weg.${Date.now()}@example.org`
    const id = await withMandant(v.app, m, (tx) =>
      legePortalZugangAn(tx, {
        mandantId: m,
        mietverhaeltnisId: x.mv,
        personId: x.person,
        email: mail,
        akteur: NUTZER,
      }),
    )
    const [l] = await portalLinksAnfordern(v.app, mail, 15)
    const offen = await portalLinksAnfordern(v.app, mail, 15)
    const s = await portalAnmelden(v.app, l!.token, 30)
    await withMandant(v.app, m, (tx) =>
      widerrufePortalZugang(tx, { mandantId: m, id, akteur: NUTZER }),
    )
    expect(await portalSitzung(v.app, s!.sitzung)).toBeNull()
    expect(await portalAnmelden(v.app, offen[0]!.token, 30)).toBeNull()
    expect(await portalLinksAnfordern(v.app, mail, 15)).toEqual([])
    // Ein widerrufener Zugang bleibt widerrufen; ändern lässt sich sonst nichts.
    await erwarteFehler(
      () =>
        withMandant(v.app, m, (tx) =>
          tx.execute(sql`UPDATE portal_zugaenge SET widerrufen_am = NULL WHERE id = ${id}`),
        ),
      /nur ein einmaliger Widerruf/,
    )
    await erwarteFehler(
      () =>
        withMandant(v.app, m, (tx) =>
          tx.execute(sql`UPDATE portal_zugaenge SET email = 'x@example.org' WHERE id = ${id}`),
        ),
      /permission denied/,
    )
  })
})

describe('Mieterportal: Rechte und Trennung', () => {
  it('die App-Rolle sieht weder Tokens noch Sitzungen', async () => {
    await erwarteFehler(() => v.app.execute(sql`SELECT * FROM portal_tokens`), /permission denied/)
    await erwarteFehler(
      () => v.app.execute(sql`SELECT * FROM portal_sitzungen`),
      /permission denied/,
    )
  })

  it('Zugänge und Nachrichten sind je Mandant getrennt', async () => {
    expect(await withMandant(v.app, b, (tx) => portalZugaengeZuMv(tx, mvA.mv))).toEqual([])
    expect(await withMandant(v.app, a, (tx) => portalZugaengeZuMv(tx, mvA.mv))).toHaveLength(1)
    const [l] = await portalLinksAnfordern(v.app, EMAIL, 15)
    const s = (await portalSitzung(v.app, (await portalAnmelden(v.app, l!.token, 30))!.sitzung))!
    await withMandant(v.app, a, (tx) =>
      legePortalNachrichtAn(tx, { s, betreff: 'Frage', text: 'Wann kommt der Schornsteinfeger?' }),
    )
    const liste = await withMandant(v.app, a, (tx) => portalNachrichtenZuMv(tx, mvA.mv))
    expect(liste.map((n) => n.betreff)).toEqual(['Frage'])
    expect(await withMandant(v.app, b, (tx) => portalNachrichtenZuMv(tx, mvA.mv))).toEqual([])
    // Eine Sitzung aus Mandant A kann nicht in Mandant B schreiben.
    await erwarteFehler(
      () =>
        withMandant(v.app, b, (tx) => legePortalNachrichtAn(tx, { s, betreff: 'x', text: 'y' })),
      /row-level security|gehört nicht zum Mandanten/,
    )
  })

  it('Einladungslinks nur für Zugänge des eigenen Mandanten', async () => {
    expect(await withMandant(v.app, b, (tx) => portalLinkFuerZugang(tx, zugang, 60))).toBeNull()
    const t = await withMandant(v.app, a, (tx) => portalLinkFuerZugang(tx, zugang, 60))
    expect(t).not.toBeNull()
    expect((await portalAnmelden(v.app, t!, 30))?.zugangId).toBe(zugang)
  })

  it('ein Zugang braucht ein Mietverhältnis des eigenen Mandanten', async () => {
    await erwarteFehler(
      () =>
        withMandant(v.app, b, (tx) =>
          legePortalZugangAn(tx, {
            mandantId: b,
            mietverhaeltnisId: mvA.mv,
            personId: mvA.person,
            email: 'fremd@example.org',
            akteur: NUTZER,
          }),
        ),
      /gehört nicht zum Mandanten/,
    )
  })
})
