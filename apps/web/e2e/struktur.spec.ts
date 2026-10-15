import { expect, test } from '@playwright/test'
import { konto, registrieren } from './hilfen'

/**
 * Struktur ohne „Objekte“: Start direkt mit Haus oder Eigentumswohnung, darin Einheiten und
 * Mietverhältnisse. Alles lässt sich löschen, von unten nach oben; was noch daran hängt, steht da.
 */
test('Eigentumswohnung anlegen, Einheit und Mietverhältnis pflegen, alles wieder löschen', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await registrieren(page, konto('Struktur Test', 'struktur'))
  await page.getByTestId('mandant-neu').click()
  const m = page.getByTestId('mandant-anlegen')
  await m.getByLabel('Name').fill('Struktur Mandant')
  await m.getByRole('button', { name: 'Anlegen' }).click()

  // Kein Menüpunkt „Objekte“ mehr; die Übersicht trägt Häuser und Wohnungen
  const menue = page.getByRole('navigation', { name: 'Hauptmenü' })
  await expect(menue.getByRole('link', { name: /^Objekte/ })).toHaveCount(0)
  await expect(page.getByTestId('bereich-reiter')).toContainText('Mieter')
  await expect(page.getByTestId('objekte-leer')).toContainText('Noch keine Häuser oder Wohnungen')

  await page.getByTestId('etw-neu').click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Eigentumswohnung anlegen')
  const o = page.getByTestId('objekt-anlegen')
  await expect(o.getByLabel('Art')).toHaveValue('etw')
  await o.getByLabel('Bezeichnung').fill('Musterweg 1')
  await o.getByLabel('Im Bestand seit').fill('2020-01-01')
  await o.getByRole('button', { name: 'Eigentumswohnung anlegen' }).click()
  await expect(page.getByTestId('objekt-titel')).toHaveText('Musterweg 1')
  const akte = page.url()

  await page.getByTestId('einheit-neu').click()
  const e = page.getByTestId('einheit')
  await e.getByLabel('Bezeichnung').fill('Wohnung')
  await e.getByRole('button', { name: 'Speichern' }).click()
  await page.getByTestId('mieter-anlegen').click()
  const v = page.getByTestId('vermietung')
  await v.getByLabel('Nachname').fill('Beispiel')
  await v.getByLabel('Mietbeginn').fill('2024-02-01')
  await v.getByLabel('Kaltmiete €').fill('800,00')
  await v.getByRole('button', { name: 'Mietverhältnis anlegen' }).click()
  await expect(page.getByTestId('mietverhaeltnis')).toHaveCount(1)

  // Wohnung mit Einheit lässt sich nicht löschen; die Akte sagt, warum
  await page.goto(akte)
  const lw = page.getByTestId('loeschen-objekt')
  await lw.getByText('Eigentumswohnung löschen').click()
  await expect(lw.getByTestId('loesch-hindernisse')).toContainText('Einheiten (zuerst löschen)')

  // Mietverhältnis löschen (Bestätigung nötig)
  await page.getByTestId('einheitenliste').getByRole('link', { name: 'Mietverhältnisse' }).click()
  const lm = page.getByTestId('loeschen-mietverhaeltnis')
  await lm.getByText('Mietverhältnis löschen').click()
  await lm.getByLabel('Ja, Mietverhältnis löschen').check()
  await lm.getByRole('button', { name: 'Endgültig löschen' }).click()
  await expect(page.getByTestId('mietverhaeltnis')).toHaveCount(0)
  await expect(page.getByTestId('neues-mietverhaeltnis')).toBeVisible()

  // Einheit löschen
  await page.goto(akte)
  await page.getByTestId('einheitenliste').getByRole('link', { name: 'Bearbeiten' }).click()
  const le = page.getByTestId('loeschen-einheit')
  await le.getByText('Einheit löschen').click()
  await le.getByLabel('Ja, Einheit löschen').check()
  await le.getByRole('button', { name: 'Endgültig löschen' }).click()
  await expect(page.getByTestId('objekt-titel')).toHaveText('Musterweg 1')
  await expect(page.getByTestId('einheitenliste').locator('li')).toHaveCount(0)

  // Jetzt die Wohnung selbst
  const lw2 = page.getByTestId('loeschen-objekt')
  await lw2.getByText('Eigentumswohnung löschen').click()
  await lw2.getByLabel('Ja, Eigentumswohnung löschen').check()
  await lw2.getByRole('button', { name: 'Endgültig löschen' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByTestId('objekte-leer')).toBeVisible()

  // Die alte Liste leitet zur Übersicht
  await page.goto('/objekte')
  await expect(page).toHaveURL(/\/$/)
})
