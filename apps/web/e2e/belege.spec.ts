import { expect, test, type Page } from '@playwright/test'
import postgres from 'postgres'
import { musterRechnung, musterSteuerberatung } from '../../../packages/ki/src/testpdf'
import { konto, registrieren } from './hilfen'
import { E2E } from './umgebung'

async function objektAnlegen(page: Page, bezeichnung: string) {
  await page.goto('/')
  await page.getByTestId('objekt-neu').click()
  const o = page.getByTestId('objekt-anlegen')
  await o.getByLabel('Bezeichnung').fill(bezeichnung)
  await o.getByLabel('Im Bestand seit').fill('2020-01-01')
  await o.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText(bezeichnung)
}

/**
 * WP 1.8: Sammel-Import mit Dublette, Auslesen (KI-Attrappe) mit Fundstellen, Buchen mit einem
 * Klick, Aufteilung auf zwei Objekte, Journal mit Summen und Objektfilter, Storno, Buchung ohne
 * Beleg. Herkunft „Dokument, Seite“ im Journaleintrag.
 */
test('Belege: Import, Auslesen, Buchen, Aufteilen, Journal, Storno', async ({ page }) => {
  test.setTimeout(150_000)
  await registrieren(page, konto('Belege Test', 'beleg'))
  await page.getByTestId('mandant-neu').click()
  const m = page.getByTestId('mandant-anlegen')
  await m.getByLabel('Name').fill('Belege Mandant')
  await m.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByTestId('objekt-neu')).toBeVisible()
  await objektAnlegen(page, 'Musterweg 1')
  await objektAnlegen(page, 'Beispielstraße 7')

  // Sammel-Import: Wasserrechnung, Steuerberatung und die Wasserrechnung noch einmal
  await page.goto('/belege')
  await expect(page.getByTestId('belege-leer')).toBeVisible()
  const imp = page.getByTestId('beleg-import')
  const wasser = Buffer.from(musterRechnung())
  await imp.getByLabel(/Dateien/).setInputFiles([
    { name: 'wasser.pdf', mimeType: 'application/pdf', buffer: wasser },
    {
      name: 'steuerberatung.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(musterSteuerberatung()),
    },
    { name: 'wasser-kopie.pdf', mimeType: 'application/pdf', buffer: wasser },
  ])
  await imp.getByRole('button', { name: 'Hochladen und auslesen' }).click()
  const liste = page.getByTestId('import-liste')
  await expect(liste.locator('li[data-stand="fertig"]')).toHaveCount(2)
  await expect(liste.locator('li[data-stand="doppelt"]')).toHaveCount(1)
  await expect(page.getByTestId('belege-offen').getByTestId('beleg')).toHaveCount(2)

  // Wasserrechnung: belegte Werte vorbelegt, erfundene Rechnungsnummer nicht
  await page.getByTestId('belege-offen').getByRole('link', { name: 'wasser' }).click()
  await expect(page.getByTestId('beleg-status')).toHaveText('offen')
  const werte = page.getByTestId('beleg-werte')
  await expect(werte.locator('tr[data-feld="betrag_brutto"]')).toContainText('S. 1')
  await expect(werte.locator('tr[data-feld="rechnungsnummer"]')).toHaveAttribute(
    'data-pruefung',
    'nicht_belegt',
  )
  const f = page.getByTestId('beleg-buchen')
  await expect(f.getByLabel('Betrag (brutto, €)')).toHaveValue('481,50')
  await expect(f.getByLabel('Zahlungsdatum')).toHaveValue('2026-01-15')
  await expect(f.getByLabel('Leistung von')).toHaveValue('2025-01-01')
  await expect(f.getByLabel('Rechnungsnummer')).toHaveValue('')
  await expect(f.getByLabel('Kategorie')).toHaveValue('betriebskosten')
  await expect(f.getByLabel('umlagefähig')).toBeChecked()
  // Objekt aus der Anschrift im Beleg (am PDF geprüft), nicht geraten
  await expect(
    f.getByTestId('anteil').locator('select[name="anteilObjekt"] option:checked'),
  ).toHaveText('Musterweg 1')
  await expect(f.getByTestId('buchung-aufteilung')).toContainText(
    'Im Beleg steht „Musterweg 1“ (S. 1)',
  )
  await f.getByRole('button', { name: 'Bestätigen und buchen' }).click()

  // Ein Klick pro Beleg: weiter zur Steuerberatung, aufteilen auf beide Objekte
  await expect(page.getByTestId('beleg-titel')).toHaveText('steuerberatung')
  const s = page.getByTestId('beleg-buchen')
  await expect(s.getByLabel('Betrag (brutto, €)')).toHaveValue('714,00')
  await expect(s.getByLabel('Kategorie')).toHaveValue('verwaltungskosten')
  await s.getByLabel('Zahlungsdatum').fill('2026-03-25')
  // „für alle Objekte“: die KI schlägt beide vor, gleichmäßig aufgeteilt
  const anteile = s.getByTestId('anteil').locator('select[name="anteilObjekt"] option:checked')
  await expect(anteile).toHaveText(['Beispielstraße 7', 'Musterweg 1'])
  await expect(s.getByTestId('buchung-aufteilung')).toContainText('gleichmäßig aufgeteilt')
  await s.getByRole('button', { name: 'Bestätigen und buchen' }).click()
  await expect(page.getByTestId('belege-fertig')).toBeVisible()
  await expect(page.getByTestId('belege-gebucht')).toContainText('2026-0001')
  await expect(page.getByTestId('belege-gebucht')).toContainText('2026-0002')

  // Journal: Summen, Objektfilter mit Anteil
  await page.goto('/journal?jahr=2026')
  const j = page.getByTestId('journal-liste')
  await expect(j.getByTestId('journal-eintrag')).toHaveCount(2)
  await expect(page.getByTestId('journal-summen')).toContainText('1.195,50 €')
  await page.getByLabel('Objekt').selectOption({ label: 'Beispielstraße 7' })
  await page.getByRole('button', { name: 'Anzeigen' }).click()
  await expect(j.getByTestId('journal-eintrag')).toHaveCount(1)
  await expect(j).toContainText('357,00 €')

  // Herkunft: Betrag aus dem Beleg mit Seite, Kategorie aus dem bestätigten Vorschlag
  const sql = postgres(E2E.ownerUrl, { max: 1 })
  try {
    const [e] = await sql<{ herkunft: Record<string, { quelle: string; seite?: number }> }[]>`
      select herkunft from journal_eintraege where gegenpartei = 'Stadtwerke Musterstadt GmbH'
      order by erfasst_am desc limit 1`
    expect(e!.herkunft['bruttoCent']).toMatchObject({ quelle: 'dokument', seite: 1 })
    expect(e!.herkunft['steuerkategorie']).toMatchObject({ quelle: 'ki_vorschlag' })
    expect(e!.herkunft['rechnungsnummer']).toBeUndefined()
    expect(e!.herkunft['anteile']).toMatchObject({ quelle: 'dokument', seite: 1 })
  } finally {
    await sql.end()
  }

  // Storno: Eintrag bleibt sichtbar, Beleg ist wieder offen
  await page.goto('/journal?jahr=2026')
  await j.getByRole('link', { name: '2026-0001' }).click()
  await page.getByText('Stornieren').first().click()
  const st = page.getByTestId('journal-stornieren')
  await st.getByLabel('Grund').fill('Falsches Objekt')
  await st.getByRole('button', { name: 'Stornieren' }).click()
  await expect(page.getByTestId('beleg-status')).toHaveText('offen')
  await page.goto('/journal?jahr=2026')
  await expect(j.getByTestId('journal-eintrag')).toHaveCount(1)
  await page.goto('/journal?jahr=2026&storno=1')
  await expect(j.locator('tr.storniert')).toHaveCount(1)

  // Ohne Beleg: Mieteingang
  await page.goto('/journal/neu')
  const n = page.getByTestId('journal-buchen')
  await n.getByLabel('Zahler').fill('Mieterin Beispiel')
  await n.getByLabel('Betrag (brutto, €)').fill('650,00')
  await n.getByLabel('Zahlungsdatum').fill('2026-02-01')
  await n.getByLabel('Kategorie').selectOption('mieteinnahmen')
  await n.getByLabel('Objekt').selectOption({ label: 'Musterweg 1' })
  await n.getByRole('button', { name: 'Buchen' }).click()
  await expect(page.getByTestId('journal-titel')).toContainText('Mieterin Beispiel')
  await expect(page.getByTestId('journal-titel')).toContainText('2026-0003')
})

