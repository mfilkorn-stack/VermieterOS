import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { aktuell, neueVersion } from '../src/ledger'
import { auftraegeZuTicket, legeAntwortAn } from '../src/post'
import { listeAlleDokumente } from '../src/dokumente'
import { withMandant } from '../src/mandant'
import { NUTZER, erwarteFehler, neuerMandant, verbindungen } from './helfer'

const v = verbindungen()
afterAll(() => v.close())

let a: string
let b: string
let objektA: string
let handwerkerA: string
let handwerkerB: string

const objekt = (m: string) =>
  withMandant(v.app, m, (tx) =>
    neueVersion(tx, {
      entitaet: 'objekt',
      mandantId: m,
      akteur: NUTZER,
      gueltigAb: '2024-01-01',
      identitaet: {},
      daten: { bezeichnung: 'Haus', art: 'haus' },
    }),
  )

const handwerker = (m: string, firma: string) =>
  withMandant(v.app, m, (tx) =>
    neueVersion(tx, {
      entitaet: 'handwerker',
      mandantId: m,
      akteur: NUTZER,
      gueltigAb: '2026-01-01',
      identitaet: {},
      daten: { firma, gewerke: ['heizung_sanitaer'], telefon: '0221 123456', notdienst: true },
    }),
  )

beforeAll(async () => {
  a = await neuerMandant(v.app, 'Betrieb A')
  b = await neuerMandant(v.app, 'Betrieb B')
  objektA = (await objekt(a)).identId
  handwerkerA = (await handwerker(a, 'Heizung Schmidt')).identId
  handwerkerB = (await handwerker(b, 'Fremdfirma')).identId
})

