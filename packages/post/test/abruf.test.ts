import {
  createDb,
  ladeBeleg,
  ladePosteingang,
  listeBelege,
  legeMandantAn,
  legePostfachAn,
  neueVersion,
  pruefeKette,
  withMandant,
} from '@vermieteros/db'
import { sql } from 'drizzle-orm'
import { ImapFlow } from 'imapflow'
import { randomBytes } from 'node:crypto'
import nodemailer from 'nodemailer'
import { v7 as uuidv7 } from 'uuid'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { rufeAlleAb, rufePostfachAb } from '../src/abruf'
import { verschluessele } from '../src/geheimnis'
import { s3Speicher, sha256 } from '../src/speicher'

/**
 * Integration gegen echte Dienste (ops/testdienste.sh): GreenMail (SMTP 3025, IMAP 3143) und
 * S3 (rclone, 9100). Jede Testdatei nutzt ein eigenes Postfach, damit Läufe sich nicht stören.
 */
const IMAP = { host: '127.0.0.1', port: 3143 }
const SMTP = { host: '127.0.0.1', port: 3025 }
const nutzer = { art: 'nutzer', id: 'test' } as const

const app = createDb(inject('appUrl'), { max: 2 })
const worker = createDb(inject('workerUrl'), { max: 2 })
const owner = createDb(inject('ownerUrl'), { max: 1 })
const schluessel = randomBytes(32)
const speicher = s3Speicher({
  endpoint: 'http://127.0.0.1:9100',
  region: 'eu-central',
  bucket: `test-${Date.now()}`,
  accessKey: 'test',
  secretKey: 'test-geheim',
})
const ctx = { db: worker.db, speicher, schluessel }
const adresse = `vermietung-${Date.now()}@example.org`
const smtp = nodemailer.createTransport({ ...SMTP, secure: false, ignoreTLS: true })

let mandant: string
let postfach: string
let mv: string

afterAll(async () => {
  await Promise.all([app.close(), worker.close(), owner.close()])
  smtp.close()
})

beforeAll(async () => {
  await speicher.bucketSicherstellen()
  mandant = uuidv7()
  await withMandant(app.db, mandant, async (tx) => {
    await legeMandantAn(tx, { id: mandant, name: 'Abruf', art: 'allein', akteur: nutzer })
    const o = await neueVersion(tx, {
      entitaet: 'objekt',
      mandantId: mandant,
      akteur: nutzer,
      gueltigAb: '2024-01-01',
      identitaet: {},
      daten: { bezeichnung: 'Haus', art: 'haus' },
    })
    const e = await neueVersion(tx, {
      entitaet: 'einheit',
      mandantId: mandant,
      akteur: nutzer,
      gueltigAb: '2024-01-01',
      identitaet: { objektId: o.identId },
      daten: { bezeichnung: 'EG' },
    })
    const p = await neueVersion(tx, {
      entitaet: 'person',
      mandantId: mandant,
      akteur: nutzer,
      gueltigAb: '2024-01-01',
      identitaet: {},
      daten: { rolle: 'mieter', nachname: 'Mieterin', email: 'mieterin@example.org' },
    })
    const m = await neueVersion(tx, {
      entitaet: 'mietverhaeltnis',
      mandantId: mandant,
      akteur: nutzer,
      gueltigAb: '2024-01-01',
      identitaet: { einheitId: e.identId },
      daten: { beginn: '2024-01-01', mieterIds: [p.identId] },
    })
    mv = m.identId
    postfach = await legePostfachAn(tx, {
      mandantId: mandant,
      bezeichnung: 'Vermietung',
      host: IMAP.host,
      port: IMAP.port,
      tls: false,
      benutzer: adresse,
      passwortChiffre: verschluessele('beliebig', schluessel),
      ordner: 'INBOX',
      abrufAb: '2020-01-01',
      akteur: nutzer,
    })
  })

  await smtp.sendMail({
    from: 'Mieterin <Mieterin@Example.org>',
    to: adresse,
    subject: 'Heizung kalt',
    messageId: '<eins@example.org>',
    text: 'Seit gestern ist die Heizung kalt.',
    attachments: [
      { filename: 'thermostat.jpg', content: Buffer.from('bild'), contentType: 'image/jpeg' },
    ],
  })
  await smtp.sendMail({
    from: 'Heizungsbau <service@heizung.example>',
    to: adresse,
    subject: 'Re: Heizung kalt',
    messageId: '<zwei@example.org>',
    inReplyTo: '<eins@example.org>',
    references: ['<eins@example.org>'],
    text: 'Wir kommen morgen.',
  })
  await smtp.sendMail({
    from: 'Unbekannt <werbung@example.net>',
    to: adresse,
    subject: 'Angebot',
    text: 'Kaufen Sie jetzt.',
  })
})

