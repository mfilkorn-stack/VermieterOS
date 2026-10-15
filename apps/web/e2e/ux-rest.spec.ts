import { expect, test } from '@playwright/test'
import { musterPdf } from '../../../packages/ki/src/testpdf'
import { konto, registrieren } from './hilfen'
import { warteAufMail } from './postfach'

/**
 * Rest des UX-Plans: Begriffe in der Oberfläche (T1), Mieter am Ticket (P9), Handwerkerauftrag
 * per App-Mail mit Vermerk und Statuswechsel (P8), Dokumentliste über alle Objekte (N2).
 */
test('Eigentümerschaft, Mieter am Ticket, Auftrag per Mail, Dokumentliste', async ({ page }) => {
  test.setTimeout(120_000)
  await registrieren(page, konto('UX Rest', 'uxrest'))
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Eigentümerschaften')
  await page.getByTestId('mandant-neu').click()
  const m = page.getByTestId('mandant-anlegen')
  await m.getByLabel('Name').fill('Geschwister Muster')
  await m.getByRole('button', { name: 'Eigentümerschaft anlegen' }).click()

  await page.getByTestId('objekt-neu').click()
  const o = page.getByTestId('objekt-anlegen')
  await o.getByLabel('Bezeichnung').fill('Musterweg 1')
  await o.getByLabel('Im Bestand seit').fill('2020-01-01')
  await o.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByTestId('objekt-titel')).toHaveText('Musterweg 1')
  const objektId = page.url().split('/objekte/')[1]!.split(/[?#]/)[0]!

  await page.getByTestId('einheit-neu').click()
  const e = page.getByTestId('einheit')
  await e.getByLabel('Bezeichnung').fill('EG')
  await e.getByRole('button', { name: 'Speichern' }).click()
  await page.getByTestId('mieter-anlegen').click()
  const v = page.getByTestId('vermietung')
  await v.getByLabel('Nachname').fill('Beispiel')
  await v.getByLabel('Mietbeginn').fill('2024-02-01')
  await v.getByLabel('Kaltmiete €').fill('700,00')
  await v.getByRole('button', { name: 'Mietverhältnis anlegen' }).click()
  await expect(page.getByTestId('mietverhaeltnis')).toContainText('Beispiel')

  await page.goto('/handwerker')
  await page.getByTestId('handwerker-neu').click()
  const h = page.getByTestId('handwerker')
  await h.getByLabel('Firma oder Name').fill('Sanitär Muster')
  await h.getByLabel('Heizung und Sanitär').check()
  await h.getByLabel('E-Mail').fill('auftrag@sanitaer.example')
  await h.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByTestId('handwerkerliste')).toContainText('Sanitär Muster')

  // P9: Ticket an der Einheit zeigt den laufenden Mieter verlinkt
  await page.goto('/tickets/neu?objekt=' + objektId)
  const t = page.getByTestId('ticket-anlegen')
  await t.getByLabel('Objekt / Einheit').selectOption({ label: 'Musterweg 1 · EG' })
  await t.getByLabel('Titel').fill('Wasserhahn in der Küche tropft')
  await t.getByLabel('Beschreibung').fill('Tropft seit einer Woche.')
  await t.getByRole('button', { name: 'Ticket anlegen' }).click()
  await expect(page.getByTestId('ticket-titel')).toHaveText('Wasserhahn in der Küche tropft')
  const wo = page.getByTestId('ticket-wo')
  await expect(wo).toContainText('EG')
  await expect(wo).toContainText('laufend in der Einheit')
  await expect(page.getByTestId('ticket-mieter')).toHaveText('Beispiel')
  const ticketUrl = page.url()
  await page.getByTestId('ticket-mieter').click()
  await expect(page).toHaveURL(/\/mietverhaeltnisse\//)
  await page.goto(ticketUrl)

  // P8: Handwerker wählen, Auftrag aus der App senden; Ticket steht danach auf „beauftragt“
  const auftrag = page.getByTestId('ticket-auftrag')
  await expect(auftrag).toContainText('Erst oben einen Handwerker wählen')
  const f = page.getByTestId('ticket-aktualisieren')
  await f.getByLabel('Handwerker').selectOption({ label: 'Sanitär Muster' })
  await f.getByRole('button', { name: 'Speichern' }).click()
  const form = page.getByTestId('auftrag-formular')
  await expect(form.getByLabel(/^An/)).toHaveValue('auftrag@sanitaer.example')
  await expect(form.getByLabel('Text')).toHaveValue(/Ort: Musterweg 1 · EG/)
  await form.getByRole('button', { name: 'Auftrag senden' }).click()
  await expect(page.getByTestId('auftrag-gesendet')).toContainText('auftrag@sanitaer.example')
  await expect(page.getByTestId('ticket-status').first()).toContainText('beauftragt')
  await expect(page.getByTestId('ticket-verlauf')).toContainText(
    'Auftrag per Mail an Sanitär Muster',
  )
  const mail = await warteAufMail('auftrag@sanitaer.example', /^Auftrag: Wasserhahn/)
  expect(mail).toContain('Tropft seit einer Woche.')
  // Nach dem Versand ist der Text leer, damit nichts doppelt rausgeht
  await expect(page.getByTestId('auftrag-formular').getByLabel('Text')).toHaveValue('')

  // N2: Dokument am Objekt, Gesamtliste mit Ort und Filtern
  await page.goto('/dokumente/neu?objekt=' + objektId)
  const d = page.getByTestId('dokument-hochladen')
  await d.getByLabel(/Datei/).setInputFiles({
    name: 'grundriss.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(musterPdf([['Grundriss EG']])),
  })
  await d.getByLabel('Titel').fill('Grundriss EG')
  await d.getByRole('button', { name: 'Hochladen' }).click()
  await expect(page.getByTestId('dokument-titel')).toHaveText('Grundriss EG')

  await page
    .getByRole('navigation', { name: 'Hauptmenü' })
    .getByRole('link', { name: 'Dokumente' })
    .click()
  await expect(page).toHaveURL(/\/dokumente$/)
  const liste = page.getByTestId('dokumentliste')
  await expect(liste.locator('[data-titel="Grundriss EG"]')).toContainText('Musterweg 1')
  const filter = page.getByTestId('dokument-filter')
  await filter.getByLabel('Art').selectOption('mietvertrag')
  await filter.getByRole('button', { name: 'Filtern' }).click()
  await expect(page.getByTestId('dokumente-leer')).toContainText('Kein Dokument passt')
  await page.getByRole('link', { name: 'Filter zurücksetzen' }).click()
  await expect(page).toHaveURL(/\/dokumente$/)
  await page
    .getByTestId('dokument-filter')
    .getByPlaceholder('Titel oder Dateiname')
    .fill('grundriss')
  await page.getByTestId('dokument-filter').getByRole('button', { name: 'Filtern' }).click()
  await expect(page.getByTestId('dokument')).toHaveCount(1)

  // T1: Zugänge statt Mitglieder
  await page.goto('/mitglieder')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Zugänge')
})