/** 1×1-PNG: ein Foto ohne Textebene */
const FOTO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

/**
 * Foto eines Belegs: ausgelesen und vorbelegt wie ein PDF, gebucht wird erst nach dem Haken
 * „am Beleg geprüft“. Beleg über den Dokument-Upload: landet ausgelesen im Belegeingang.
 */
test('Belege: Foto mit Bestätigung, Beleg über Dokument-Upload', async ({ page }) => {
  test.setTimeout(120_000)
  await registrieren(page, konto('Belege Foto', 'bfoto'))
  await page.getByTestId('mandant-neu').click()
  const m = page.getByTestId('mandant-anlegen')
  await m.getByLabel('Name').fill('Foto Mandant')
  await m.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByTestId('objekt-neu')).toBeVisible()
  await objektAnlegen(page, 'Musterweg 1')
  const objektId = page.url().split('/').pop()!

  await page.goto('/belege')
  const imp = page.getByTestId('beleg-import')
  await imp
    .getByLabel(/Dateien/)
    .setInputFiles([{ name: 'foto.png', mimeType: 'image/png', buffer: FOTO }])
  await imp.getByRole('button', { name: 'Hochladen und auslesen' }).click()
  await expect(page.getByTestId('import-liste').locator('li[data-stand="fertig"]')).toHaveCount(1)
  await page.getByTestId('belege-offen').getByRole('link', { name: 'foto' }).click()

  const f = page.getByTestId('beleg-buchen')
  // Werte aus dem Foto sind vorbelegt, auch die nicht prüfbare Rechnungsnummer
  await expect(f.getByLabel('Betrag (brutto, €)')).toHaveValue('481,50')
  await expect(f.getByLabel('Rechnungsnummer')).toHaveValue('W-2026-0816')
  await expect(page.getByTestId('beleg-ki')).toContainText('Foto oder Scan')
  const haken = f.getByTestId('scan-bestaetigung').getByRole('checkbox')
  await expect(haken).not.toBeChecked()
  await f.getByLabel('Rechnungsnummer').fill('W-2026-0815')
  await haken.check()
  await f.getByRole('button', { name: 'Bestätigen und buchen' }).click()
  await expect(page.getByTestId('belege-fertig')).toBeVisible()

  // UX-5: Belege sind keine Dokumentart; das Dokumentformular verweist auf die Belege
  await page.goto('/dokumente/neu?objekt=' + objektId + '&typ=beleg')
  const d = page.getByTestId('dokument-hochladen')
  await expect(d.getByLabel('Art')).toHaveValue('sonstiges')
  await expect(d.locator('option[value="beleg"]')).toHaveCount(0)
  await expect(d.getByRole('link', { name: 'Beleg hochladen' })).toHaveAttribute('href', '/belege')
})
