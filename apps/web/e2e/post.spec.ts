import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import nodemailer from 'nodemailer'
import { musterRechnung } from '../../../packages/ki/src/testpdf'
import { konto, registrieren, workerEinmal } from './hilfen'
import { warteAufMailKopf } from './postfach'
import { E2E } from './umgebung'

/**
 * WP 1.1: Mail-Eingang über die Oberfläche. Postfach einrichten (Verbindung wird geprüft),
 * Mails kommen per SMTP in GreenMail an, der Worker ruft einmal ab, der Posteingang zeigt die
 * automatische Zuordnung über den Absender, eine unbekannte Mail wird von Hand zugeordnet.
 * Dienste: ops/testdienste.sh (GreenMail, S3).
 */
test('Mail-Eingang: Postfach, Abruf, automatische und manuelle Zuordnung', async ({ page }) => {
  test.setTimeout(120_000)
  const stempel = Date.now()
  const postfach = `vermietung-${stempel}@example.org`
  const mieterin = `mieterin-${stempel}@example.org`
  await registrieren(page, konto('Post Test', 'post'))

  await expect(page).toHaveURL(/\/mandanten$/)
  await page.getByTestId('mandant-neu').click()
  const m = page.getByTestId('mandant-anlegen')
  await m.getByLabel('Name').fill('Post Mandant')
  await m.getByRole('button', { name: 'Anlegen' }).click()

  await page.getByTestId('objekt-neu').click()
  const o = page.getByTestId('objekt-anlegen')
  await o.getByLabel('Bezeichnung').fill('Haus am Park')
  await o.getByLabel('Im Bestand seit').fill('2024-01-01')
  await o.getByLabel('Straße').fill('Parkweg')
  await o.getByLabel('Hausnummer').fill('3')
  await o.getByLabel('PLZ').fill('99999')
  await o.getByLabel('Ort').fill('Musterstadt')
  await o.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByTestId('objekt-titel')).toHaveText('Haus am Park')

  await page.getByTestId('einheit-neu').click()
  const e = page.getByTestId('einheit')
  await e.getByLabel('Bezeichnung').fill('EG links')
  await e.getByLabel('Wohnfläche m²').fill('70,00')
  await e.getByRole('button', { name: 'Speichern' }).click()
  await page.getByTestId('einheitenliste').getByRole('link', { name: 'Vermietung' }).first().click()
  const v = page.getByTestId('vermietung')
  await v.getByLabel('Nachname').fill('Mieterin')
  await v.getByLabel('E-Mail').fill(mieterin)
  await v.getByLabel('Mietbeginn').fill('2024-02-01')
  await v.getByLabel('Kaltmiete €').fill('700,00')
  await v.getByRole('button', { name: 'Mietverhältnis anlegen' }).click()
  await expect(page.getByTestId('mietverhaeltnis')).toContainText('Mieterin')

  // Postfach: zuerst falscher Port, die Verbindungsprüfung muss greifen
  await page.goto('/postfaecher')
  const f = page.getByTestId('postfach')
  await f.getByLabel('IMAP-Server').fill(E2E.imap.host)
  await f.getByLabel('Port').fill('1')
  await f.getByLabel(/Verschlüsselt \(TLS\)/).uncheck()
  await f.getByLabel('Benutzer').fill(postfach)
  await f.getByLabel('Passwort').fill('app-passwort')
  await f.getByRole('button', { name: 'Verbindung prüfen und speichern' }).click()
  await expect(f.getByRole('alert')).toContainText('Verbindung fehlgeschlagen')
  await f.getByLabel('Port').fill(String(E2E.imap.port))
  await f.getByRole('button', { name: 'Verbindung prüfen und speichern' }).click()
  await expect(page.getByTestId('postfachliste')).toContainText(postfach)
  await expect(page.getByTestId('letzter-abruf')).toHaveText('noch nie')

  const smtp = nodemailer.createTransport({ ...E2E.smtp, secure: false, ignoreTLS: true })
  await smtp.sendMail({
    from: `Mieterin <${mieterin}>`,
    to: postfach,
    subject: 'Heizung kalt',
    text: 'Seit gestern ist die Heizung kalt.',
    attachments: [
      { filename: 'thermostat.jpg', content: Buffer.from('bild'), contentType: 'image/jpeg' },
    ],
  })
  await smtp.sendMail({
    from: 'Hausverwaltung Nachbar <info@nachbar.example>',
    to: postfach,
    subject: 'Baum an der Grundstücksgrenze',
    text: 'Bitte um Rückruf.',
  })
  smtp.close()
  workerEinmal()

  // Offen: nur die unbekannte Mail
  await page.goto('/posteingang')
  const offen = page.getByTestId('nachricht')
  await expect(offen).toHaveCount(1)
  await expect(offen.first()).toHaveAttribute('data-betreff', 'Baum an der Grundstücksgrenze')
  await expect(offen.first().getByTestId('zuordnung')).toContainText('Offen')
  // Das Menü zählt offene Mails (Amber-Zähler)
  const menuePost = page
    .getByRole('navigation', { name: 'Hauptmenü' })
    .getByRole('link', { name: /Posteingang/ })
  await expect(menuePost).toContainText('1 offen')

  // Alle: die Mail der Mieterin ist über den Absender zugeordnet, mit Anhang
  await page.getByRole('link', { name: 'Alle' }).click()
  const heizung = page.locator('[data-testid="nachricht"][data-betreff="Heizung kalt"]')
  await expect(heizung.getByTestId('zuordnung')).toContainText('EG links · Haus am Park · Mieterin')
  await expect(heizung.getByTestId('zuordnung')).toContainText('automatisch über den Absender')
  await expect(heizung).toContainText('1 Anhang')
  // WP 1.5: Der Worker hat beide Mails von der KI sortieren lassen (Attrappe statt API)
  await expect(heizung.getByTestId('sortierung')).toContainText('Notfall')
  await expect(heizung.getByTestId('sortierung')).toContainText('Heizung oder Wasser')
  await expect(
    page
      .locator('[data-testid="nachricht"][data-betreff="Baum an der Grundstücksgrenze"]')
      .getByTestId('sortierung'),
  ).not.toContainText('Notfall')

  // Von Hand zuordnen
  await page.goto('/posteingang')
  const baum = page.locator(
    '[data-testid="nachricht"][data-betreff="Baum an der Grundstücksgrenze"]',
  )
  const z = baum.getByTestId('zuordnen')
  await z
    .getByLabel('Mietverhältnis')
    .selectOption({ label: await z.locator('option', { hasText: 'EG links' }).innerText() })
  await z.getByLabel('Notiz zur Zuordnung').fill('betrifft Garten der Mieterin')
  await z.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByTestId('posteingang-leer')).toHaveText(
    'Nichts offen. Alle Nachrichten sind zugeordnet.',
  )
  // Zähler verschwindet ohne Neuladen (Layout wird nach der Aktion neu gerendert)
  await expect(menuePost).not.toContainText('offen')
  await page.goto('/posteingang?alle=1')
  await expect(baum.getByTestId('zuordnung')).toContainText('(von Hand)')

  // Zweiter Abruf bringt nichts doppelt; das Postfach zeigt den Abrufzeitpunkt
  workerEinmal()
  await page.goto('/posteingang?alle=1')
  await expect(page.getByTestId('nachricht')).toHaveCount(2)
  await page.goto('/postfaecher')
  await expect(page.getByTestId('letzter-abruf')).not.toHaveText('noch nie')

  // WP 1.2: Suche, Detail, Downloads mit Prüfsumme, Verlauf, Telefonnotiz mit Korrektur
  await page.goto('/posteingang?q=thermostat')
  await expect(page.getByTestId('posteingang-leer')).toBeVisible()
  await page.goto('/posteingang?q=heizung')
  await expect(page.getByTestId('nachricht')).toHaveCount(1)
  await page.getByRole('link', { name: 'Heizung kalt' }).click()
  await expect(page.getByTestId('nachricht-betreff')).toHaveText('Heizung kalt')
  await expect(page.getByTestId('nachricht-text')).toContainText(
    'Seit gestern ist die Heizung kalt.',
  )

  // WP 1.5: Einschätzung bestätigen, Antwortentwurf mit eingesetzten Fakten übernehmen
  const einschaetzung = page.getByTestId('einschaetzung')
  await expect(einschaetzung).toContainText('Die Heizung ist ausgefallen.')
  await page.getByTestId('einschaetzung-passt').getByRole('button').click()
  await expect(einschaetzung).toContainText('bestätigt')
  const antwort = page.getByTestId('antwort')
  await page.getByTestId('antwort-erzeugen').getByRole('button').click()
  await expect(page.getByTestId('antwort-text')).toContainText('Guten Tag Mieterin,')
  await expect(page.getByTestId('antwort-text')).not.toContainText('{{')
  await expect(antwort).toContainText('Termin mit dem Handwerker abstimmen')
  await page.getByTestId('antwort-uebernehmen').getByRole('button').click()
  await expect(antwort).toContainText('übernommen')
  await expect(page.getByTestId('antwort-mailto')).toHaveAttribute('href', /^mailto:/)

  // Antwort direkt aus der App: Entwurf vorbefüllt, Reply-To auf das Postfach, im Thread
  const senden = page.getByTestId('antwort-formular')
  await expect(senden.getByLabel('An', { exact: true })).toHaveValue(mieterin)
  await expect(senden.getByLabel('Betreff')).toHaveValue('Re: Heizung kalt')
  await expect(senden.getByLabel('Text')).toHaveValue(/Guten Tag Mieterin,/)
  await senden.getByLabel('Text').fill('Guten Tag Mieterin, der Monteur kommt Mittwoch.')
  await senden.getByRole('button', { name: 'Antwort senden' }).click()
  await expect(page.getByTestId('antwort-gesendet')).toContainText('an ' + mieterin)
  await expect(senden.getByLabel('Text')).toHaveValue('')
  const gesendet = await warteAufMailKopf(mieterin, /^Re: Heizung kalt$/)
  expect(gesendet.text).toContain('der Monteur kommt Mittwoch.')
  expect(gesendet.replyTo).toBe(postfach)
  expect(gesendet.inReplyTo).toBeTruthy()

  // WP 1.6: Ticket aus der Mail, vorbefüllt aus Zuordnung und Einschätzung
  await page.getByTestId('nachricht-ticket-neu').click()
  const neu = page.getByTestId('ticket-anlegen')
  await expect(neu.getByLabel('Titel')).toHaveValue('Die Heizung ist ausgefallen.')
  await expect(neu.getByLabel('Priorität')).toHaveValue('notfall')
  await neu.getByRole('button', { name: 'Ticket anlegen' }).click()
  await expect(page.getByTestId('ticket-titel')).toHaveText('Die Heizung ist ausgefallen.')
  await page.getByRole('link', { name: 'Ursprüngliche Mail' }).click()
  await expect(page.getByTestId('nachricht-tickets')).toContainText('Die Heizung ist ausgefallen.')

  // WP 1.7: Anhang als Dokument am Mietverhältnis ablegen, ohne zweiten Upload
  const nachrichtUrl = page.url()
  await page.getByText('Als Dokument ablegen').click()
  const ablage = page.getByTestId('ablegen-thermostat.jpg')
  await ablage.getByLabel('Art').selectOption('sonstiges')
  await ablage.getByRole('button', { name: 'Ablegen' }).click()
  await expect(page.getByTestId('dokument-titel')).toHaveText('thermostat.jpg')
  const bild = await page.request.get(
    (await page.getByTestId('dokument-download').getAttribute('href'))!,
  )
  expect(bild.headers()['content-type']).toBe('image/jpeg')
  await page.goto(nachrichtUrl)
  const [anhang] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'thermostat.jpg' }).click(),
  ])
  expect(anhang.suggestedFilename()).toBe('thermostat.jpg')
  expect((await readFile((await anhang.path())!)).toString()).toBe('bild')
  const [roh] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('rohmail').click(),
  ])
  expect(roh.suggestedFilename()).toBe('Heizung kalt.eml')
  expect((await readFile((await roh.path())!)).toString()).toContain('Subject: Heizung kalt')

  // Download einer fremden oder erfundenen ID: 404, nicht 500
  const fremd = await page.request.get('/api/anhang/00000000-0000-7000-8000-000000000000')
  expect(fremd.status()).toBe(404)

  await page
    .getByTestId('zuordnung')
    .getByRole('link', { name: /EG links/ })
    .click()
  await expect(page.getByTestId('verlauf-kopf')).toContainText(mieterin)
  await expect(page.getByTestId('verlauf-eintrag')).toHaveCount(3)
  await expect(page.locator('[data-testid="verlauf-eintrag"][data-art="antwort"]')).toContainText(
    'Antwort an ' + mieterin,
  )

  await page.getByText('Telefonnotiz erfassen').click()
  const notiz = page.getByTestId('telefonnotiz')
  await notiz.getByLabel('Zeitpunkt').fill('2026-10-06T09:15')
  await notiz.getByLabel('Betreff').fill('Heizung, Rückfrage Termin')
  await notiz
    .getByLabel('Inhalt und Absprachen')
    .fill('Monteur kommt Mittwoch zwischen 8 und 10 Uhr.')
  await notiz.getByRole('button', { name: 'Notiz speichern' }).click()
  const eintraege = page.getByTestId('verlauf-eintrag')
  await expect(eintraege).toHaveCount(4)
  const telefon = page.locator('[data-testid="verlauf-eintrag"][data-art="telefonnotiz"]')
  await expect(telefon).toContainText('Anruf von Mieterin')
  await expect(telefon).toContainText('06.10.2026, 09:15')

  await telefon.getByText('Korrigieren').click()
  const k = telefon.getByTestId('notiz-korrigieren')
  await k
    .getByLabel('Inhalt und Absprachen')
    .fill('Monteur kommt Donnerstag zwischen 8 und 10 Uhr.')
  await k.getByRole('button', { name: 'Korrektur speichern' }).click()
  await expect(telefon).toHaveCount(1)
  await expect(telefon).toContainText('Donnerstag')
  await expect(telefon).toContainText('korrigiert')
  await expect(telefon).not.toContainText('Mittwoch')
})

