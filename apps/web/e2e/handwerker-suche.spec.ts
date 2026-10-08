import { expect, test } from '@playwright/test'
import { konto, registrieren } from './hilfen'

/**
 * Firmensuche im Handwerkerverzeichnis (Photon- und Nominatim-Attrappe): Auswahl füllt Firma,
 * Anschrift, Gewerk und Kontaktdaten; gespeichert erscheinen Ort und Webseite in der Liste.
 */
test('Handwerker per Firmensuche anlegen', async ({ page }) => {
  await registrieren(page, konto('Handwerker Suche', 'hws'))
  await page.getByTestId('mandant-neu').click()
  const m = page.getByTestId('mandant-anlegen')
  await m.getByLabel('Name').fill('Handwerker Mandant')
  await m.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByTestId('objekt-neu')).toBeVisible()

  await page.goto('/handwerker/neu')
  const h = page.getByTestId('handwerker')
  const suche = page.getByTestId('firmensuche')
  await suche.getByRole('combobox', { name: 'Firma suchen' }).fill('Elektro Musterstadt')
  const vorschlaege = suche.getByRole('option')
  await expect(vorschlaege).toHaveText(['Elektro Muster GmbH, Musterstraße 5, Musterstadt'])
  await expect(suche.getByTestId('websuche')).toHaveAttribute(
    'href',
    /google\.com\/search\?q=Elektro/,
  )
  await vorschlaege.first().click()

  await expect(h.getByLabel('Firma oder Name')).toHaveValue('Elektro Muster GmbH')
  await expect(h.getByLabel('Straße')).toHaveValue('Musterstraße')
  await expect(h.getByLabel('PLZ')).toHaveValue('99999')
  await expect(h.getByLabel('Elektro')).toBeChecked()
  await expect(h.getByLabel('Telefon', { exact: true })).toHaveValue('+49 999 123456')
  await expect(h.getByLabel('E-Mail')).toHaveValue('info@elektro-muster.example')
  await expect(h.getByLabel('Webseite')).toHaveValue('https://elektro-muster.example')
  await expect(page.getByTestId('firma-gefunden')).toContainText('Kontaktdaten bitte prüfen')

  await h.getByRole('button', { name: 'Speichern' }).click()
  await expect(page).toHaveURL(/\/handwerker$/)
  await expect(page.getByText('Elektro Muster GmbH')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Webseite' })).toHaveAttribute(
    'href',
    'https://elektro-muster.example',
  )
  await expect(page.getByText('99999 Musterstadt')).toBeVisible()
})
