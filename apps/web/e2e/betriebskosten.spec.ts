import { expect, test, type Page } from '@playwright/test'
import { konto, registrieren } from './hilfen'

/**
 * WP 2.4: Betriebskostenabrechnung einer Eigentumswohnung. Kosten aus der WEG-Abrechnung,
 * Heizung vom Messdienst mit CO2-Abzug, Grundsteuer direkt; Ergebnis je Mieter, Prüfung,
 * Übernahme der Positionen ins Folgejahr.
 */
async function position(
  page: Page,
  i: number,
  p: {
    bezeichnung: string
    kostenart: string
    gesamt: string
    schluessel: string
    groesse: string
  },
) {
  await page.getByTestId('bk-position-neu').click()
  const z = page.getByTestId('bk-position').nth(i)
  await z.getByLabel('Bezeichnung').fill(p.bezeichnung)
  await z.getByLabel('Kostenart (§ 2 BetrKV)').selectOption(p.kostenart)
  await z.getByLabel('Gesamtkosten €').fill(p.gesamt)
  await z.getByLabel('Schlüssel').selectOption(p.schluessel)
  await z.locator('input').nth(2).fill(p.groesse)
}

test('Betriebskosten: Abrechnung mit Messdienst, CO2-Abzug, Ergebnis und Folgejahr', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await registrieren(page, konto('BK Test', 'bk'))
  await page.getByTestId('mandant-neu').click()
  const m = page.getByTestId('mandant-anlegen')
  await m.getByLabel('Name').fill('BK Mandant')
  await m.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByTestId('objekt-neu')).toBeVisible()

  await page.getByTestId('objekt-neu').click()
  const o = page.getByTestId('objekt-anlegen')
  await o.getByLabel('Bezeichnung').fill('Musterwohnung')
  await o.getByLabel('Im Bestand seit').fill('2020-01-01')
  await o.getByRole('button', { name: 'Anlegen' }).click()
  await page.getByTestId('einheit-neu').click()
  const eh = page.getByTestId('einheit')
  await eh.getByLabel('Bezeichnung').fill('EG rechts')
  await eh.getByLabel('Wohnfläche m²').fill('59,72')
  await eh.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByTestId('einheitenliste')).toContainText('EG rechts')
  const akte = page.url()
  await page.getByTestId('einheitenliste').getByRole('link', { name: 'Vermietung' }).first().click()
  const v = page.getByTestId('vermietung')
  await v.getByLabel('Nachname').fill('Beispiel')
  await v.getByLabel('Mietbeginn').fill('2022-02-01')
  await v.getByLabel('Kaltmiete €').fill('650,00')
  await v.getByLabel('Vorauszahlung Betriebskosten €').fill('189,00')
  await v.getByRole('button', { name: 'Mietverhältnis anlegen' }).click()
  await expect(page.getByTestId('mietverhaeltnis')).toContainText('Beispiel')

  await page.goto(akte)
  await page.getByTestId('einheitenliste').getByRole('link', { name: 'Betriebskosten' }).click()
  const neu = page.getByTestId('bk-anlegen')
  await neu.getByLabel('Jahr').fill('2024')
  await neu.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByTestId('bk-titel')).toContainText('Betriebskostenabrechnung 2024')

  await position(page, 0, {
    bezeichnung: 'Grundsteuer',
    kostenart: 'grundsteuer',
    gesamt: '177,14',
    schluessel: 'direkt',
    groesse: '177,14',
  })
  await position(page, 1, {
    bezeichnung: 'Gebäudeversicherung',
    kostenart: 'versicherung',
    gesamt: '2.134,46',
    schluessel: 'wohnflaeche',
    groesse: '671,79',
  })
  await page.getByLabel('Abrechnung des Messdienstes liegt vor').check()
  const md = page.getByTestId('bk-messdienst')
  await md.getByLabel('Gesamtkosten aller Nutzer €').fill('11.215,92')
  await md.getByLabel('Betrag der Einheit €').fill('1.455,10')
  await md.getByLabel('Lohnanteil § 35a €').fill('112,24')
  await md.getByLabel('CO2-Kosten Gebäude €').fill('715,26')
  await md.getByLabel('CO2 in kg').fill('15900')
  await md.getByLabel('Wohnfläche Gebäude m²').fill('643,59')
  await md.getByLabel('Tage').fill('366')
  await md.getByLabel('Heizung + Warmwasser Einheit €').fill('1.190,91')
  await md.getByLabel('Heizung + Warmwasser gesamt €').fill('7.721,36')
  await md.getByLabel('CO2-Anteil Vermieter laut Messdienst €').fill('33,10')
  await page
    .getByTestId('bk-formular')
    .getByRole('button', { name: 'Speichern und rechnen' })
    .click()

  // 1.455,10 − 33,10 + 177,14 + 189,75 = 1.788,89 €; Vorauszahlung 12 × 189 € = 2.268 €
  const e = page.getByTestId('bk-ergebnis')
  await expect(e.getByTestId('bk-kosten')).toHaveText('1.788,89 €')
  await expect(e.getByTestId('bk-saldo')).toHaveText('479,11 €')
  await expect(e).toContainText('Guthaben')
  await expect(e).toContainText('abzüglich CO2-Kostenanteil Vermieter (30 %, CO2KostAufG)')
  await expect(e).toContainText('112,24 €')
  // Eingaben bleiben nach dem Speichern erhalten
  await expect(page.getByTestId('bk-position')).toHaveCount(2)
  await expect(page.getByTestId('bk-messdienst').getByLabel('CO2 in kg')).toHaveValue('15900')

  // Folgejahr: Positionen mit Bezugsgrößen übernommen, Beträge leer → Prüfung meldet sie
  await page.getByRole('link', { name: /Betriebskosten EG rechts/ }).click()
  await page.getByTestId('bk-anlegen').getByLabel('Jahr').fill('2025')
  await page.getByTestId('bk-anlegen').getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByTestId('bk-titel')).toContainText('2025')
  await expect(page.getByTestId('bk-position')).toHaveCount(2)
  await expect(page.getByTestId('bk-position').nth(1).locator('input').nth(2)).toHaveValue('671,79')
  await expect(page.getByTestId('bk-befunde').locator('[data-code="betrag_null"]')).toHaveCount(2)
  await expect(
    page.getByTestId('bk-befunde').locator('[data-code="heizkosten_fehlen"]'),
  ).toHaveCount(1)
})
