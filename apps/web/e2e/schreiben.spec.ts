import { expect, test } from '@playwright/test'
import { extractText, getDocumentProxy } from 'unpdf'
import { konto, registrieren } from './hilfen'

/**
 * WP 1.9: Standardschreiben aus den Stammdaten. Vermieter-Anschrift vom Eigentümer, Wohnung vom
 * Objekt, Mieter und Miete vom Mietverhältnis; jedes Schreiben liegt danach als Dokument vor.
 */
test('Schreiben: Wohnungsgeberbestätigung, Mietschuldenfreiheit, Vermieterbescheinigung', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await registrieren(page, konto('Schreiben Test', 'schreiben'))
  await page.getByTestId('mandant-neu').click()
  const m = page.getByTestId('mandant-anlegen')
  await m.getByLabel('Name').fill('Schreiben Mandant')
  await m.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByTestId('objekt-neu')).toBeVisible()

  await page.goto('/eigentuemer')
  const e = page.getByTestId('eigentuemer')
  await e.getByLabel('Vorname').fill('Erika')
  await e.getByLabel('Nachname').fill('Mustermann')
  await e.getByLabel('Straße').fill('Musterweg')
  await e.getByLabel('Hausnummer').fill('1')
  await e.getByLabel('PLZ').fill('99999')
  await e.getByLabel('Ort').fill('Musterstadt')
  await e.getByLabel('Anteil Zähler').fill('1')
  await e.getByLabel('Nenner').fill('1')
  await e.getByLabel('Gilt ab').fill('2020-01-01')
  await e.getByRole('button', { name: 'Eigentümer anlegen' }).click()
  await expect(page.getByTestId('eigentuemerliste')).toContainText('Erika Mustermann')

  await page.goto('/')
  await page.getByTestId('objekt-neu').click()
  const o = page.getByTestId('objekt-anlegen')
  await o.getByLabel('Bezeichnung').fill('Beispielhaus')
  await o.getByLabel('Im Bestand seit').fill('2020-01-01')
  await o.getByLabel('Straße').fill('Beispielstraße')
  await o.getByLabel('Hausnummer').fill('7')
  await o.getByLabel('PLZ').fill('99999')
  await o.getByLabel('Ort').fill('Musterstadt')
  await o.getByRole('button', { name: 'Anlegen' }).click()
  await page.getByTestId('einheit-neu').click()
  const eh = page.getByTestId('einheit')
  await eh.getByLabel('Bezeichnung').fill('Wohnung 1')
  await eh.getByRole('button', { name: 'Speichern' }).click()
  await page
    .getByTestId('einheitenliste')
    .getByRole('link', { name: 'Mietverhältnisse' })
    .first()
    .click()
  const v = page.getByTestId('vermietung')
  await v.getByLabel('Vorname').first().fill('Max')
  await v.getByLabel('Nachname').fill('Beispiel')
  await v.getByLabel('Mietbeginn').fill('2021-09-01')
  await v.getByLabel('Kaltmiete €').fill('650,00')
  await v.getByRole('button', { name: 'Mietverhältnis anlegen' }).click()
  await expect(page.getByTestId('mietverhaeltnis')).toContainText('Beispiel')
  await page.getByTestId('verlauf-link').click()
  await expect(page.getByTestId('mv-schreiben')).toBeVisible()
  const verlauf = page.url()

  const pdfText = async () => {
    const href = (await page.getByTestId('dokument-download').getAttribute('href'))!
    const r = await page.request.get(href)
    expect(r.headers()['content-type']).toBe('application/pdf')
    const { text } = await extractText(await getDocumentProxy(new Uint8Array(await r.body())), {
      mergePages: true,
    })
    return text.replace(/\s+/g, ' ')
  }

  // Wohnungsgeberbestätigung: alles vorbelegt
  await page.getByTestId('mv-schreiben').click()
  const w = page.getByTestId('schreiben-wohnungsgeber')
  await expect(w.getByLabel(/^Vermieter \(Name/)).toHaveValue(
    'Erika Mustermann\nMusterweg 1\n99999 Musterstadt',
  )
  await w.getByRole('button', { name: 'PDF erstellen' }).click()
  await expect(page.getByTestId('dokument-titel')).toHaveText(
    'Wohnungsgeberbestätigung Einzug 01.09.2021',
  )
  const wt = await pdfText()
  expect(wt).toContain('Einzugsdatum 01.09.2021')
  expect(wt).toContain('Wohnung 1, Beispielstraße 7, 99999 Musterstadt')
  expect(wt).toContain('Max Beispiel')

  // Mietschuldenfreiheit verlangt die Bestätigung der Prüfung
  await page.goto(verlauf)
  await page.getByTestId('mv-schreiben').click()
  const ms = page.getByTestId('schreiben-mietschuldenfreiheit')
  await ms.getByLabel('Ich habe die Zahlungen geprüft').check()
  await ms.getByRole('button', { name: 'PDF erstellen' }).click()
  await expect(page.getByTestId('dokument-titel')).toContainText(
    'Mietschuldenfreiheitsbescheinigung',
  )
  expect(await pdfText()).toContain('Mietrückstände bestehen nicht')

  // Vermieterbescheinigung mit Miete aus der Mietkondition
  await page.goto(verlauf)
  await page.getByTestId('mv-schreiben').click()
  const vb = page.getByTestId('schreiben-vermieterbescheinigung')
  await vb.getByLabel('Zweck (optional)').fill('zur Vorlage beim Jobcenter')
  await vb.getByRole('button', { name: 'PDF erstellen' }).click()
  await expect(page.getByTestId('dokument-titel')).toContainText('Vermieterbescheinigung')
  const vt = await pdfText()
  expect(vt).toContain('Nettokaltmiete 650,00 €')
  expect(vt).toContain('zur Vorlage beim Jobcenter')

  // Alle drei liegen am Mietverhältnis
  await page.goto(verlauf)
  await expect(page.getByTestId('mv-dokumente')).toContainText('Wohnungsgeberbestätigung')
  await expect(page.getByTestId('mv-dokumente')).toContainText('Vermieterbescheinigung')
})
