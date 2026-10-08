import { expect, test } from '@playwright/test'
import { musterMietvertrag, musterPdf } from '../../../packages/ki/src/testpdf'
import postgres from 'postgres'
import { konto, registrieren } from './hilfen'
import { E2E } from './umgebung'

/**
 * WP 1.7: Mietvertrag hochladen, von der KI (Attrappe) auslesen lassen, belegte Werte mit
 * Seitenangabe übernehmen, Dokument ersetzen. Herkunft „Dokument, Seite“ in den Stammdaten.
 */
test('Mietvertrag: Upload, Auslesen mit Fundstellen, Übernahme, Ersetzen', async ({ page }) => {
  test.setTimeout(120_000)
  await registrieren(page, konto('Dokumente Test', 'dok'))
  await page.getByTestId('mandant-neu').click()
  const m = page.getByTestId('mandant-anlegen')
  await m.getByLabel('Name').fill('Dokumente Mandant')
  await m.getByRole('button', { name: 'Anlegen' }).click()
  await page.getByTestId('objekt-neu').click()
  const o = page.getByTestId('objekt-anlegen')
  await o.getByLabel('Bezeichnung').fill('Haus am Markt')
  await o.getByLabel('Im Bestand seit').fill('2020-01-01')
  await o.getByRole('button', { name: 'Anlegen' }).click()
  await page.getByTestId('einheit-neu').click()
  const e = page.getByTestId('einheit')
  await e.getByLabel('Bezeichnung').fill('Wohnung 1')
  await e.getByRole('button', { name: 'Speichern' }).click()
  await page.getByTestId('einheitenliste').getByRole('link', { name: 'Vermietung' }).first().click()
  const v = page.getByTestId('vermietung')
  await v.getByLabel('Nachname').fill('Beispiel')
  await v.getByLabel('Mietbeginn').fill('2021-09-01')
  await v.getByLabel('Kaltmiete €').fill('600,00')
  await v.getByRole('button', { name: 'Mietverhältnis anlegen' }).click()
  await expect(page.getByTestId('mietverhaeltnis')).toContainText('Beispiel')

  // Zum Verlauf des Mietverhältnisses und dort hochladen
  const vermietung = page.url()
  await page.getByTestId('verlauf-link').click()
  await page.getByTestId('mv-dokument-neu').click()
  const f = page.getByTestId('dokument-hochladen')
  await f.getByLabel(/Datei/).setInputFiles({
    name: 'mietvertrag.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(musterMietvertrag()),
  })
  await f.getByLabel('Titel').fill('Mietvertrag Wohnung 1')
  await f.getByRole('button', { name: 'Hochladen' }).click()
  await expect(page.getByTestId('dokument-titel')).toHaveText('Mietvertrag Wohnung 1')
  await expect(page.getByTestId('dokument-status')).toHaveText('gültig')
  const dl = await page.request.get(
    (await page.getByTestId('dokument-download').getAttribute('href'))!,
  )
  expect(dl.headers()['content-type']).toBe('application/pdf')
  expect((await dl.body()).subarray(0, 5).toString()).toBe('%PDF-')

  // Auslesen: belegte Werte mit Seite, die erfundene Kaution ist nicht belegt
  // Nach dem Hochladen sofort ausgelesen
  const werte = page.getByTestId('vertrag-werte')
  await expect(werte.locator('tr[data-feld="kaltmiete"]')).toContainText('650,00 €')
  await expect(werte.locator('tr[data-feld="kaltmiete"]')).toContainText('S. 2')
  await expect(werte.locator('tr[data-feld="kaltmiete"]')).toContainText('600,00 €')
  await expect(werte.locator('tr[data-feld="kaution"]')).toContainText('nicht belegt')
  await expect(werte.locator('tr[data-feld="kaution"] input')).toHaveCount(0)
  await expect(werte.locator('tr[data-feld="mietbeginn"]')).toContainText('gleich')
  await page.getByTestId('vertrag-uebernehmen').getByRole('button').click()
  await expect(page.getByTestId('vertrag-uebernehmen')).toContainText('Übernommen')
  await expect(werte.locator('tr[data-feld="kaltmiete"]')).toContainText('gleich')
  const dokument = page.url()
  // Herkunft der übernommenen Kaltmiete: Dokument mit Seite, nicht „KI“ (PLAN 4.2)
  const sql = postgres(E2E.ownerUrl, { max: 1 })
  try {
    const [k] = await sql<
      { herkunft: Record<string, { quelle: string; seite: number; dokumentId: string }> }[]
    >`
      select herkunft from mietkondition_versionen order by erfasst_am desc limit 1`
    expect(k!.herkunft['kaltmieteCent']).toMatchObject({
      quelle: 'dokument',
      seite: 2,
      dokumentId: dokument.split('/').pop(),
    })
  } finally {
    await sql.end()
  }
  await page.goto(vermietung)
  await expect(page.getByTestId('mietverhaeltnis')).toContainText('Kaltmiete 650,00 €')
  await page.goto(dokument)

  // Ersetzen: neue Fassung gültig, alte bleibt als „ersetzt“
  const altUrl = page.url()
  await page.getByTestId('dokument-ersetzen').click()
  const r = page.getByTestId('dokument-hochladen')
  await r.getByLabel(/Datei/).setInputFiles({
    name: 'nachtrag.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(musterPdf([['Mietvertrag, neue Fassung (Muster)']])),
  })
  await r.getByLabel('Titel').fill('Mietvertrag Wohnung 1, neue Fassung')
  await r.getByRole('button', { name: 'Hochladen' }).click()
  await expect(page.getByTestId('dokument-titel')).toHaveText('Mietvertrag Wohnung 1, neue Fassung')
  await page.goto(altUrl)
  await expect(page.getByTestId('dokument-status')).toHaveText('ersetzt')
})