describe('Abruf', () => {
  it('legt Nachrichten an, ordnet über Absender und Verlauf zu, lässt Unbekanntes offen', async () => {
    const [r] = (await rufeAlleAb(ctx)).filter((x) => x.postfachId === postfach)
    expect(r).toEqual({
      postfachId: postfach,
      neu: 3,
      doppelt: 0,
      zugeordnet: 2,
      belege: 0,
      fehler: null,
    })

    const eingang = await withMandant(app.db, mandant, (tx) => ladePosteingang(tx))
    const nach = (betreff: string) => eingang.find((e) => e.betreff === betreff)
    expect(nach('Heizung kalt')?.zuordnung).toMatchObject({
      mietverhaeltnisId: mv,
      art: 'absender',
    })
    expect(nach('Re: Heizung kalt')?.zuordnung).toMatchObject({
      mietverhaeltnisId: mv,
      art: 'verlauf',
    })
    expect(nach('Angebot')?.zuordnung).toBeNull()
    expect(nach('Heizung kalt')?.anhaenge).toEqual([
      { dateiname: 'thermostat.jpg', groesse: 4, sha256: sha256(Buffer.from('bild')) },
    ])
    expect((await withMandant(app.db, mandant, (tx) => pruefeKette(tx, mandant))).ok).toBe(true)
  })

  it('Rohmail und Anhang liegen prüfbar im Object Storage', async () => {
    const rows = await owner.db.execute<{
      roh_schluessel: string
      roh_sha256: string
      text: string
    }>(
      sql`select roh_schluessel, roh_sha256, text from nachrichten
          where postfach_id = ${postfach} and betreff = 'Heizung kalt'`,
    )
    const r = rows[0]!
    const roh = await speicher.holen(r.roh_schluessel)
    expect(sha256(roh)).toBe(r.roh_sha256)
    expect(roh.toString()).toContain('Subject: Heizung kalt')
  })

  it('zweiter Lauf holt nichts doppelt; das Postfach bleibt ungelesen', async () => {
    const r = await rufePostfachAb(ctx, { id: postfach, mandantId: mandant })
    expect(r).toMatchObject({ neu: 0, doppelt: 0, fehler: null })

    const c = new ImapFlow({
      ...IMAP,
      secure: false,
      auth: { user: adresse, pass: 'x' },
      logger: false,
    })
    await c.connect()
    await c.mailboxOpen('INBOX', { readOnly: true })
    const flags: string[][] = []
    for await (const m of c.fetch('1:*', { flags: true })) flags.push([...(m.flags ?? [])])
    await c.logout()
    expect(flags).toHaveLength(3)
    expect(flags.flat()).not.toContain('\\Seen')
  })

  it('neue UIDVALIDITY: alles wird neu gelesen, aber über die Prüfsumme nicht doppelt angelegt', async () => {
    await owner.db.execute(
      sql`update postfaecher set uid_validity = 1, letzte_uid = 0 where id = ${postfach}`,
    )
    const r = await rufePostfachAb(ctx, { id: postfach, mandantId: mandant })
    expect(r).toMatchObject({ neu: 0, doppelt: 3, fehler: null })
  })

  it('nicht erreichbarer Server: Fehler am Postfach vermerkt, nächster Lauf setzt ihn zurück', async () => {
    await owner.db.execute(sql`update postfaecher set port = 1 where id = ${postfach}`)
    const r = await rufePostfachAb(ctx, { id: postfach, mandantId: mandant })
    expect(r.fehler).toBeTruthy()
    const [pf] = await owner.db.execute<{ letzter_fehler: string | null }>(
      sql`select letzter_fehler from postfaecher where id = ${postfach}`,
    )
    expect(pf?.letzter_fehler).toBe(r.fehler)

    await owner.db.execute(sql`update postfaecher set port = ${IMAP.port} where id = ${postfach}`)
    const ok = await rufePostfachAb(ctx, { id: postfach, mandantId: mandant })
    expect(ok.fehler).toBeNull()
  })
})

