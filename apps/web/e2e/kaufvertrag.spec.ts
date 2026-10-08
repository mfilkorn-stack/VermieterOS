import { expect, test } from '@playwright/test'
import postgres from 'postgres'
import { musterKaufvertrag } from '../../../packages/ki/src/testpdf'
import { konto, registrieren } from './hilfen'
import { E2E } from './umgebung'

/**
 * Kaufvertrag hochladen (Einstieg aus dem Kauf-Schritt), von der KI-Attrappe auslesen lassen,
 * belegte Werte und Grundbuchblätter übernehmen. Ein Blatt mit erfundener Fläche bleibt gesperrt.
 */
test('Kaufvertrag: Hochladen, Auslesen, Übernahme in Kauf und Grundbuch', async ({ page }) => {
  test.setTimeout(120_000)
  await registrieren(page, konto('Kaufvertrag Test', 'kv'))
  await page.getByTestId('mandant-neu').click()
  const m = page.getByTestId('mandant-anlegen')
  await m.getByLabel('Name').fill('Kaufvertrag Mandant')
  await m.getByRole('button', { name: 'Anlegen' }).click()
  await page.getByTestId('objekt-neu').click()
  const o = page.getByTestId('objekt-anlegen')
  await o.getByLabel('Bezeichnung').fill('Musterwohnung')
  await o.getByLabel('Art').selectOption('etw')
  await o.getByLabel('Im Bestand seit').fill('2021-06-01')
  await o.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page).toHaveURL(/\/objekte\/[0-9a-f-]{36}$/)
  const akte = page.url()

  // Einstieg aus dem Kauf-Schritt: noch kein Kaufvertrag, also Hochladen
  await page.goto(akte + '/kauf')
  await page
    .getByTestId('aus-kaufvertrag')
    .getByRole('link', { name: 'Kaufvertrag hochladen' })
    .click()
  const f = page.getByTestId('dokument-hochladen')
  await expect(f.getByLabel('Art')).toHaveValue('kaufvertrag')
  await f.getByLabel(/Datei/).setInputFiles({
    name: 'kaufvertrag.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(musterKaufvertrag()),
  })
  await f.getByLabel('Titel').fill('Kaufvertrag Musterwohnung')
  await f.getByRole('button', { name: 'Hochladen' }).click()
  await expect(page.getByTestId('dokument-titel')).toHaveText('Kaufvertrag Musterwohnung')
  const dokument = page.url()

  await page.getByTestId('kaufvertrag').getByTestId('vertrag-auslesen').getByRole('button').click()
  const werte = page.getByTestId('kaufvertrag-werte')
  await expect(werte.locator('tr[data-feld="kaufpreis"]')).toContainText('187.000,00 €')
  await expect(werte.locator('tr[data-feld="kaufpreis"]')).toContainText('S. 3')
  await expect(werte.locator('tr[data-feld="kaufvertrag_datum"]')).toContainText('30.04.2021')
  await expect(werte.locator('tr[data-feld="uebergang_nutzen_lasten"]')).toHaveCount(0)
  await expect(werte.locator('tr[data-feld="grundbuch_0"]')).toContainText(
    'Wohnungsgrundbuch Musterstadt, Blatt W-1, 8889/100000 MEA',
  )
  await expect(werte.locator('tr[data-feld="grundbuch_1"]')).toContainText(
    'nicht vollständig belegt',
  )
  await expect(werte.locator('tr[data-feld="grundbuch_1"] input')).toHaveCount(0)
  await expect(page.getByTestId('kaufvertrag-hinweise')).toContainText('vollständiger Zahlung')

  await page.getByTestId('kaufvertrag-uebernehmen').getByRole('button').click()
  await expect(page.getByTestId('kaufvertrag-uebernehmen')).toContainText('Übernommen')
  await expect(werte.locator('tr[data-feld="kaufpreis"]')).toContainText('gleich')

  // Kauf-Schritt zeigt die Werte und verweist jetzt auf den vorhandenen Vertrag
  await page.goto(akte + '/kauf')
  const k = page.getByTestId('kauf')
  await expect(k.getByLabel('Datum Kaufvertrag')).toHaveValue('2021-04-30')
  await expect(k.getByLabel('Kaufpreis €')).toHaveValue(/187\.000/)
  await expect(page.getByTestId('aus-kaufvertrag')).toContainText(
    'Kaufvertrag Musterwohnung öffnen',
  )

  // Herkunft: Dokument mit Seite; Gebäudeanteil 80 % aus der Aufteilung im Vertrag
  const sql = postgres(E2E.ownerUrl, { max: 1 })
  try {
    const [v] = await sql<
      {
        herkunft: Record<string, { quelle: string; seite: number; dokumentId: string }>
        gebaeudeanteil_promille: number
      }[]
    >`select herkunft, gebaeudeanteil_promille from objekt_versionen order by erfasst_am desc limit 1`
    expect(v!.herkunft['kaufpreisCent']).toMatchObject({
      quelle: 'dokument',
      seite: 3,
      dokumentId: dokument.split('/').pop(),
    })
    expect(v!.herkunft['gebaeudeanteilPromille']).toMatchObject({ quelle: 'dokument', seite: 3 })
    expect(v!.gebaeudeanteil_promille).toBe(800)
  } finally {
    await sql.end()
  }
  await page.goto(akte + '/stammdaten')
  const s = page.getByTestId('stammdaten')
  await expect(s.getByLabel('Blatt', { exact: true }).first()).toHaveValue('W-1')
  await expect(s.getByLabel('Miteigentumsanteil (Zähler)').first()).toHaveValue('88,89')
  await expect(s.getByLabel('Nenner').first()).toHaveValue('1000')
  // Das Stellplatz-Blatt mit erfundener Fläche wurde nicht übernommen
  await expect(s.getByLabel('Blatt', { exact: true })).toHaveCount(1)
})
