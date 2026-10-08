import { expect, test } from '@playwright/test'
import { musterMietvertrag } from '../../../packages/ki/src/testpdf'
import { konto, registrieren } from './hilfen'
import { portalLinkAus, warteAufMail } from './postfach'

/** 1×1-PNG als Mangelfoto */
const FOTO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

/**
 * WP 1.10: Mieterportal. Der Vermieter lädt ein, die Einladung kommt per Mail (GreenMail), der
 * Mieter sieht Wohnung, Miete und den vollständigen Vertrag, meldet einen Mangel mit Foto und
 * schreibt eine Nachricht. Nach dem Sperren ist die Sitzung beendet.
 */
test('Mieterportal: Einladung, Anmeldung, Mangel, Nachricht, Sperren', async ({
  page,
  browser,
}) => {
  test.setTimeout(150_000)
  const vermieter = konto('Portal Vermieter', 'portalv')
  const mieterMail = `mieterin.${Date.now()}@example.org`
  await registrieren(page, vermieter)
  await page.getByTestId('mandant-neu').click()
  const m = page.getByTestId('mandant-anlegen')
  await m.getByLabel('Name').fill('Portal Mandant')
  await m.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByTestId('objekt-neu')).toBeVisible()

  await page.getByTestId('objekt-neu').click()
  const o = page.getByTestId('objekt-anlegen')
  await o.getByLabel('Bezeichnung').fill('Portalhaus')
  await o.getByLabel('Im Bestand seit').fill('2020-01-01')
  await o.getByLabel('Straße').fill('Beispielstraße')
  await o.getByLabel('Hausnummer').fill('7')
  await o.getByLabel('PLZ').fill('99999')
  await o.getByLabel('Ort').fill('Musterstadt')
  await o.getByRole('button', { name: 'Anlegen' }).click()
  await page.getByTestId('einheit-neu').click()
  const eh = page.getByTestId('einheit')
  await eh.getByLabel('Bezeichnung').fill('Wohnung 1')
  await eh.getByRole('button', { name: 'Speichern' }).click()
  await page
    .getByTestId('einheitenliste')
    .getByRole('link', { name: 'Mietverhältnisse' })
    .first()
    .click()
  const v = page.getByTestId('vermietung')
  await v.getByLabel('Vorname').first().fill('Mia')
  await v.getByLabel('Nachname').fill('Beispiel')
  await v.getByLabel('E-Mail').fill(mieterMail)
  await v.getByLabel('Mietbeginn').fill('2021-09-01')
  await v.getByLabel('Kaltmiete €').fill('650,00')
  await v.getByRole('button', { name: 'Mietverhältnis anlegen' }).click()
  await expect(page.getByTestId('mietverhaeltnis')).toContainText('Beispiel')
  await page.getByTestId('verlauf-link').click()
  await expect(page.getByTestId('mv-portal')).toBeVisible()
  const verlauf = page.url()

  // Vertrag hochladen: Mieter sehen ihn vollständig
  await page.getByTestId('mv-dokument-neu').click()
  const f = page.getByTestId('dokument-hochladen')
  await f.getByLabel(/Datei/).setInputFiles({
    name: 'mietvertrag.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(musterMietvertrag()),
  })
  await f.getByLabel('Art').selectOption('mietvertrag')
  await f.getByLabel('Titel').fill('Mietvertrag Wohnung 1')
  await f.getByRole('button', { name: 'Hochladen' }).click()
  await expect(page.getByTestId('dokument-titel')).toHaveText('Mietvertrag Wohnung 1')

  // Einladen: Adresse ist aus den Stammdaten vorbelegt
  await page.goto(verlauf)
  const einladen = page.getByTestId('portal-einladen')
  await expect(einladen.getByLabel('E-Mail für das Portal')).toHaveValue(mieterMail)
  await einladen.getByRole('button', { name: 'Einladung senden' }).click()
  await expect(einladen).toContainText(`Einladung an ${mieterMail} verschickt.`)
  await expect(page.getByTestId('portal-zugang')).toContainText(mieterMail)
  await einladen.getByLabel('E-Mail für das Portal').fill(mieterMail)
  await einladen.getByRole('button', { name: 'Einladung senden' }).click()
  await expect(einladen.getByRole('alert')).toContainText('schon einen Zugang')

  // Mieter: eigener Browser-Kontext, Link aus der Mail
  const mieter = await (await browser.newContext({ locale: 'de-DE' })).newPage()
  const einladung = portalLinkAus(await warteAufMail(mieterMail, /Einladung zum Mieterportal/))
  await mieter.goto(einladung)
  await mieter
    .getByTestId('portal-anmelden')
    .getByRole('button', { name: 'Jetzt anmelden' })
    .click()
  await expect(mieter.getByTestId('portal-wohnung')).toContainText('Beispielstraße 7')
  await expect(mieter.getByTestId('portal-kaltmiete')).toHaveText('650,00 €')
  const dok = mieter.getByTestId('portal-dokumente').getByRole('link', {
    name: 'Mietvertrag Wohnung 1',
  })
  const r = await mieter.request.get((await dok.getAttribute('href'))!)
  expect(r.headers()['content-type']).toBe('application/pdf')
  expect((await r.body()).subarray(0, 5).toString()).toBe('%PDF-')

  // Derselbe Link gilt nur einmal
  const zweiter = await (await browser.newContext()).newPage()
  await zweiter.goto(einladung)
  await zweiter.getByRole('button', { name: 'Jetzt anmelden' }).click()
  await expect(zweiter.getByTestId('portal-anmelden').getByRole('alert')).toContainText(
    'abgelaufen oder wurde schon benutzt',
  )

  // Mangel mit Foto
  await mieter.getByTestId('portal-mangel').click()
  const mf = mieter.getByTestId('portal-mangel-formular')
  await mf.getByLabel('Was ist kaputt?').fill('Heizung im Bad bleibt kalt')
  await mf.getByLabel('Beschreibung').fill('Seit gestern Abend, Thermostat auf 5.')
  await mf
    .getByLabel(/Fotos/)
    .setInputFiles({ name: 'bad.png', mimeType: 'image/png', buffer: FOTO })
  await mf.getByRole('button', { name: 'Meldung absenden' }).click()
  await expect(mieter.getByTestId('portal-bestaetigung')).toBeVisible()
  await expect(mieter.getByTestId('portal-tickets')).toContainText('Heizung im Bad bleibt kalt')
  await expect(mieter.getByTestId('portal-tickets')).toContainText('gemeldet')

  // Nachricht
  await mieter.getByTestId('portal-nachricht').click()
  const nf = mieter.getByTestId('portal-nachricht-formular')
  await nf.getByLabel('Betreff').fill('Schornsteinfeger')
  await nf.getByLabel('Nachricht').fill('Wann kommt der Schornsteinfeger dieses Jahr?')
  await nf.getByRole('button', { name: 'Nachricht senden' }).click()
  await expect(mieter.getByTestId('portal-bestaetigung')).toContainText('Nachricht')

  // Vermieter: Hinweis per Mail, Ticket mit Foto, Nachricht im Verlauf
  const hinweis = await warteAufMail(vermieter.email, /Mängelmeldung im Mieterportal/)
  expect(hinweis).toContain('Heizung im Bad bleibt kalt')
  await page.goto(verlauf)
  await expect(page.locator('[data-art="portal"]')).toContainText('Wann kommt der Schornsteinfeger')

  // UX-4: Antwort aus dem Posteingang; der Mieter sieht sie im Portal und bekommt sie per Mail
  await page.goto('/posteingang')
  await page
    .getByTestId('portal-nachrichten')
    .getByRole('link', { name: 'Schornsteinfeger' })
    .click()
  const pf = page.getByTestId('antwort-formular')
  await expect(pf.getByLabel(/^An /)).toHaveValue(mieterMail)
  await pf.getByLabel('Text').fill('Der Schornsteinfeger kommt im Mai.')
  await pf.getByRole('button', { name: 'Antwort senden' }).click()
  await expect(page.getByTestId('antwort-gesendet')).toContainText(mieterMail)
  expect(await warteAufMail(mieterMail, /^Re: Schornsteinfeger/)).toContain('kommt im Mai')
  await mieter.goto('/portal')
  await expect(mieter.getByTestId('portal-nachrichten')).toContainText(
    'Der Schornsteinfeger kommt im Mai.',
  )
  await page.goto('/posteingang')
  await expect(page.getByTestId('portal-nachrichten')).toHaveCount(0)
  await page.goto('/tickets')
  await page.getByRole('link', { name: 'Heizung im Bad bleibt kalt' }).click()
  await expect(page.getByTestId('ticket-status')).toHaveText('gemeldet')
  await expect(page.getByTestId('ticket-fotos').locator('img')).toHaveCount(1)
  await expect(page.getByTestId('ticket-verlauf')).toContainText(`Mieterportal, ${mieterMail}`)

  // Neuer Link über die Anmeldeseite; unbekannte Adressen bekommen dieselbe Antwort
  await mieter.getByTestId('portal-abmelden').click()
  await expect(mieter).toHaveURL(/\/portal\/login/)
  const lf = mieter.getByTestId('portal-login')
  await lf.getByLabel('E-Mail').fill('niemand@example.org')
  await lf.getByRole('button', { name: 'Link anfordern' }).click()
  const neutral = await lf.locator('.leise').textContent()
  await lf.getByLabel('E-Mail').fill(mieterMail.toUpperCase())
  await lf.getByRole('button', { name: 'Link anfordern' }).click()
  await expect(lf.locator('.leise')).toHaveText(neutral!)
  const anmeldung = portalLinkAus(await warteAufMail(mieterMail, /Ihr Anmeldelink/))
  await mieter.goto(anmeldung)
  await mieter.getByRole('button', { name: 'Jetzt anmelden' }).click()
  await expect(mieter.getByTestId('portal-wohnung')).toBeVisible()

  // Sperren beendet die Sitzung sofort
  await page.goto(verlauf)
  await page.getByTestId('portal-sperren').getByRole('button', { name: 'Sperren' }).click()
  await expect(page.getByTestId('portal-zugang')).toHaveCount(0)
  await mieter.reload()
  await expect(mieter).toHaveURL(/\/portal\/login/)
})
