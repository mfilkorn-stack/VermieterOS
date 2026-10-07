import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { unzipSync } from 'fflate'
import { konto, registrieren } from './hilfen'

/**
 * WP 2.6: Steuerpaket einer vermieteten Wohnung für das Vorjahr. Sollmiete als Einnahme,
 * Korrekturen (Mietausfall, Zinsen laut Bescheinigung, weitere Werbungskosten), Festschreiben
 * mit ZIP (Prüfsummen), Korrektur per Aufheben.
 */
test('Steuer: Anlage V vorbereiten, Paket festschreiben und herunterladen', async ({ page }) => {
  test.setTimeout(120_000)
  const jahr = new Date().getFullYear() - 1
  await registrieren(page, konto('Steuer Test', 'steuer'))
  await page.getByTestId('mandant-neu').click()
  const m = page.getByTestId('mandant-anlegen')
  await m.getByLabel('Name').fill('Steuer Mandant')
  await m.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByTestId('objekt-neu')).toBeVisible()

  await page.getByTestId('objekt-neu').click()
  const o = page.getByTestId('objekt-anlegen')
  await o.getByLabel('Bezeichnung').fill('Steuerwohnung')
  await o.getByLabel('Im Bestand seit').fill('2020-01-01')
  await o.getByRole('button', { name: 'Anlegen' }).click()
  await page.getByTestId('einheit-neu').click()
  const eh = page.getByTestId('einheit')
  await eh.getByLabel('Bezeichnung').fill('OG')
  await eh.getByLabel('Wohnfläche m²').fill('50')
  await eh.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByTestId('einheitenliste')).toContainText('OG')
  await page.getByTestId('einheitenliste').getByRole('link', { name: 'Vermietung' }).first().click()
  const v = page.getByTestId('vermietung')
  await v.getByLabel('Nachname').fill('Beispiel')
  await v.getByLabel('Mietbeginn').fill(`${jahr}-01-01`)
  await v.getByLabel('Kaltmiete €').fill('500,00')
  await v.getByLabel('Vorauszahlung Betriebskosten €').fill('100,00')
  await v.getByRole('button', { name: 'Mietverhältnis anlegen' }).click()
  await expect(page.getByTestId('mietverhaeltnis')).toContainText('Beispiel')

  // Übersicht: Vorjahr offen
  await page.goto('/steuer')
  const zelle = page.getByTestId('steuer-zelle').first()
  await expect(zelle).toHaveAttribute('data-status', 'offen')
  await zelle.getByRole('link').click()
  await expect(page.getByTestId('steuer-titel')).toContainText(
    `Einkünfte aus Vermietung ${jahr} · Steuerwohnung`,
  )
  // 12 × 500 € + 12 × 100 € Umlagen
  await expect(page.getByTestId('steuer-einnahmen-summe')).toHaveText('7.200,00 €')
  await expect(page.getByTestId('steuer-befunde')).toContainText('Keine AfA')

  const k = page.getByTestId('steuer-korrekturen')
  await k.getByLabel('Mietausfall €').fill('200,00')
  await k.getByLabel('Schuldzinsen laut Bescheinigung €').fill('1.000,00')
  await k.getByLabel('Bezeichnung').first().fill('Kontoführung')
  await k.getByLabel('Betrag €').first().fill('50,00')
  await k.getByRole('button', { name: 'Speichern und rechnen' }).click()
  await expect(page.getByTestId('steuer-einnahmen-summe')).toHaveText('7.000,00 €')
  await expect(page.getByTestId('steuer-werbungskosten-summe')).toHaveText('1.050,00 €')
  await expect(page.getByTestId('steuer-ueberschuss')).toHaveText('5.950,00 €')
  await expect(page.getByTestId('steuer-korrekturen').getByLabel('Mietausfall €')).toHaveValue(
    '200,00',
  )

  await page
    .getByTestId('steuer-festschreiben-formular')
    .getByRole('button', { name: 'Festschreiben und Paket erstellen' })
    .click()
  await expect(page.getByTestId('steuer-paket')).toBeVisible()
  await expect(page.getByTestId('steuer-korrekturen')).toHaveCount(0)

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('steuer-download').click(),
  ])
  expect(download.suggestedFilename()).toBe(`Steuerpaket_${jahr}_Steuerwohnung.zip`)
  const dateien = unzipSync(new Uint8Array(await readFile((await download.path())!)))
  expect(Object.keys(dateien).sort()).toEqual([
    `journal_${jahr}.csv`,
    'manifest.sha256',
    'pruefprotokoll.txt',
    `uebersicht_${jahr}.pdf`,
  ])
  const manifest = new TextDecoder().decode(dateien['manifest.sha256'])
  for (const z of manifest.trim().split('\n')) {
    const [h, p] = [z.slice(0, 64), z.slice(66)]
    expect(createHash('sha256').update(dateien[p]!).digest('hex')).toBe(h)
  }
  const protokoll = new TextDecoder().decode(dateien['pruefprotokoll.txt'])
  expect(protokoll).toContain('5.950,00 €')
  expect(protokoll).toContain('Schuldzinsen laut Bescheinigung: 1.000,00 €')

  await page.goto('/steuer')
  await expect(page.getByTestId('steuer-zelle').first()).toHaveAttribute(
    'data-status',
    'festgeschrieben',
  )
  await expect(page.getByTestId('steuer-zelle').first()).toContainText('5.950,00 €')

  // Korrektur: Festschreibung aufheben, Entwurf mit den Korrekturen ist wieder da
  await page.getByTestId('steuer-zelle').first().getByRole('link').click()
  await page.getByText('Korrigieren').click()
  const a = page.getByTestId('steuer-aufheben')
  await a.getByLabel('Grund der Korrektur').fill('Zinsbescheinigung korrigiert')
  await a.getByRole('button', { name: 'Festschreibung aufheben' }).click()
  await expect(page.getByTestId('steuer-korrekturen').getByLabel('Mietausfall €')).toHaveValue(
    '200,00',
  )
  await expect(page.getByTestId('steuer-ueberschuss')).toHaveText('5.950,00 €')
})
