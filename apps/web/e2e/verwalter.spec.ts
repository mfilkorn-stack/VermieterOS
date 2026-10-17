import { expect, test } from '@playwright/test'
import { konto, registrieren } from './hilfen'

/** Stammdaten: WEG- und Mietverwaltung erfassen, Prüfung der Eingaben, Anzeige in der Akte. */
test('Verwalter in den Stammdaten einer Eigentumswohnung', async ({ page }) => {
  test.setTimeout(60_000)
  await registrieren(page, konto('Verwalter Test', 'verwalter'))
  await page.getByTestId('mandant-neu').click()
  const m = page.getByTestId('mandant-anlegen')
  await m.getByLabel('Name').fill('Verwalter Mandant')
  await m.getByRole('button', { name: 'Anlegen' }).click()

  await page.getByTestId('objekt-neu').click()
  const o = page.getByTestId('objekt-anlegen')
  await o.getByLabel('Bezeichnung').fill('Musterweg 1')
  await o.getByLabel('Art').selectOption('etw')
  await o.getByLabel('Im Bestand seit').fill('2020-01-01')
  await o.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByTestId('objekt-titel')).toHaveText('Musterweg 1')
  const akte = page.url()

  await page.goto(akte + '/stammdaten')
  const s = page.getByTestId('stammdaten')
  const weg = s.getByTestId('verwalter-weg')
  // Ohne Firma geht es nicht
  await weg.getByLabel('E-Mail').fill('weg@example.org')
  await s.getByRole('button', { name: 'Änderungen speichern' }).click()
  await expect(s.getByRole('alert')).toContainText('WEG-Verwaltung: Bitte die Firma angeben.')

  await weg.getByLabel('Firma').fill('Muster WEG-Verwaltung')
  await weg.getByLabel('Telefon').fill('0221 123456')
  await s.getByTestId('verwalter-miet').getByLabel('Firma').fill('Beispiel Mietverwaltung')
  await s.getByRole('button', { name: 'Änderungen speichern' }).click()

  await expect(page).toHaveURL(akte)
  const v = page.getByTestId('verwalter')
  await expect(v).toContainText('WEG-Verwaltung · Muster WEG-Verwaltung')
  await expect(v).toContainText('Mietverwaltung · Beispiel Mietverwaltung')
  await expect(v.getByRole('link', { name: /weg@example.org/ })).toHaveAttribute(
    'href',
    'mailto:weg@example.org',
  )

  // Wieder im Formular vorbelegt
  await page.goto(akte + '/stammdaten')
  await expect(page.getByTestId('verwalter-weg').getByLabel('Firma')).toHaveValue(
    'Muster WEG-Verwaltung',
  )
})
