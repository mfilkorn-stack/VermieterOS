import { expect, test } from '@playwright/test'
import { konto, registrieren } from './hilfen'

/**
 * Adresssuche (Photon-Attrappe): Vorschläge beim Tippen, Doppelte und Ausland gefiltert,
 * Auswahl füllt Straße, Hausnummer, PLZ, Ort und Bundesland; Abweichungen werden angezeigt.
 */
test('Adresssuche füllt die Anschrift beim Objekt', async ({ page }) => {
  const p = konto('Adresse Test', 'adr')
  await registrieren(page, p)
  await page.getByTestId('mandant-neu').click()
  const m = page.getByTestId('mandant-anlegen')
  await m.getByLabel('Name').fill('Adress Mandant')
  await m.getByRole('button', { name: 'Anlegen' }).click()
  await page.getByTestId('objekt-neu').click()

  const o = page.getByTestId('objekt-anlegen')
  await o.getByLabel('Bezeichnung').fill('Adresshaus')
  await o.getByLabel('Im Bestand seit').fill('2020-01-01')
  await o.getByRole('combobox', { name: 'Adresse suchen' }).fill('Musterstr')
  const vorschlaege = page.getByTestId('adresssuche').getByRole('option')
  await expect(vorschlaege).toHaveText([
    'Musterstraße 1, 99999 Musterstadt',
    'Musterweg, 99998 Beispielstadt',
  ])

  // Straße ohne Hausnummer: Hausnummer bleibt leer und bekommt den Fokus.
  await vorschlaege.nth(1).click()
  await expect(o.getByLabel('Straße')).toHaveValue('Musterweg')
  await expect(o.getByLabel('Hausnummer')).toHaveValue('')
  await expect(o.getByLabel('Hausnummer')).toBeFocused()
  await expect(page.getByTestId('adresse-geprueft')).toContainText('Hausnummer ergänzen')

  // Per Tastatur die Hausadresse wählen.
  const suche = o.getByRole('combobox', { name: 'Adresse suchen' })
  await suche.fill('Musterstraße 1')
  await expect(vorschlaege.first()).toHaveText('Musterstraße 1, 99999 Musterstadt')
  await suche.press('Enter')
  await expect(o.getByLabel('Straße')).toHaveValue('Musterstraße')
  await expect(o.getByLabel('Hausnummer')).toHaveValue('1')
  await expect(o.getByLabel('PLZ')).toHaveValue('99999')
  await expect(o.getByLabel('Ort')).toHaveValue('Musterstadt')
  await expect(o.getByLabel('Bundesland')).toHaveValue('NW')
  await expect(page.getByTestId('adresse-geprueft')).toHaveText(
    'Anschrift gefunden (OpenStreetMap)',
  )

  await o.getByLabel('PLZ').fill('99990')
  await expect(page.getByTestId('adresse-abweichend')).toBeVisible()
  await o.getByLabel('PLZ').fill('99999')
  await expect(page.getByTestId('adresse-geprueft')).toBeVisible()

  await o.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page).toHaveURL(/\/objekte\/[0-9a-f-]{36}$/)
  await page.goto(page.url() + '/stammdaten')
  const s = page.getByTestId('stammdaten')
  await expect(s.getByLabel('Straße')).toHaveValue('Musterstraße')
  await expect(s.getByLabel('PLZ')).toHaveValue('99999')
  await expect(s.getByLabel('Bundesland')).toHaveValue('NW')
})