/**
 * Belege aus Mails: Rechnung als PDF-Anhang einer nicht zugeordneten Mail, mit einem Klick als
 * Beleg auslesen (KI-Attrappe). Werte und Objekt sind vorbelegt, die Mail verweist danach auf
 * den Beleg statt einen zweiten anzulegen.
 */
test('Mail-Anhang als Beleg auslesen', async ({ page }) => {
  test.setTimeout(120_000)
  const stempel = Date.now()
  const postfach = `belege-${stempel}@example.org`
  await registrieren(page, konto('Post Beleg', 'postbeleg'))
  await page.getByTestId('mandant-neu').click()
  const m = page.getByTestId('mandant-anlegen')
  await m.getByLabel('Name').fill('Post Beleg Mandant')
  await m.getByRole('button', { name: 'Anlegen' }).click()
  await page.getByTestId('objekt-neu').click()
  const o = page.getByTestId('objekt-anlegen')
  await o.getByLabel('Bezeichnung').fill('Musterweg 1')
  await o.getByLabel('Im Bestand seit').fill('2020-01-01')
  await o.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByTestId('objekt-titel')).toHaveText('Musterweg 1')

  await page.goto('/postfaecher')
  const f = page.getByTestId('postfach')
  await f.getByLabel('IMAP-Server').fill(E2E.imap.host)
  await f.getByLabel('Port').fill(String(E2E.imap.port))
  await f.getByLabel(/Verschlüsselt \(TLS\)/).uncheck()
  await f.getByLabel('Benutzer').fill(postfach)
  await f.getByLabel('Passwort').fill('app-passwort')
  await f.getByRole('button', { name: 'Verbindung prüfen und speichern' }).click()
  await expect(page.getByTestId('postfachliste')).toContainText(postfach)

  const smtp = nodemailer.createTransport({ ...E2E.smtp, secure: false, ignoreTLS: true })
  await smtp.sendMail({
    from: 'Wasserversorgung <rechnung@wasser.example>',
    to: postfach,
    subject: 'Ihre Jahresrechnung',
    text: 'Anbei die Rechnung.',
    attachments: [
      {
        filename: 'rechnung.pdf',
        content: Buffer.from(musterRechnung()),
        contentType: 'application/pdf',
      },
    ],
  })
  smtp.close()
  workerEinmal()

  await page.goto('/posteingang')
  await page.getByRole('link', { name: 'Ihre Jahresrechnung' }).click()
  await expect(page.getByTestId('nachricht-betreff')).toHaveText('Ihre Jahresrechnung')
  const mailUrl = page.url()
  await page.getByTestId('als-beleg-rechnung.pdf').getByRole('button').click()
  await expect(page).toHaveURL(/\/belege\/[0-9a-f-]{36}$/)
  const b = page.getByTestId('beleg-buchen')
  await expect(b.getByLabel('Betrag (brutto, €)')).toHaveValue('481,50')
  await expect(b.getByLabel('Zahlungsdatum')).toHaveValue('2026-01-15')
  await expect(
    b.getByTestId('anteil').locator('select[name="anteilObjekt"] option:checked'),
  ).toHaveText('Musterweg 1')
  const belegUrl = page.url()

  await page.goto(mailUrl)
  await expect(page.getByTestId('als-beleg-rechnung.pdf')).toHaveCount(0)
  await page.getByTestId('abgelegt-rechnung.pdf').click()
  await expect(page).toHaveURL(belegUrl)
})