describe('Beleg-Adresse (WP 1.8)', () => {
  it('legt PDF- und Bild-Anhänge als Belege ab, ohne Zuordnung und ohne Posteingang', async () => {
    const belegAdresse = `belege-${Date.now()}@example.org`
    const pf = await withMandant(app.db, mandant, (tx) =>
      legePostfachAn(tx, {
        mandantId: mandant,
        bezeichnung: 'Belege',
        host: IMAP.host,
        port: IMAP.port,
        tls: false,
        benutzer: belegAdresse,
        passwortChiffre: verschluessele('beliebig', schluessel),
        ordner: 'INBOX',
        abrufAb: '2020-01-01',
        zweck: 'belege',
        akteur: nutzer,
      }),
    )
    const pdf = Buffer.from('%PDF-1.4 Rechnung Muster')
    await smtp.sendMail({
      // Absender ist die Mieterin: im Posteingang würde die Mail zugeordnet, hier nicht.
      from: 'Mieterin <mieterin@example.org>',
      to: belegAdresse,
      subject: 'Rechnung Wasser',
      text: 'Anbei die Rechnung.',
      attachments: [
        { filename: 'rechnung.pdf', content: pdf, contentType: 'application/pdf' },
        { filename: 'foto.jpg', content: Buffer.from('foto'), contentType: 'image/jpeg' },
        { filename: 'kontakt.vcf', content: Buffer.from('BEGIN:VCARD'), contentType: 'text/vcard' },
      ],
    })
    await smtp.sendMail({
      from: 'Stadtwerke <rechnung@stadtwerke.example>',
      to: belegAdresse,
      subject: 'Dieselbe Rechnung nochmal',
      text: 'Erinnerung',
      attachments: [{ filename: 'kopie.pdf', content: pdf, contentType: 'application/pdf' }],
    })

    const r = await rufePostfachAb(ctx, { id: pf, mandantId: mandant })
    expect(r).toMatchObject({ neu: 2, zugeordnet: 0, belege: 2, fehler: null })

    const offen = await withMandant(app.db, mandant, (tx) => listeBelege(tx, { status: 'offen' }))
    expect(offen.map((b) => b.dateiname).sort()).toEqual(['foto.jpg', 'rechnung.pdf'])
    const b = await withMandant(app.db, mandant, (tx) =>
      ladeBeleg(tx, offen.find((x) => x.dateiname === 'rechnung.pdf')!.id),
    )
    expect(b).toMatchObject({ titel: 'Rechnung Wasser', objektId: null, buchung: null })
    expect(b?.nachrichtId).toBeTruthy()
    expect(
      sha256(
        await speicher.holen(
          (
            await withMandant(app.db, mandant, (tx) =>
              tx.execute<{ s: string }>(
                sql`select speicher_schluessel as s from dokumente where id = ${b!.id}`,
              ),
            )
          )[0]!.s,
        ),
      ),
    ).toBe(b?.dateiHash)

    const eingang = await withMandant(app.db, mandant, (tx) => ladePosteingang(tx))
    expect(eingang.map((e) => e.betreff)).not.toContain('Rechnung Wasser')

    // Ein zweiter Lauf legt nichts doppelt ab.
    const nochmal = await rufePostfachAb(ctx, { id: pf, mandantId: mandant })
    expect(nochmal).toMatchObject({ neu: 0, belege: 0 })
  })
})
