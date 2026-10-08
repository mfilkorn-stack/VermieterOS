import { expect, test } from '@playwright/test'
import { konto, registrieren } from './hilfen'

/**
 * Eine Mietpartei aus mehreren Personen (WG): Anlegen mit zwei Personen, Kontaktdaten ändern,
 * Einzug einer dritten und Auszug einer Person mit angepasster Personenzahl.
 */
test('Mietpartei: WG mit mehreren Personen, Einzug und Auszug', async ({ page }) => {
  test.setTimeout(90_000)
  await registrieren(page, konto('WG Test', 'wg'))
  await page.getByTestId('mandant-neu').click()
  const m = page.getByTestId('mandant-anlegen')
  await m.getByLabel('Name').fill('WG Mandant')
  await m.getByRole('button', { name: 'Anlegen' }).click()

  await page.getByTestId('objekt-neu').click()
  const o = page.getByTestId('objekt-anlegen')
  await o.getByLabel('Bezeichnung').fill('Musterweg 1')
  await o.getByLabel('Im Bestand seit').fill('2020-01-01')
  await o.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByTestId('objekt-titel')).toHaveText('Musterweg 1')
  const objektUrl = page.url()

  await page.getByTestId('einheit-neu').click()
  const e = page.getByTestId('einheit')
  await e.getByLabel('Bezeichnung').fill('2. OG')
  await e.getByLabel('Wohnfläche m²').fill('95,00')
  await e.getByRole('button', { name: 'Speichern' }).click()

  // Freie Einheit: direkter Weg zum Anlegen
  await page.getByTestId('mieter-anlegen').click()
  const v = page.getByTestId('vermietung')
  await v.getByLabel('Vorname').fill('Anna')
  await v.getByLabel('Nachname').fill('Muster')
  await v.getByRole('button', { name: /Weitere Person/ }).click()
  const p2 = v.getByRole('group', { name: 'Person 2' })
  await p2.getByLabel('Vorname').fill('Ben')
  await p2.getByLabel('Nachname').fill('Beispiel')
  await p2.getByLabel('E-Mail').fill('ben@example.org')
  await v.getByLabel('Mietbeginn').fill('2024-02-01')
  await v.getByLabel('Kaltmiete €').fill('1.200,00')
  await v.getByLabel('Personen im Haushalt').fill('2')
  await v.getByRole('button', { name: 'Mietverhältnis anlegen' }).click()

  const mv = page.getByTestId('mietverhaeltnis')
  await expect(mv.getByTestId('mieter-person')).toHaveCount(2)
  await expect(mv.locator('h2')).toContainText('Anna Muster, Ben Beispiel')

  // Kontaktdaten ändern
  await mv
    .getByTestId('mieter-person')
    .filter({ hasText: 'Ben Beispiel' })
    .getByText('Bearbeiten')
    .click()
  const b = page.getByTestId('mieter-bearbeiten-Ben Beispiel')
  await b.getByLabel('Telefon').fill('0221 123456')
  await b.getByRole('button', { name: 'Speichern' }).click()
  await expect(mv.getByTestId('mieter-person').filter({ hasText: 'Ben' })).toContainText(
    '0221 123456',
  )

  // Einzug einer dritten Person, Personenzahl steigt
  await mv.getByText('Weitere Person zieht ein').click()
  const ein = page.getByTestId('mieter-einzug')
  await ein.getByLabel('Vorname').fill('Clara')
  await ein.getByLabel('Nachname').fill('Muster')
  await ein.getByLabel('Einzug am').fill('2025-01-01')
  await ein.getByRole('button', { name: 'Einzug speichern' }).click()
  await expect(mv.getByTestId('mieter-person')).toHaveCount(3)
  await expect(mv.getByLabel('Personen im Haushalt', { exact: true })).toHaveValue('3')

  // Auszug: das Mietverhältnis läuft mit den übrigen weiter
  await mv
    .getByTestId('mieter-person')
    .filter({ hasText: 'Anna Muster' })
    .locator('summary', { hasText: 'Auszug' })
    .click()
  const aus = page.getByTestId('mieter-auszug-Anna Muster')
  await aus.getByLabel('Auszug am').fill('2025-06-01')
  await aus.getByRole('button', { name: 'Auszug speichern' }).click()
  await expect(mv.getByTestId('mieter-person')).toHaveCount(2)
  await expect(mv.locator('h2')).toContainText('Ben Beispiel, Clara Muster')
  await expect(mv.getByLabel('Personen im Haushalt', { exact: true })).toHaveValue('2')

  await page.goto(objektUrl)
  await expect(page.getByText('Ben Beispiel, Clara Muster seit')).toBeVisible()
  await expect(page.getByTestId('mieter-anlegen')).toHaveCount(0)
})
