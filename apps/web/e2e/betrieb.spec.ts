import { expect, test } from '@playwright/test'
import { konto, registrieren } from './hilfen'

/**
 * WP 1.6: Handwerkerverzeichnis, Notfallkarte, Wissensbasis und Ticket-Ablauf über die Oberfläche.
 */
test('Handwerker, Notfallkarte, Wissensbasis und Ticket von der Meldung bis zum Termin', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await registrieren(page, konto('Betrieb Test', 'betrieb'))
  await page.getByTestId('mandant-neu').click()
  const m = page.getByTestId('mandant-anlegen')
  await m.getByLabel('Name').fill('Betrieb Mandant')
  await m.getByRole('button', { name: 'Anlegen' }).click()
  await page.getByTestId('objekt-neu').click()
  const o = page.getByTestId('objekt-anlegen')
  await o.getByLabel('Bezeichnung').fill('Haus am See')
  await o.getByLabel('Im Bestand seit').fill('2024-01-01')
  await o.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByTestId('objekt-titel')).toHaveText('Haus am See')
  const akte = page.url()

  // Handwerker: Gewerk ist Pflicht
  await page.goto('/handwerker')
  await page.getByTestId('handwerker-neu').click()
  const h = page.getByTestId('handwerker')
  await h.getByLabel('Firma oder Name').fill('Heizung Schmidt')
  await h.getByRole('button', { name: 'Speichern' }).click()
  await expect(h.getByRole('alert')).toContainText('Mindestens ein Gewerk')
  await h.getByLabel('Heizung und Sanitär').check()
  await h.getByLabel('Telefon', { exact: true }).fill('0221 123456')
  await h.getByLabel('Notdienst außerhalb der Geschäftszeiten').check()
  await h.getByLabel('Notdienst-Telefon').fill('0171 9876543')
  await h.getByLabel('E-Mail').fill('auftrag@heizung-schmidt.example')
  await h.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByTestId('handwerkerliste')).toContainText('Heizung Schmidt')
  await expect(page.getByTestId('handwerkerliste')).toContainText('Notdienst')

  // Notfallkarte: Handwerker aus dem Verzeichnis und ein freier Kontakt
  await page.goto(akte)
  await page.getByTestId('notfallkarte-bearbeiten').click()
  const n0 = page.getByTestId('notfall-0')
  await n0.getByLabel('Kontakt').selectOption({ label: 'Heizung Schmidt' })
  await page.getByRole('button', { name: 'Eintrag hinzufügen' }).click()
  const n1 = page.getByTestId('notfall-1')
  await n1.getByLabel('Wofür').selectOption('wasser')
  await n1.getByLabel('Name').fill('Stadtwerke Störung')
  await n1.getByLabel('Telefon').fill('0800 112233')
  await n1.getByLabel('Hinweis').fill('Haupthahn im Keller links')
  await page.getByTestId('notfallkarte').getByRole('button', { name: 'Speichern' }).click()
  const karte = page.getByTestId('notfallkarte')
  await expect(karte).toContainText('Heizung · Heizung Schmidt')
  await expect(karte).toContainText('0171 9876543')
  await expect(karte).toContainText('Haupthahn im Keller links')

  // Wissensbasis
  await page.getByTestId('wissen-neu').click()
  const w = page.getByTestId('wissen')
  await w.getByLabel('Titel').fill('Hausordnung')
  await w.getByLabel('Inhalt').fill('Ruhezeiten mittags und nachts beachten.')
  await w.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByTestId('wissensbasis')).toContainText('Hausordnung')

  // Ticket: gemeldet → Menü zählt es → beauftragt braucht Handwerker → Termin
  await page.getByTestId('objekt-ticket-neu').click()
  const t = page.getByTestId('ticket-anlegen')
  await t.getByLabel('Titel').fill('Heizung im Bad kalt')
  await t.getByLabel('Priorität').selectOption('hoch')
  await t.getByRole('button', { name: 'Ticket anlegen' }).click()
  await expect(page.getByTestId('ticket-titel')).toHaveText('Heizung im Bad kalt')
  const menue = page
    .getByRole('navigation', { name: 'Hauptmenü' })
    .getByRole('link', { name: /Tickets/ })
  await expect(menue).toContainText('1 neu gemeldet')

  const f = page.getByTestId('ticket-aktualisieren')
  await f.getByLabel('Status').selectOption('beauftragt')
  await f.getByRole('button', { name: 'Speichern' }).click()
  await expect(f.getByRole('alert')).toContainText('bitte einen Handwerker wählen')
  await f.getByLabel('Handwerker').selectOption({ label: 'Heizung Schmidt' })
  await f.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByTestId('ticket-status').first()).toContainText('beauftragt')
  await expect(menue).not.toContainText('neu gemeldet')
  await expect(page.getByTestId('ticket-auftrag-mail')).toHaveAttribute(
    'href',
    /^mailto:auftrag%40heizung-schmidt\.example/,
  )

  await f.getByLabel('Status').selectOption('termin')
  await f.getByLabel('Termin', { exact: true }).fill('2026-11-05T09:00')
  await f.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByTestId('ticket-verlauf').locator('li')).toHaveCount(3)
  await page.goto('/tickets')
  const zeile = page.locator('[data-testid="ticket"][data-titel="Heizung im Bad kalt"]')
  await expect(zeile).toContainText('Termin steht')
  await expect(zeile).toContainText('05.11.2026, 09:00')
  await expect(zeile).toContainText('dringend')
})
