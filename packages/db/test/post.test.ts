import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { pruefeKette, neueVersion } from '../src/ledger'
import { withMandant } from '../src/mandant'
import {
  aktivePostfaecherAllerMandanten,
  ladeAnhangZumHerunterladen,
  ladeNachricht,
  ladePosteingang,
  ladeVerlauf,
  ladeZuordnungsKandidaten,
  legeAntwortAn,
  legeTelefonnotizAn,
  legeNachrichtAn,
  legePostfachAn,
  listePostfaecher,
  offeneNachrichten,
  ordneNachrichtZu,
  zuordnungImVerlauf,
  type NeueNachricht,
} from '../src/post'
import { nachrichten, objekte, postfaecher } from '../src/schema/index'
import type { Akteur } from '../src/schema/index'
import { NUTZER, erwarteFehler, neuerMandant, verbindungen } from './helfer'

const v = verbindungen()
afterAll(() => v.close())
const SYSTEM: Akteur = { art: 'system', id: 'worker' }

let a: string
let b: string
let postfachA: string
let postfachB: string
let mvA: string
let mvB: string

async function mietverhaeltnis(mandant: string, email: string, einheit: string): Promise<string> {
  return withMandant(v.app, mandant, async (tx) => {
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
      daten: { bezeichnung: einheit },
    })
    const p = await neueVersion(tx, {
      entitaet: 'person',
      mandantId: mandant,
      akteur: NUTZER,
      gueltigAb: '2024-01-01',
      identitaet: {},
      daten: { rolle: 'mieter', nachname: 'Mieterin', email },
    })
    const mv = await neueVersion(tx, {
      entitaet: 'mietverhaeltnis',
      mandantId: mandant,
      akteur: NUTZER,
      gueltigAb: '2024-01-01',
      identitaet: { einheitId: e.identId },
      daten: { beginn: '2024-01-01', mieterIds: [p.identId] },
    })
    return mv.identId
  })
}

function nachricht(
  mandant: string,
  postfach: string,
  n: Partial<NeueNachricht> = {},
): NeueNachricht {
  const sha = (n.roh?.sha256 ?? Math.random().toString(16).slice(2)).padEnd(64, '0')
  return {
    mandantId: mandant,
    postfachId: postfach,
    uidValidity: 1,
    imapUid: 1,
    messageId: null,
    inReplyTo: null,
    referenzen: [],
    vonAdresse: 'Mieterin@Example.org',
    vonName: 'Mieterin',
    an: ['vermieter@example.org'],
    betreff: 'Heizung',
    gesendetAm: '2026-10-01T08:00:00Z',
    text: 'Die Heizung ist kalt.',
    anhaenge: [],
    ...n,
    roh: { schluessel: `mandanten/${mandant}/roh/${sha}.eml`, sha256: sha, groesse: 100, ...n.roh },
  }
}