describe('Handwerker, Notfallkarte, Wissensbasis, Tickets', () => {
  it('Handwerker sind versioniert und je Mandant getrennt', async () => {
    const liste = await withMandant(v.app, a, (tx) =>
      tx.execute<{ firma: string }>(sql`SELECT firma FROM handwerker_aktuell`),
    )
    expect(liste.map((h) => h.firma)).toEqual(['Heizung Schmidt'])
    await erwarteFehler(
      () =>
        withMandant(v.app, a, (tx) =>
          neueVersion(tx, {
            entitaet: 'handwerker',
            mandantId: a,
            akteur: NUTZER,
            gueltigAb: '2026-01-01',
            identitaet: {},
            daten: { firma: 'Ohne Gewerk', gewerke: [] },
          }),
        ),
      /handwerker_gewerke_chk/,
    )
  })

  it('je Objekt genau eine Notfallkarte', async () => {
    const karte = (eintraege: unknown[]) =>
      withMandant(v.app, a, (tx) =>
        neueVersion(tx, {
          entitaet: 'notfallkarte',
          mandantId: a,
          akteur: NUTZER,
          gueltigAb: '2026-01-01',
          identitaet: { objektId: objektA },
          daten: { eintraege: eintraege as never },
        }),
      )
    await karte([{ art: 'heizung', auftragnehmerId: handwerkerA }])
    await erwarteFehler(() => karte([]), /notfallkarten_objekt_uq/)
  })

  it('Wissensartikel hängen am Objekt des eigenen Mandanten', async () => {
    await withMandant(v.app, a, (tx) =>
      neueVersion(tx, {
        entitaet: 'wissensartikel',
        mandantId: a,
        akteur: NUTZER,
        gueltigAb: '2026-01-01',
        identitaet: { objektId: objektA },
        daten: { titel: 'Hausordnung', kategorie: 'hausordnung', inhalt: 'Ruhezeiten beachten.' },
      }),
    )
    await erwarteFehler(
      () =>
        withMandant(v.app, b, (tx) =>
          neueVersion(tx, {
            entitaet: 'wissensartikel',
            mandantId: b,
            akteur: NUTZER,
            gueltigAb: '2026-01-01',
            identitaet: { objektId: objektA },
            daten: { titel: 'Fremd', kategorie: 'faq', inhalt: 'x' },
          }),
        ),
      /gehört nicht zum Mandanten/,
    )
  })

  it('Tickets: Statuswechsel als Version, fremder Handwerker und unbekannter Status scheitern', async () => {
    const t = await withMandant(v.app, a, (tx) =>
      neueVersion(tx, {
        entitaet: 'ticket',
        mandantId: a,
        akteur: NUTZER,
        gueltigAb: '2026-10-01',
        identitaet: { objektId: objektA },
        daten: { titel: 'Heizung kalt', status: 'gemeldet', prioritaet: 'notfall' },
      }),
    )
    await withMandant(v.app, a, (tx) =>
      neueVersion(tx, {
        entitaet: 'ticket',
        mandantId: a,
        akteur: NUTZER,
        gueltigAb: '2026-10-01',
        identId: t.identId,
        begruendung: 'Status: beauftragt',
        daten: {
          titel: 'Heizung kalt',
          status: 'beauftragt',
          prioritaet: 'notfall',
          auftragnehmerId: handwerkerA,
        },
      }),
    )
    const akt = await withMandant(v.app, a, (tx) => aktuell(tx, 'ticket', t.identId))
    expect(akt).toMatchObject({ status: 'beauftragt', auftragnehmerId: handwerkerA, versionNr: 2 })
    await erwarteFehler(
      () =>
        withMandant(v.app, a, (tx) =>
          neueVersion(tx, {
            entitaet: 'ticket',
            mandantId: a,
            akteur: NUTZER,
            gueltigAb: '2026-10-01',
            identId: t.identId,
            begruendung: 'falscher Handwerker',
            daten: { titel: 'Heizung kalt', status: 'beauftragt', auftragnehmerId: handwerkerB },
          }),
        ),
      /gehört nicht zum Mandanten/,
    )
    await erwarteFehler(
      () =>
        withMandant(v.app, a, (tx) =>
          neueVersion(tx, {
            entitaet: 'ticket',
            mandantId: a,
            akteur: NUTZER,
            gueltigAb: '2026-10-01',
            identId: t.identId,
            begruendung: 'x',
            daten: { titel: 'Heizung kalt', status: 'irgendwas' as never },
          }),
        ),
      /ticket_status_chk/,
    )
  })

  it('der Worker liest Notfallkarte, Handwerker und Wissensbasis für den KI-Kontext', async () => {
    const r = await withMandant(v.worker, a, (tx) =>
      tx.execute<{ n: number }>(sql`
        SELECT (SELECT count(*) FROM notfallkarten_aktuell)::int
             + (SELECT count(*) FROM handwerker_aktuell)::int
             + (SELECT count(*) FROM wissensartikel_aktuell)::int AS n`),
    )
    expect(r[0]?.n).toBe(3)
  })

  it('Handwerkerauftrag: am Ticket vermerkt; genau ein Bezug; Handwerker nur mit Ticket, nie fremd', async () => {
    const t = await withMandant(v.app, a, (tx) =>
      neueVersion(tx, {
        entitaet: 'ticket',
        mandantId: a,
        akteur: NUTZER,
        gueltigAb: '2026-10-01',
        identitaet: { objektId: objektA },
        daten: { titel: 'Wasserhahn tropft', status: 'gemeldet', prioritaet: 'normal' },
      }),
    )
    const basis = {
      mandantId: a,
      nachrichtId: null,
      ticketId: t.identId,
      handwerkerId: handwerkerA,
      mietverhaeltnisId: null,
      an: ['auftrag@example.org'],
      betreff: 'Auftrag: Wasserhahn tropft',
      text: 'Bitte reparieren.',
      messageId: '<auftrag-1@example.org>',
      akteur: NUTZER,
    }
    await withMandant(v.app, a, (tx) => legeAntwortAn(tx, basis))
    const liste = await withMandant(v.app, a, (tx) => auftraegeZuTicket(tx, t.identId))
    expect(liste.map((x) => x.betreff)).toEqual(['Auftrag: Wasserhahn tropft'])
    expect(await withMandant(v.app, b, (tx) => auftraegeZuTicket(tx, t.identId))).toEqual([])
    await erwarteFehler(
      () =>
        withMandant(v.app, a, (tx) => legeAntwortAn(tx, { ...basis, handwerkerId: handwerkerB })),
      /gehört nicht zum Mandanten/,
    )
    await erwarteFehler(
      () =>
        withMandant(v.app, a, (tx) =>
          legeAntwortAn(tx, { ...basis, ticketId: null, portalNachrichtId: null }),
        ),
      /antworten_bezug_chk|antworten_handwerker_chk/,
    )
  })

  it('Dokumentliste über alle Objekte: Ort aus Objekt oder Ticket, ohne Belege', async () => {
    const t = await withMandant(v.app, a, (tx) =>
      neueVersion(tx, {
        entitaet: 'ticket',
        mandantId: a,
        akteur: NUTZER,
        gueltigAb: '2026-10-01',
        identitaet: { objektId: objektA },
        daten: { titel: 'Fenster klemmt', status: 'gemeldet', prioritaet: 'normal' },
      }),
    )
    const dok = (titel: string, identitaet: Record<string, unknown>, typ = 'sonstiges') =>
      withMandant(v.app, a, (tx) =>
        neueVersion(tx, {
          entitaet: 'dokument',
          mandantId: a,
          akteur: NUTZER,
          gueltigAb: '2026-10-01',
          identitaet: {
            objektId: null,
            mietverhaeltnisId: null,
            ticketId: null,
            beleg: false,
            anhangId: null,
            dateiHash: 'a'.repeat(64),
            speicherSchluessel: 'dok/' + titel,
            dateiname: titel + '.pdf',
            mime: 'application/pdf',
            groesseBytes: 100,
            ...identitaet,
          } as never,
          daten: { typ, status: 'gueltig', titel } as never,
        }),
      )
    await dok('Grundriss', { objektId: objektA })
    await dok('Foto Fenster', { objektId: objektA, ticketId: t.identId }, 'mangelfoto')
    await dok('Rechnung', { objektId: objektA, beleg: true }, 'beleg')
    const liste = await withMandant(v.app, a, (tx) => listeAlleDokumente(tx))
    const titel = liste.map((d) => d.titel)
    expect(titel).toContain('Grundriss')
    expect(titel).toContain('Foto Fenster')
    expect(titel).not.toContain('Rechnung')
    expect(liste.find((d) => d.titel === 'Grundriss')?.ortObjektId).toBe(objektA)
    expect(liste.find((d) => d.titel === 'Grundriss')?.ort).toBe('Haus')
    expect(await withMandant(v.app, b, (tx) => listeAlleDokumente(tx))).toEqual([])
  })
})
