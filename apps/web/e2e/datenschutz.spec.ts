import { expect, test } from '@playwright/test'

/**
 * Datenschutzinformation: ohne Anmeldung erreichbar (Login und Mieterportal verlinken sie),
 * Verantwortlicher aus der Umgebung, Empfänger nach den eingerichteten Diensten.
 */
test('Datenschutzinformation ohne Anmeldung, mit Verantwortlichem und aktiven Diensten', async ({
  page,
}) => {
  await page.goto('/login')
  await page.getByRole('link', { name: 'Datenschutz' }).click()
  await expect(page).toHaveURL(/\/datenschutz$/)
  await expect(page.getByTestId('verantwortlicher')).toContainText('Vermieter Muster')
  await expect(page.getByTestId('verantwortlicher')).toContainText('datenschutz@example.org')
  const empfaenger = page.getByTestId('empfaenger')
  await expect(empfaenger).toContainText('Hetzner Online GmbH')
  // E2E läuft mit KI-Attrappe, Mailversand an GreenMail und Adresssuche
  await expect(empfaenger).toContainText('Anthropic PBC')
  await expect(empfaenger).toContainText('Mailanbieter (127.0.0.1)')
  await expect(empfaenger).toContainText('komoot GmbH')
  await expect(page.getByTestId('datenschutz-ki')).toContainText('nicht zum Training')

  await page.goto('/portal/login')
  await expect(page.getByRole('link', { name: 'Datenschutz' })).toHaveAttribute(
    'href',
    '/datenschutz',
  )
})