beforeAll(async () => {
  a = await neuerMandant(v.app, 'Post A')
  b = await neuerMandant(v.app, 'Post B')
  const pf = (m: string) => ({
    mandantId: m,
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
  postfachA = await withMandant(v.app, a, (tx) => legePostfachAn(tx, pf(a)))
  postfachB = await withMandant(v.app, b, (tx) => legePostfachAn(tx, pf(b)))
  mvA = await mietverhaeltnis(a, 'Mieterin@Example.org', 'EG links')
  mvB = await mietverhaeltnis(b, 'andere@example.org', 'OG')
})

describe('Postfächer', () => {
  it('App-Rolle kann das verschlüsselte Passwort nicht lesen', async () => {
    await erwarteFehler(
      () => withMandant(v.app, a, (tx) => tx.select().from(postfaecher)),
      /permission denied/,
    )
    const liste = await withMandant(v.app, a, (tx) => listePostfaecher(tx))
    expect(liste.map((p) => p.id)).toEqual([postfachA])
  })

  it('Worker sieht Postfächer aller Mandanten, die App nur die eigenen', async () => {
    const alle = await aktivePostfaecherAllerMandanten(v.worker)
    expect(alle.map((p) => p.id)).toEqual(expect.arrayContaining([postfachA, postfachB]))
    const ohneKontext = await v.app.execute(sql`select id from postfaecher`)
    expect(ohneKontext).toHaveLength(0)
  })

  it('Worker liest ohne Mandantenkontext keine Nachrichten und schreibt keine Stammdaten', async () => {
    await withMandant(v.worker, a, (tx) => legeNachrichtAn(tx, nachricht(a, postfachA), SYSTEM))
    expect(await v.worker.select().from(nachrichten)).toHaveLength(0)
    await erwarteFehler(
      () => withMandant(v.worker, a, (tx) => tx.insert(objekte).values({ id: mvA, mandantId: a })),
      /permission denied/,
    )
  })

  it('Postfächer werden nicht gelöscht', async () => {
    await erwarteFehler(
      () => v.owner.execute(sql`delete from postfaecher where id = ${postfachA}`),
      /erlaubt kein DELETE/,
    )
  })
})

describe('Nachrichten', () => {
  it('dieselbe Rohmail im selben Postfach wird nur einmal angelegt', async () => {
    const n = nachricht(a, postfachA, { roh: { sha256: 'abc', schluessel: 'x', groesse: 1 } })
    const erst = await withMandant(v.worker, a, (tx) => legeNachrichtAn(tx, n, SYSTEM))
    const zweit = await withMandant(v.worker, a, (tx) => legeNachrichtAn(tx, n, SYSTEM))
    expect(erst).not.toBeNull()
    expect(zweit).toBeNull()
  })

  it('Anhänge, Ledger-Ereignis, Kette intakt, append-only', async () => {
    const id = await withMandant(v.worker, a, (tx) =>
      legeNachrichtAn(
        tx,
        nachricht(a, postfachA, {
          anhaenge: [
            {
              dateiname: 'foto.jpg',
              mimeTyp: 'image/jpeg',
              groesse: 3,
              sha256: 'f'.repeat(64),
              schluessel: 'k',
            },
          ],
        }),
        SYSTEM,
      ),
    )
    const [eintrag] = await withMandant(v.app, a, (tx) => ladePosteingang(tx, { limit: 1 }))
    expect(eintrag?.id).toBe(id)
    expect(eintrag?.vonAdresse).toBe('mieterin@example.org')
    expect(eintrag?.anhaenge).toEqual([
      { dateiname: 'foto.jpg', groesse: 3, sha256: 'f'.repeat(64) },
    ])
    const kette = await withMandant(v.app, a, (tx) => pruefeKette(tx, a))
    expect(kette.ok).toBe(true)
    await erwarteFehler(
      () => v.owner.execute(sql`update nachrichten set betreff = 'x' where id = ${id}`),
      /append-only|erlaubt kein/,
    )
  })

  it('Nachricht in fremdes Postfach wird abgewiesen', async () => {
    await erwarteFehler(
      () => withMandant(v.worker, a, (tx) => legeNachrichtAn(tx, nachricht(a, postfachB), SYSTEM)),
      /gehört nicht zum Mandanten/,
    )
  })
})

describe('Zuordnung', () => {
  it('Kandidaten mit Mieter-Adresse, Einheit und Objekt', async () => {
    const k = await withMandant(v.worker, a, (tx) => ladeZuordnungsKandidaten(tx))
    expect(k).toEqual([
      expect.objectContaining({
        mietverhaeltnisId: mvA,
        mieterEmails: ['mieterin@example.org'],
        einheit: 'EG links',
        objekt: 'Haus am Park',
      }),
    ])
  })

  it('jüngste Zuordnung gilt, Verlauf über Message-ID, offen zählt nur Unzugeordnete', async () => {
    const id = (await withMandant(v.worker, a, (tx) =>
      legeNachrichtAn(tx, nachricht(a, postfachA, { messageId: '<m1@example.org>' }), SYSTEM),
    ))!
    const offenVorher = await withMandant(v.app, a, (tx) => offeneNachrichten(tx))
    await withMandant(v.worker, a, (tx) =>
      ordneNachrichtZu(tx, {
        mandantId: a,
        nachrichtId: id,
        mietverhaeltnisId: mvA,
        art: 'absender',
        akteur: SYSTEM,
      }),
    )
    expect(await withMandant(v.app, a, (tx) => offeneNachrichten(tx))).toBe(offenVorher - 1)
    expect(await withMandant(v.app, a, (tx) => zuordnungImVerlauf(tx, ['<m1@example.org>']))).toBe(
      mvA,
    )

    await withMandant(v.app, a, (tx) =>
      ordneNachrichtZu(tx, {
        mandantId: a,
        nachrichtId: id,
        mietverhaeltnisId: null,
        art: 'aufgehoben',
        begruendung: 'falsch zugeordnet',
        akteur: NUTZER,
      }),
    )
    const [e] = (await withMandant(v.app, a, (tx) => ladePosteingang(tx))).filter(
      (x) => x.id === id,
    )
    expect(e?.zuordnung).toEqual({
      mietverhaeltnisId: null,
      art: 'aufgehoben',
      begruendung: 'falsch zugeordnet',
    })
    expect(await withMandant(v.app, a, (tx) => offeneNachrichten(tx))).toBe(offenVorher)
  })

  it('manuelle Zuordnung nur durch Nutzer, nie auf fremdes Mietverhältnis', async () => {
    const id = (await withMandant(v.worker, a, (tx) =>
      legeNachrichtAn(tx, nachricht(a, postfachA), SYSTEM),
    ))!
    await erwarteFehler(
      () =>
        withMandant(v.worker, a, (tx) =>
          ordneNachrichtZu(tx, {
            mandantId: a,
            nachrichtId: id,
            mietverhaeltnisId: mvA,
            art: 'manuell',
            akteur: SYSTEM,
          }),
        ),
      /nachricht_zuordnungen_manuell_chk/,
    )
    await erwarteFehler(
      () =>
        withMandant(v.app, a, (tx) =>
          ordneNachrichtZu(tx, {
            mandantId: a,
            nachrichtId: id,
            mietverhaeltnisId: mvB,
            art: 'manuell',
            akteur: NUTZER,
          }),
        ),
      /gehört nicht zum Mandanten/,
    )
  })
})

describe('Nachricht im Detail, Suche', () => {
  it('Detail mit Anhängen und vollständigem Zuordnungsverlauf; Anhang nur im eigenen Mandanten', async () => {
    const id = (await withMandant(v.worker, a, (tx) =>
      legeNachrichtAn(
        tx,
        nachricht(a, postfachA, {
          betreff: 'Rauchmelder piept',
          anhaenge: [
            {
              dateiname: 'video.mp4',
              mimeTyp: 'video/mp4',
              groesse: 9,
              sha256: 'e'.repeat(64),
              schluessel: 'k2',
            },
          ],
        }),
        SYSTEM,
      ),
    ))!
    await withMandant(v.worker, a, (tx) =>
      ordneNachrichtZu(tx, {
        mandantId: a,
        nachrichtId: id,
        mietverhaeltnisId: mvA,
        art: 'absender',
        akteur: SYSTEM,
      }),
    )
    await withMandant(v.app, a, (tx) =>
      ordneNachrichtZu(tx, {
        mandantId: a,
        nachrichtId: id,
        mietverhaeltnisId: mvA,
        art: 'manuell',
        begruendung: 'bestätigt',
        akteur: NUTZER,
      }),
    )
    const d = await withMandant(v.app, a, (tx) => ladeNachricht(tx, id))
    expect(d?.betreff).toBe('Rauchmelder piept')
    expect(d?.zuordnungen.map((z) => z.art)).toEqual(['absender', 'manuell'])
    const anhangId = d!.anhaenge[0]!.id
    expect(
      await withMandant(v.app, a, (tx) => ladeAnhangZumHerunterladen(tx, anhangId)),
    ).toMatchObject({
      schluessel: 'k2',
      dateiname: 'video.mp4',
    })
    expect(await withMandant(v.app, b, (tx) => ladeAnhangZumHerunterladen(tx, anhangId))).toBeNull()
    expect(await withMandant(v.app, b, (tx) => ladeNachricht(tx, id))).toBeNull()
  })

  it('Suche über Betreff, Absender und Text; Platzhalter werden nicht ausgewertet', async () => {
    const treffer = await withMandant(v.app, a, (tx) =>
      ladePosteingang(tx, { suche: 'rauchmelder' }),
    )
    expect(treffer.map((t) => t.betreff)).toEqual(['Rauchmelder piept'])
    expect(await withMandant(v.app, a, (tx) => ladePosteingang(tx, { suche: '%' }))).toEqual([])
    expect(
      await withMandant(v.app, b, (tx) => ladePosteingang(tx, { suche: 'rauchmelder' })),
    ).toEqual([])
  })
})

describe('Telefonnotizen und Verlauf', () => {
  it('Verlauf mischt Mails und Notizen chronologisch; Korrektur ersetzt die alte Notiz', async () => {
    const alt = await withMandant(v.app, a, (tx) =>
      legeTelefonnotizAn(tx, {
        mandantId: a,
        mietverhaeltnisId: mvA,
        zeitpunkt: '2026-10-02T09:00:00Z',
        richtung: 'eingehend',
        gespraechspartner: 'Mieterin',
        betreff: 'Heizung',
        inhalt: 'Ruft wegen der Heizung an, Termin Mittwoch.',
        akteur: NUTZER,
      }),
    )
    await withMandant(v.app, a, (tx) =>
      legeTelefonnotizAn(tx, {
        mandantId: a,
        mietverhaeltnisId: mvA,
        zeitpunkt: '2026-10-02T09:00:00Z',
        richtung: 'eingehend',
        gespraechspartner: 'Mieterin',
        betreff: 'Heizung',
        inhalt: 'Ruft wegen der Heizung an, Termin Donnerstag.',
        ersetztId: alt,
        akteur: NUTZER,
      }),
    )
    const verlauf = await withMandant(v.app, a, (tx) => ladeVerlauf(tx, mvA))
    const notizen = verlauf.filter((e) => e.art === 'telefonnotiz')
    expect(notizen).toHaveLength(1)
    expect(notizen[0]).toMatchObject({
      inhalt: 'Ruft wegen der Heizung an, Termin Donnerstag.',
      korrigiert: true,
    })
    expect(verlauf.some((e) => e.art === 'nachricht' && e.betreff === 'Rauchmelder piept')).toBe(
      true,
    )
    const zeiten = verlauf.map((e) => e.zeitpunkt)
    expect([...zeiten].sort().reverse()).toEqual(zeiten)
    expect((await withMandant(v.app, a, (tx) => pruefeKette(tx, a))).ok).toBe(true)
  })

  it('eine Notiz wird nur einmal ersetzt; append-only; nur Nutzer; nie fremdes Mietverhältnis', async () => {
    const basis = {
      mandantId: a,
      mietverhaeltnisId: mvA,
      zeitpunkt: '2026-10-03T10:00:00Z',
      richtung: 'ausgehend' as const,
      gespraechspartner: 'Mieterin',
      betreff: 'Rückruf',
      inhalt: 'Zurückgerufen.',
      akteur: NUTZER,
    }
    const id = await withMandant(v.app, a, (tx) => legeTelefonnotizAn(tx, basis))
    await withMandant(v.app, a, (tx) => legeTelefonnotizAn(tx, { ...basis, ersetztId: id }))
    await erwarteFehler(
      () => withMandant(v.app, a, (tx) => legeTelefonnotizAn(tx, { ...basis, ersetztId: id })),
      /telefonnotizen_ersetzt_uq/,
    )
    await erwarteFehler(
      () => v.owner.execute(sql`update telefonnotizen set inhalt = 'x' where id = ${id}`),
      /append-only|erlaubt kein/,
    )
    await erwarteFehler(
      () => withMandant(v.app, a, (tx) => legeTelefonnotizAn(tx, { ...basis, akteur: SYSTEM })),
      /telefonnotizen_akteur_chk/,
    )
    await erwarteFehler(
      () =>
        withMandant(v.app, a, (tx) => legeTelefonnotizAn(tx, { ...basis, mietverhaeltnisId: mvB })),
      /gehört nicht zum Mandanten/,
    )
    expect(await withMandant(v.app, b, (tx) => ladeVerlauf(tx, mvA))).toEqual([])
  })
})

describe('Antworten aus der App', () => {
  it('Antwort steht mit Text im Verlauf; append-only; nur Nutzer; nie fremdes Mietverhältnis', async () => {
    const nachrichtId = (await withMandant(v.worker, a, (tx) =>
      legeNachrichtAn(tx, nachricht(a, postfachA, { betreff: 'Fenster klemmt' }), SYSTEM),
    ))!
    const basis = {
      mandantId: a,
      nachrichtId,
      mietverhaeltnisId: mvA,
      an: ['mieterin@example.org'],
      betreff: 'Re: Fenster klemmt',
      text: 'Der Handwerker kommt Dienstag.',
      messageId: '<antwort-1@example.org>',
      akteur: NUTZER,
    }
    const id = await withMandant(v.app, a, (tx) => legeAntwortAn(tx, basis))
    const verlauf = await withMandant(v.app, a, (tx) => ladeVerlauf(tx, mvA))
    expect(verlauf.find((e) => e.art === 'antwort')).toMatchObject({
      id,
      nachrichtId,
      betreff: 'Re: Fenster klemmt',
      an: ['mieterin@example.org'],
      text: 'Der Handwerker kommt Dienstag.',
    })
    await erwarteFehler(
      () => v.owner.execute(sql`update antworten set text = 'x' where id = ${id}`),
      /append-only|erlaubt kein/,
    )
    await erwarteFehler(
      () => withMandant(v.app, a, (tx) => legeAntwortAn(tx, { ...basis, akteur: SYSTEM })),
      /antworten_akteur_chk/,
    )
    await erwarteFehler(
      () => withMandant(v.app, a, (tx) => legeAntwortAn(tx, { ...basis, mietverhaeltnisId: mvB })),
      /gehört nicht zum Mandanten/,
    )
    expect(
      (await withMandant(v.app, b, (tx) => ladeVerlauf(tx, mvA))).filter(
        (e) => e.art === 'antwort',
      ),
    ).toEqual([])
  })
})
