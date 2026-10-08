import { expect, test } from '@playwright/test'
import { musterPdf } from '../../../packages/ki/src/testpdf'
import { konto, registrieren } from './hilfen'

/**
 * WP 2.7: Jahresabschluss je Objekt. Vorjahr als Checkliste mit Links zum Erledigen,
 * laufendes Jahr als Wächter mit „nach Jahresende“.
 */
test('Jahresabschluss: Checkliste, Erledigen über Link, Wächter im laufenden Jahr', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const vorjahr = new Date().getFullYear() - 1
  await registrieren(page, konto('Abschluss Test', 'abschluss'))
  await page.getByTestId('mandant-neu').click()
  const m = page.getByTestId('mandant-anlegen')
  await m.getByLabel('Name').fill('Abschluss Mandant')
  await m.getByRole('button', { name: 'Anlegen' }).click()
  await page.getByTestId('objekt-neu').click()
  const o = page.getByTestId('objekt-anlegen')
  await o.getByLabel('Bezeichnung').fill('Abschlusshaus')
  await o.getByLabel('Im Bestand seit').fill('2020-01-01')
  await o.getByRole('button', { name: 'Anlegen' }).click()
  await page.getByTestId('einheit-neu').click()
  const e = page.getByTestId('einheit')
  await e.getByLabel('Bezeichnung').fill('Wohnung 1')
  await e.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByTestId('einheitenliste')).toContainText('Wohnung 1')
  await page
    .getByTestId('einheitenliste')
    .getByRole('link', { name: 'Mietverhältnisse' })
    .first()
    .click()
  const v = page.getByTestId('vermietung')
  await v.getByLabel('Nachname').fill('Beispiel')
  await v.getByLabel('Mietbeginn').fill(`${vorjahr}-01-01`)
  await v.getByLabel('Kaltmiete €').fill('600,00')
  await v.getByRole('button', { name: 'Mietverhältnis anlegen' }).click()
  await expect(page.getByTestId('mietverhaeltnis')).toContainText('Beispiel')

  await page.goto('/jahresabschluss')
  const k = page.getByTestId('abschluss-objekt')
  await expect(k).toContainText('Abschlusshaus')
  const punkt = (code: string) => k.locator(`[data-code="${code}"]`)
  await expect(punkt('belege')).toHaveAttribute('data-stand', 'erledigt')
  await expect(punkt('grundsteuer')).toHaveAttribute('data-stand', 'offen')
  await expect(punkt('bk')).toHaveAttribute('data-stand', 'offen')
  await expect(punkt('bk')).toContainText('Wohnung 1: nicht angelegt')
  await expect(punkt('steuerpaket')).toHaveAttribute('data-stand', 'offen')
  await expect(k.getByTestId('abschluss-stand')).toHaveText('1 von 5 erledigt')

  // Grundsteuerbescheid über den Link hochladen: Art ist vorbelegt
  await punkt('grundsteuer').getByRole('link', { name: 'erledigen' }).click()
  const f = page.getByTestId('dokument-hochladen')
  await f.getByLabel(/Datei/).setInputFiles({
    name: 'grundsteuer.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(musterPdf([['Grundsteuerbescheid']])),
  })
  await f.getByLabel('Titel').fill('Grundsteuerbescheid')
  await f.getByLabel('Datum des Dokuments').fill(`${vorjahr - 1}-03-01`)
  await f.getByRole('button', { name: 'Hochladen' }).click()
  // UX-7: zurück in den Jahresabschluss, mit Bestätigung
  await expect(page).toHaveURL(/\/jahresabschluss/)
  await expect(page.getByTestId('hinweis')).toContainText('Dokument abgelegt.')
  await expect(punkt('grundsteuer')).toHaveAttribute('data-stand', 'erledigt')
  await expect(k.getByTestId('abschluss-stand')).toHaveText('2 von 5 erledigt')

  // Laufendes Jahr: BK und Steuerpaket kommen erst nach Jahresende
  await page.getByRole('link', { name: /Laufendes Jahr/ }).click()
  await expect(punkt('bk')).toHaveAttribute('data-stand', 'spaeter')
  await expect(punkt('steuerpaket')).toHaveAttribute('data-stand', 'spaeter')
  await expect(punkt('grundsteuer')).toHaveAttribute('data-stand', 'erledigt')
})
