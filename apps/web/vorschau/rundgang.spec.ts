import { expect, test, type Page } from '@playwright/test'
import { mkdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import nodemailer from 'nodemailer'
import { konto, registrieren, workerEinmal } from '../e2e/hilfen'
import { E2E } from '../e2e/umgebung'
import {
  musterMietvertrag,
  musterRechnung,
  musterSteuerberatung,
} from '../../../packages/ki/src/testpdf'
import { schreibeGalerie, type Bild } from './galerie'

/**
 * Rundgang für die Vorschau auf GitHub Pages (.github/workflows/vorschau.yml).
 * Klickt einen typischen Ablauf mit Musterdaten durch und hält jede Station als Bild fest.
 * Prüft nebenbei das Wichtigste; die eigentlichen Tests liegen in e2e/.
 */
const ausgabe = resolve(process.env['VORSCHAU_AUSGABE'] ?? 'vorschau-ausgabe')
const bilder: Bild[] = []
let bereich = ''

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function bild(page: Page, titel: string, text: string, mobil = false) {
  const datei = `${String(bilder.length + 1).padStart(2, '0')}-${slug(titel)}.png`
  await page.waitForLoadState('networkidle')
  await page.screenshot({
    path: join(ausgabe, 'bilder', datei),
    // Handy: nur der sichtbare Bildschirm, so wie er mit Tab-Leiste unten aussieht.
    fullPage: !mobil,
    animations: 'disabled',
  })
  bilder.push({ bereich, titel, text, datei, mobil })
}

test.beforeAll(() => {
  rmSync(ausgabe, { recursive: true, force: true })
  mkdirSync(join(ausgabe, 'bilder'), { recursive: true })
})

test.afterAll(() => {
  schreibeGalerie(ausgabe, bilder, {
    commit: process.env['GITHUB_SHA'] ?? 'lokal',
    ref: process.env['GITHUB_REF_NAME'] ?? 'lokal',
    repo: process.env['GITHUB_REPOSITORY'] ?? 'mfilkorn-stack/VermieterOS',
    erstellt: new Date().toLocaleString('de-DE', {
      timeZone: 'Europe/Berlin',
      dateStyle: 'long',
      timeStyle: 'short',
    }),
  })
})

test('Rundgang mit Musterdaten', async ({ page, browser }) => {
  test.setTimeout(240_000)
  await page.setViewportSize({ width: 1280, height: 800 })
  // In CI frische Dienste: saubere Adressen. Lokal behält GreenMail Postfächer zwischen Läufen.
  const zusatz = process.env['CI'] ? '' : `-${Date.now()}`

  bereich = 'Zugang'
  await page.goto('/login')
  await bild(page, 'Anmeldung', 'E-Mail und Passwort, danach immer der zweite Faktor (TOTP).')
  await registrieren(page, konto('Erika Mustermann', 'vorschau'))
  await page.getByTestId('mandant-neu').click()
  const m = page.getByTestId('mandant-anlegen')
  await m.getByLabel('Name').fill('Geschwister Muster')
  await m.getByLabel('Art der Eigentümerschaft').selectOption('bruchteil')
  await bild(
    page,
    'Mandant anlegen',
    'Ein Mandant ist eine Eigentümerschaft: allein, Ehepaar, Bruchteil oder GbR.',
  )
  await m.getByRole('button', { name: 'Anlegen' }).click()

  bereich = 'Objekt erfassen'
  await page.getByTestId('objekt-neu').click()
  const o = page.getByTestId('objekt-anlegen')
  await o.getByLabel('Bezeichnung').fill('ETW mit Stellplatz')
  await o.getByLabel('Art').selectOption('etw')
  await o.getByLabel('Im Bestand seit').fill('2021-07-01')
  await o.getByLabel('Straße').fill('Musterweg')
  await o.getByLabel('Hausnummer').fill('18')
  await o.getByLabel('PLZ').fill('99999')
  await o.getByLabel('Ort').fill('Musterstadt')
  await o.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByTestId('objekt-titel')).toHaveText('ETW mit Stellplatz')
  const akte = page.url()
  await bild(
    page,
    'Objektakte am Anfang',
    'Ampeln pro Modul und eine Checkliste; jeder Punkt führt direkt zum passenden Formular.',
  )

  await page.goto(`${akte}/stammdaten`)
  const s = page.getByTestId('stammdaten')
  await s.getByLabel('Bundesland').selectOption('BY')
  await s.getByLabel('Baujahr (Fertigstellung)').fill('1970')
  await s.getByLabel('Teil einer Wohnungseigentümergemeinschaft (WEG)').check()
  await page.getByRole('button', { name: 'Grundbuchblatt hinzufügen' }).click()
  const g0 = page.getByTestId('grundbuch-0')
  await g0.getByLabel('Art').selectOption('wohnungsgrundbuch')
  await g0.getByLabel('Amtsgericht').fill('Musterstadt')
  await g0.getByLabel('Blatt', { exact: true }).fill('W-1')
  await g0.getByLabel('Miteigentumsanteil (Zähler)').fill('88,89')
  await g0.getByLabel('Nenner').fill('1000')
  await page.getByTestId('flurstueck-0-0').getByLabel('Flurstück').fill('Flst. A')
  await page.getByTestId('flurstueck-0-0').getByLabel('Fläche m²').fill('464')
  await page.getByRole('button', { name: 'Grundbuchblatt hinzufügen' }).click()
  const g1 = page.getByTestId('grundbuch-1')
  await g1.getByLabel('Amtsgericht').fill('Musterstadt')
  await g1.getByLabel('Blatt', { exact: true }).fill('G-2')
  await page.getByTestId('flurstueck-1-0').getByLabel('Flurstück').fill('Flst. C')
  await page.getByTestId('flurstueck-1-0').getByLabel('Bezeichnung').fill('Stellplatz')
  await page.getByTestId('flurstueck-1-0').getByLabel('Fläche m²').fill('14')
  await bild(
    page,
    'Stammdaten und Grundbuch',
    'Mehrere Grundbuchblätter pro Objekt, z. B. Wohnung mit Miteigentumsanteil plus Stellplatz.',
  )
  await s.getByRole('button', { name: 'Speichern' }).click()
  await expect(page).toHaveURL(akte)

  await page.goto(`${akte}/kauf`)
  const k = page.getByTestId('kauf')
  await k.getByLabel('Datum Kaufvertrag').fill('2021-04-30')
  await k.getByLabel('Übergang von Nutzen und Lasten').fill('2021-07-01')
  await k.getByLabel('Kaufpreis €').fill('187.000,00')
  const positionen: Array<[string, string]> = [
    ['grunderwerbsteuer', '6.545,00'],
    ['notar_kaufvertrag', '1.500,00'],
    ['grundbuch_eigentum', '600,00'],
    ['notar_grundschuld', '400,00'],
  ]
  for (const [i, [art, betrag]] of positionen.entries()) {
    await page.getByRole('button', { name: 'Position hinzufügen' }).click()
    await page.getByTestId(`nebenkosten-${i}`).getByLabel('Art').selectOption(art)
    await page.getByTestId(`nebenkosten-${i}`).getByLabel('Betrag €').fill(betrag)
  }
  await k.getByLabel('Gebäudeanteil %').fill('80')
  await k.getByRole('button', { name: 'Speichern' }).click()
  await expect(page).toHaveURL(akte)
  await page.goto(`${akte}/kauf`)
  await bild(
    page,
    'Kauf und Abschreibung',
    'Grunderwerbsteuer-Vorschlag aus den Referenzdaten, Nebenkosten als Positionen, AfA-Satz aus dem Baujahr.',
  )

  await page.goto(akte)
  await page.getByTestId('einheit-neu').click()
  let e = page.getByTestId('einheit')
  await e.getByLabel('Bezeichnung').fill('Wohnung Nr. 1')
  await e.getByLabel('Wohnfläche m²').fill('65,00')
  await e.getByLabel('Miteigentumsanteil (Zähler)').fill('88,89')
  await e.getByLabel('Nenner').fill('1000')
  await e.getByRole('button', { name: 'Speichern' }).click()
  await page.getByTestId('einheit-neu').click()
  e = page.getByTestId('einheit')
  await e.getByLabel('Bezeichnung').fill('Stellplatz')
  await e.getByLabel('Typ').selectOption('stellplatz')
  await e.getByRole('button', { name: 'Speichern' }).click()

  const mieterin = `max.mieter${zusatz}@example.org`
  await page.getByTestId('einheitenliste').getByRole('link', { name: 'Vermietung' }).first().click()
  const v = page.getByTestId('vermietung')
  await v.getByLabel('Vorname').fill('Max')
  await v.getByLabel('Nachname').fill('Mieter')
  await v.getByLabel('E-Mail').fill(mieterin)
  await v.getByLabel('Mietbeginn').fill('2021-09-01')
  await v.getByLabel('Kaltmiete €').fill('650,00')
  await v.getByLabel('Vorauszahlung Betriebskosten €').fill('120,00')
  await v.getByLabel('Vorauszahlung Heizkosten €').fill('60,00')
  await v.getByLabel('Kaution €').fill('1.950,00')
  await v.getByRole('button', { name: 'Mietverhältnis anlegen' }).click()
  await expect(page.getByTestId('mietverhaeltnis')).toContainText('Mieter')
  await bild(
    page,
    'Vermietung',
    'Mieter, Mietbeginn, Sollmiete und Vorauszahlungen; Mieterhöhungen werden neue Versionen.',
  )

  await page.goto('/eigentuemer')
  for (const nachname of ['Muster A', 'Muster B']) {
    const f = page.getByTestId('eigentuemer')
    await f.getByLabel('Nachname').fill(nachname)
    await f.getByLabel('Anteil Zähler').fill('1')
    await f.getByLabel('Nenner').fill('2')
    await f.getByLabel('Gilt ab').fill('2021-07-01')
    await f.getByRole('button', { name: 'Hinzufügen' }).click()
    await expect(page.getByTestId('eigentuemerliste')).toContainText(nachname)
  }
  await bild(
    page,
    'Eigentümer',
    'Anteile der Bruchteilsgemeinschaft; sie bestimmen später die Aufteilung im Steuerpaket.',
  )

  await page.goto(akte)
  await expect(page.getByTestId('vollstaendig')).toBeVisible()
  await bild(
    page,
    'Objektakte vollständig',
    'Alle Ampeln grün: Anschaffungskosten, AfA pro Jahr, Fristen und Grundstücksfläche gerechnet.',
  )

  bereich = 'Referenzdaten'
  await page.goto('/referenzdaten')
  await bild(
    page,
    'Grunderwerbsteuer je Land',
    'Werte mit Gültigkeit, Quelle und Prüffrist; überfällige Werte erzeugen Warnungen.',
  )

  bereich = 'Mail-Eingang'
  const postfach = `vermietung${zusatz}@example.org`
  await page.goto('/postfaecher')
  const p = page.getByTestId('postfach')
  await p.getByLabel('IMAP-Server').fill(E2E.imap.host)
  await p.getByLabel('Port').fill(String(E2E.imap.port))
  await p.getByLabel(/Verschlüsselt \(TLS\)/).uncheck()
  await p.getByLabel('Benutzer').fill(postfach)
  await p.getByLabel('Passwort').fill('app-passwort')
  await p.getByRole('button', { name: 'Verbindung prüfen und speichern' }).click()
  await expect(page.getByTestId('postfachliste')).toContainText(postfach)

  const smtp = nodemailer.createTransport({ ...E2E.smtp, secure: false, ignoreTLS: true })
  await smtp.sendMail({
    from: `Max Mieter <${mieterin}>`,
    to: postfach,
    subject: 'Heizung im Bad bleibt kalt',
    text: 'Hallo, seit gestern bleibt der Heizkörper im Bad kalt. Viele Grüße, Max Mieter',
    attachments: [
      { filename: 'thermostat.jpg', content: Buffer.from('bild'), contentType: 'image/jpeg' },
    ],
  })
  await smtp.sendMail({
    from: 'Hausverwaltung Nachbarhaus <info@nachbar.example>',
    to: postfach,
    subject: 'Baum an der Grundstücksgrenze',
    text: 'Guten Tag, bitte rufen Sie uns wegen des Baums an der Grenze zurück.',
  })
  smtp.close()
  workerEinmal()

  await page.goto('/postfaecher')
  await bild(
    page,
    'Postfächer',
    'IMAP-Postfach nur lesend; die Verbindung wird vor dem Speichern geprüft, das Passwort verschlüsselt.',
  )
  await page.goto('/posteingang')
  await bild(
    page,
    'Posteingang: offen',
    'Unbekannter Absender bleibt offen und wird von Hand einem Mietverhältnis zugeordnet.',
  )
  await page.goto('/posteingang?alle=1')
  await bild(
    page,
    'Posteingang: alle',
    'Die Mail des Mieters ist automatisch über den Absender zugeordnet, mit Anhang. Die KI hat beide Mails sortiert: Kategorie, Dringlichkeit, Frist.',
  )
  await page.getByRole('link', { name: 'Heizung im Bad bleibt kalt' }).click()
  await expect(page.getByTestId('nachricht-betreff')).toHaveText('Heizung im Bad bleibt kalt')
  await page.getByTestId('antwort-erzeugen').getByRole('button').click()
  await expect(page.getByTestId('antwort-text')).toContainText('Guten Tag')
  await bild(
    page,
    'Nachricht im Detail',
    'Kopfdaten, Zuordnung, Einschätzung der KI und ein Antwortentwurf: Namen und Adressen setzt die Software aus den Stammdaten ein, die KI schreibt nur Platzhalter. In der Vorschau antwortet eine Attrappe statt der echten KI.',
  )
  await page
    .getByTestId('zuordnung')
    .getByRole('link', { name: /Wohnung Nr. 1/ })
    .click()
  await page.getByText('Telefonnotiz erfassen').click()
  const notiz = page.getByTestId('telefonnotiz')
  await notiz.getByLabel('Betreff').fill('Heizung Bad, Termin Monteur')
  await notiz
    .getByLabel('Inhalt und Absprachen')
    .fill('Monteur kommt Mittwoch zwischen 8 und 10 Uhr. Mieter ist zu Hause.')
  await notiz.getByRole('button', { name: 'Notiz speichern' }).click()
  await expect(page.getByTestId('verlauf-eintrag')).toHaveCount(2)
  await bild(
    page,
    'Verlauf des Mietverhältnisses',
    'Mails und Telefonnotizen in einer Zeitleiste; Notizen lassen sich nachvollziehbar korrigieren.',
  )

  const verlaufUrl = page.url()
  await page.getByTestId('mv-schreiben').click()
  await expect(page.getByTestId('schreiben-wohnungsgeber')).toBeVisible()
  await bild(
    page,
    'Standardschreiben',
    'Wohnungsgeberbestätigung, Mietschuldenfreiheit und Vermieterbescheinigung, vorbelegt aus den Stammdaten. Das PDF liegt danach mit Prüfsumme am Mietverhältnis.',
  )
  await page.goto(verlaufUrl)

  bereich = 'Dokumente'
  await page.getByTestId('mv-dokument-neu').click()
  const up = page.getByTestId('dokument-hochladen')
  await up.getByLabel(/Datei/).setInputFiles({
    name: 'mietvertrag.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(musterMietvertrag()),
  })
  await up.getByLabel('Titel').fill('Mietvertrag Wohnung Nr. 1')
  await up.getByRole('button', { name: 'Hochladen' }).click()
  await page.getByTestId('vertrag-auslesen').getByRole('button').click()
  await expect(page.getByTestId('vertrag-werte')).toBeVisible()
  await bild(
    page,
    'Mietvertrag ausgelesen',
    'Die KI liest Eckdaten mit Seitenangabe; die Software prüft jedes Zitat am PDF. Nur belegte Werte lassen sich übernehmen, mit Herkunft „Dokument, Seite“. Die erfundene Kaution der Attrappe fällt auf.',
  )

  bereich = 'Handwerker und Tickets'
  await page.goto('/handwerker/neu')
  const hw = page.getByTestId('handwerker')
  await hw.getByLabel('Firma oder Name').fill('Heizung Schmidt GmbH')
  await hw.getByLabel('Heizung und Sanitär').check()
  await hw.getByLabel('Telefon', { exact: true }).fill('0221 123456')
  await hw.getByLabel('Notdienst außerhalb der Geschäftszeiten').check()
  await hw.getByLabel('Notdienst-Telefon').fill('0171 9876543')
  await hw.getByLabel('E-Mail').fill('auftrag@heizung-schmidt.example')
  await hw.getByLabel('Bewertung').selectOption('5')
  await hw.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByTestId('handwerkerliste')).toContainText('Heizung Schmidt GmbH')
  await bild(
    page,
    'Handwerker',
    'Verzeichnis mit Gewerk, Notdienst, Bewertung und direkten Anruf-Links.',
  )

  await page.goto(`${akte}/notfallkarte`)
  await page
    .getByTestId('notfall-0')
    .getByLabel('Kontakt')
    .selectOption({ label: 'Heizung Schmidt GmbH' })
  await page.getByRole('button', { name: 'Eintrag hinzufügen' }).click()
  const wasser = page.getByTestId('notfall-1')
  await wasser.getByLabel('Wofür').selectOption('wasser')
  await wasser.getByLabel('Name').fill('Stadtwerke Störungsdienst')
  await wasser.getByLabel('Telefon').fill('0800 112233')
  await wasser.getByLabel('Hinweis').fill('Haupthahn im Keller links')
  await page.getByTestId('notfallkarte').getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByTestId('notfallkarte')).toContainText('Heizung Schmidt GmbH')
  await page.getByTestId('wissen-neu').click()
  const wi = page.getByTestId('wissen')
  await wi.getByLabel('Titel').fill('Hausordnung')
  await wi.getByLabel('Inhalt').fill('Ruhezeiten mittags und nachts. Fahrräder in den Keller.')
  await wi.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByTestId('wissensbasis')).toContainText('Hausordnung')

  await page.goto('/posteingang?alle=1')
  await page.getByRole('link', { name: 'Heizung im Bad bleibt kalt' }).click()
  await page.getByTestId('nachricht-ticket-neu').click()
  await page.getByTestId('ticket-anlegen').getByRole('button', { name: 'Ticket anlegen' }).click()
  const tf = page.getByTestId('ticket-aktualisieren')
  await tf.getByLabel('Status').selectOption('termin')
  await tf.getByLabel('Handwerker').selectOption({ label: 'Heizung Schmidt GmbH' })
  await tf.getByLabel('Termin', { exact: true }).fill('2026-11-05T09:00')
  await tf.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByTestId('ticket-verlauf').locator('li')).toHaveCount(2)
  await bild(
    page,
    'Ticket',
    'Aus der Mail angelegt, vorbefüllt aus Zuordnung und Einschätzung. Jeder Statuswechsel steht im Verlauf; der Auftrag geht per Mail an den Handwerker.',
  )
  bereich = 'Belege und Journal'
  const ticketUrl = page.url()
  const rechnung = page.getByTestId('ticket-rechnungen').getByTestId('beleg-import')
  await rechnung.getByLabel(/Dateien/).setInputFiles({
    name: 'Rechnung Stadtwerke.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(musterRechnung()),
  })
  await rechnung.getByRole('button', { name: 'Hochladen und auslesen' }).click()
  await expect(rechnung.locator('li[data-stand="fertig"]')).toHaveCount(1)
  await page.goto('/belege')
  const sammel = page.getByTestId('beleg-import')
  await sammel.getByLabel(/Dateien/).setInputFiles({
    name: 'Steuerberatung 2025.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(musterSteuerberatung()),
  })
  await sammel.getByRole('button', { name: 'Hochladen und auslesen' }).click()
  await expect(sammel.locator('li[data-stand="fertig"]')).toHaveCount(1)
  await expect(page.getByTestId('belege-offen').getByTestId('beleg')).toHaveCount(2)
  await bild(
    page,
    'Belegeingang',
    'Rechnungen per Upload, Sammel-Import, Beleg-Adresse oder direkt am Ticket. Die KI liest beim Eingang mit; doppelte Dateien erkennt die Prüfsumme.',
  )
  await page.getByTestId('belege-offen').getByRole('link', { name: 'Rechnung Stadtwerke' }).click()
  await expect(page.getByTestId('beleg-werte')).toBeVisible()
  await bild(
    page,
    'Beleg auslesen und buchen',
    'Vorschau links, rechts die ausgelesenen Werte mit Fundstelle. Vorbelegt ist nur, was wörtlich im PDF steht; Objekt kommt aus dem Ticket, die Kategorie als Vorschlag. Ein Klick bucht und öffnet den nächsten Beleg.',
  )
  await page
    .getByTestId('beleg-buchen')
    .getByRole('button', { name: 'Bestätigen und buchen' })
    .click()
  await expect(page.getByTestId('beleg-titel')).toHaveText('Steuerberatung 2025')
  const zweiter = page.getByTestId('beleg-buchen')
  await zweiter.getByLabel('Zahlungsdatum').fill('2026-03-25')
  await zweiter
    .getByTestId('anteil')
    .first()
    .locator('select[name="anteilObjekt"]')
    .selectOption({ index: 1 })
  await zweiter.getByRole('button', { name: 'Bestätigen und buchen' }).click()
  await expect(page.getByTestId('belege-fertig')).toBeVisible()
  await page.goto('/journal?jahr=2026')
  await expect(page.getByTestId('journal-eintrag')).toHaveCount(2)
  await bild(
    page,
    'Journal',
    'Alle Einnahmen und Ausgaben nach Zahlungsdatum, mit Belegnummer und Summen je Kategorie. Einträge sind unveränderlich; Fehler werden storniert und neu gebucht.',
  )
  await page.goto(ticketUrl)

  await page.goto(akte)
  await bild(
    page,
    'Objektakte mit Notfallkarte',
    'Offene Tickets, Notfallkarte und Wissensbasis am Objekt. Die KI nutzt beides für Antwortentwürfe, Telefonnummern setzt die Software ein.',
  )

  bereich = 'Auf dem Handy'
  const handy = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'de-DE',
    storageState: await page.context().storageState(),
  })
  const hp = await handy.newPage()
  await hp.goto(akte)
  await bild(hp, 'Objektakte', 'Dieselbe Akte in Handybreite.', true)
  await hp.goto('/posteingang?alle=1')
  await bild(hp, 'Posteingang', 'Posteingang in Handybreite.', true)
  await handy.close()
})
