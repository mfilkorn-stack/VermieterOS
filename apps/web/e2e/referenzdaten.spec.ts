import { expect, test } from '@playwright/test'
import postgres from 'postgres'
import { konto, registrieren } from './hilfen'
import { E2E } from './umgebung'

/**
 * WP 0.7 Definition of Done: Ein Referenzwert, dessen Prüffrist abgelaufen ist, wird nicht still
 * weiterverwendet, sondern erzeugt sichtbare Warnungen in der Objektakte und in den Referenzdaten.
 * Der überfällige Wert ist ein Mandantenwert, damit globale Daten anderer Tests unberührt bleiben.
 */
test('überfälliger Referenzwert erzeugt sichtbare Warnungen', async ({ page }) => {
  test.setTimeout(90_000)
  await registrieren(page, konto('Referenz Test', 'referenz'))

  await expect(page).toHaveURL(/\/mandanten$/)
  await page.getByTestId('mandant-neu').click()
  const m = page.getByTestId('mandant-anlegen')
  await m.getByLabel('Name').fill('Referenz Mandant')
  await m.getByRole('button', { name: 'Anlegen' }).click()

  await page.getByTestId('objekt-neu').click()
  const o = page.getByTestId('objekt-anlegen')
  await o.getByLabel('Bezeichnung').fill('Haus in Bremen')
  await o.getByLabel('Im Bestand seit').fill('2025-09-01')
  await o.getByLabel('Straße').fill('Musterweg')
  await o.getByLabel('Hausnummer').fill('1')
  await o.getByLabel('PLZ').fill('99999')
  await o.getByLabel('Ort').fill('Musterstadt')
  await o.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByTestId('objekt-titel')).toHaveText('Haus in Bremen')
  const akte = page.url()
  const objektId = akte.split('/').at(-1)!

  await page.goto(`${akte}/stammdaten`)
  const s = page.getByTestId('stammdaten')
  await s.getByLabel('Bundesland').selectOption('HB')
  await s.getByRole('button', { name: 'Speichern' }).click()

  await page.goto(`${akte}/kauf`)
  const k = page.getByTestId('kauf')
  await k.getByLabel('Datum Kaufvertrag').fill('2025-08-01')
  await k.getByLabel('Kaufpreis €').fill('300.000,00')
  await k.getByRole('button', { name: 'Speichern' }).click()
  await expect(page).toHaveURL(akte)

  // Mit aktuellem Seed: Bremen 5,5 % seit 01.07.2025, geprüft, keine Warnung
  await page.goto(`${akte}/kauf`)
  await expect(page.getByTestId('grest-hinweis')).toContainText('5,5 %, also 16.500,00 €')
  await expect(page.getByTestId('grest-hinweis')).not.toContainText('Prüfung überfällig')

  // Eigener Wert des Mandanten mit abgelaufener Prüffrist überdeckt den globalen
  const sql = postgres(E2E.ownerUrl, { max: 1 })
  try {
    await sql`
      insert into referenzdaten (id, mandant_id, art, schluessel, wert, gueltig_von, quelle,
                                 geprueft_am, pruefen_bis, erfasst_von)
      select gen_random_uuid(), o.mandant_id, 'grunderwerbsteuer', 'HB',
             ${sql.json({ satzPromille: 55 })}, date '2025-07-01', 'Eigene Recherche',
             date '2025-07-01', date '2026-01-01', 'e2e'
      from objekte o where o.id = ${objektId}`
  } finally {
    await sql.end()
  }

  await page.goto(`${akte}/kauf`)
  await expect(page.getByTestId('grest-hinweis')).toContainText(
    'Quelle: Eigene Recherche, Prüfung überfällig',
  )

  await page.goto(akte)
  const befund = page
    .getByTestId('befunde')
    .getByRole('link', { name: /Grunderwerbsteuersatz für Bremen ist nicht mehr geprüft/ })
  await expect(befund).toBeVisible()
  await befund.click()
  await expect(page).toHaveURL(/\/referenzdaten$/)
  const hb = page.getByTestId('referenz-HB')
  await expect(hb).toHaveAttribute('data-status', 'ungeprueft')
  await expect(hb).toContainText('Prüfung fällig')
  await expect(page.getByTestId('referenz-BY')).toHaveAttribute('data-status', 'gueltig')
})
