import { expect, test } from '@playwright/test'
import { konto, registrieren } from './hilfen'

/**
 * WP 0.6 Definition of Done: ein echtes Objekt vollständig erfasst, Ampel grün.
 *
 * Struktur und Zahlen nach einem echten Kaufvertrag (ohne Namen, Adressen, Flurstücksnummern):
 * ETW mit 88,89/1000 MEA an zwei Flurstücken (464 m², 331 m²), separat gekaufter Stellplatz
 * (14 m², Alleineigentum am Flurstück), Kaufpreis 187.000 €, Vertrag 30.04.2021, zwei Erwerber
 * zu je 1/2. ANNAHMEN, bis echte Werte vorliegen: Übergang 01.07.2021, Baujahr 1970,
 * Wohnfläche 65 m², Notar 1.500 €, Grundbuch 600 €, Grundschuld-Notar 400 €, Gebäudeanteil 80 %.
 */
test('ETW mit Stellplatz: Onboarding bis alle Ampeln grün', async ({ page }) => {
  test.setTimeout(120_000)
  await registrieren(page, konto('Onboarding Test', 'onboarding'))

  // Mandant: Bruchteilsgemeinschaft
  await expect(page).toHaveURL(/\/mandanten$/)
  await page.getByTestId('mandant-neu').click()
  const m = page.getByTestId('mandant-anlegen')
  await m.getByLabel('Name').fill('Geschwister Muster')
  await m.getByLabel('Art der Eigentümerschaft').selectOption('bruchteil')
  await m.getByRole('button', { name: 'Anlegen' }).click()

  // Objekt anlegen → Objektakte
  await page.getByTestId('objekt-neu').click()
  const o = page.getByTestId('objekt-anlegen')
  await o.getByLabel('Bezeichnung').fill('ETW mit Stellplatz')
  await o.getByLabel('Art').selectOption('etw')
  await o.getByLabel('Im Bestand seit').fill('2021-07-01')
  await o.getByLabel('Straße').fill('Musterweg')
  await o.getByLabel('Hausnummer').fill('18')
  await o.getByLabel('PLZ').fill('99999')
  await o.getByLabel('Ort').fill('Musterstadt')
  await o.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByTestId('objekt-titel')).toHaveText('ETW mit Stellplatz')
  const akte = page.url()
  await expect(page.getByTestId('ampel-steuerpaket')).toHaveAttribute('data-ampel', 'rot')

  // Stammdaten und Grundbuch: zwei Blätter
  await page.goto(`${akte}/stammdaten`)
  const s = page.getByTestId('stammdaten')
  await s.getByLabel('Bundesland').selectOption('BY')
  await s.getByLabel('Baujahr (Fertigstellung)').fill('1970')
  await s.getByLabel('Teil einer Wohnungseigentümergemeinschaft (WEG)').check()
  await page.getByRole('button', { name: 'Grundbuchblatt hinzufügen' }).click()
  const g0 = page.getByTestId('grundbuch-0')
  await g0.getByLabel('Art').selectOption('wohnungsgrundbuch')
  await g0.getByLabel('Amtsgericht').fill('Musterstadt')
  await g0.getByLabel('Blatt', { exact: true }).fill('W-1')
  await g0.getByLabel('Miteigentumsanteil (Zähler)').fill('88,89')
  await g0.getByLabel('Nenner').fill('1000')
  await page.getByTestId('flurstueck-0-0').getByLabel('Flurstück').fill('Flst. A')
  await page.getByTestId('flurstueck-0-0').getByLabel('Fläche m²').fill('464')
  await g0.getByRole('button', { name: 'Flurstück hinzufügen' }).click()
  await page.getByTestId('flurstueck-0-1').getByLabel('Flurstück').fill('Flst. B')
  await page.getByTestId('flurstueck-0-1').getByLabel('Fläche m²').fill('331')
  await page.getByRole('button', { name: 'Grundbuchblatt hinzufügen' }).click()
  const g1 = page.getByTestId('grundbuch-1')
  await g1.getByLabel('Amtsgericht').fill('Musterstadt')
  await g1.getByLabel('Blatt', { exact: true }).fill('G-2')
  await page.getByTestId('flurstueck-1-0').getByLabel('Flurstück').fill('Flst. C')
  await page.getByTestId('flurstueck-1-0').getByLabel('Bezeichnung').fill('Stellplatz')
  await page.getByTestId('flurstueck-1-0').getByLabel('Fläche m²').fill('14')
  await s.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByTestId('grundstuecksflaeche')).toHaveText('84,67 m²')

  // Kauf und AfA
  await page.goto(`${akte}/kauf`)
  const k = page.getByTestId('kauf')
  await k.getByLabel('Datum Kaufvertrag').fill('2021-04-30')
  await k.getByLabel('Übergang von Nutzen und Lasten').fill('2021-07-01')
  await k.getByLabel('Kaufpreis €').fill('187.000,00')
  const positionen: Array<[string, string]> = [
    ['grunderwerbsteuer', '6.545,00'],
    ['notar_kaufvertrag', '1.500,00'],
    ['grundbuch_eigentum', '600,00'],
    ['notar_grundschuld', '400,00'],
  ]
  for (const [i, [art, betrag]] of positionen.entries()) {
    await page.getByRole('button', { name: 'Position hinzufügen' }).click()
    const zeile = page.getByTestId(`nebenkosten-${i}`)
    await zeile.getByLabel('Art').selectOption(art)
    await zeile.getByLabel('Betrag €').fill(betrag)
  }
  await k.getByLabel('Gebäudeanteil %').fill('80')
  // AfA-Satz ist aus dem Baujahr vorbelegt (1925 bis 2022: 2 %)
  await expect(k.getByLabel('AfA-Satz %')).toHaveValue('2,0')
  await k.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByTestId('ak-gesamt')).toHaveText('195.645,00 €')
  await expect(page.getByTestId('ak-gebaeude')).toHaveText('156.516,00 €')
  await expect(page.getByTestId('afa-jahr')).toHaveText('3.130,32 €')
  await expect(page.getByTestId('spekulationsfrist')).toHaveText('30.04.2031')

  // Korrektur eines vorhandenen Werts braucht eine Begründung
  await page.goto(`${akte}/kauf`)
  // Vorschlag aus den Referenzdaten: Bayern 3,5 % am Vertragsdatum
  await expect(page.getByTestId('grest-hinweis')).toContainText('3,5 %, also 6.545,00 €')
  await k.getByLabel('Kaufpreis €').fill('187.500,00')
  await k.getByRole('button', { name: 'Speichern' }).click()
  await expect(k.getByRole('alert')).toContainText('Bitte begründen')
  await expect(k.getByLabel('Kaufpreis €')).toHaveValue('187.500,00')
  await page.goto(akte)

  // Einheiten: Wohnung mit MEA, Stellplatz ohne Fläche
  await page.getByTestId('einheit-neu').click()
  let e = page.getByTestId('einheit')
  await e.getByLabel('Bezeichnung').fill('Wohnung Nr. 1')
  await e.getByLabel('Wohnfläche m²').fill('65,00')
  await e.getByLabel('Miteigentumsanteil (Zähler)').fill('88,89')
  await e.getByLabel('Nenner').fill('1000')
  await e.getByRole('button', { name: 'Speichern' }).click()
  await page.getByTestId('einheit-neu').click()
  e = page.getByTestId('einheit')
  await e.getByLabel('Bezeichnung').fill('Stellplatz')
  await e.getByLabel('Typ').selectOption('stellplatz')
  await e.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByTestId('einheitenliste')).toContainText('Stellplatz')

  // Vermietung der Wohnung (Annahme)
  await page.getByTestId('einheitenliste').getByRole('link', { name: 'Vermietung' }).first().click()
  const v = page.getByTestId('vermietung')
  await v.getByLabel('Nachname').fill('Mieterin')
  await v.getByLabel('Mietbeginn').fill('2021-09-01')
  await v.getByLabel('Kaltmiete €').fill('650,00')
  await v.getByLabel('Vorauszahlung Betriebskosten €').fill('120,00')
  await v.getByLabel('Vorauszahlung Heizkosten €').fill('60,00')
  await v.getByLabel('Kaution €').fill('1.950,00')
  await v.getByRole('button', { name: 'Mietverhältnis anlegen' }).click()
  await expect(page.getByTestId('mietverhaeltnis')).toContainText('Mieterin')

  // Noch rot: Eigentumsanteile der Bruchteilsgemeinschaft fehlen
  await page.goto(akte)
  await expect(page.getByTestId('befunde')).toContainText(
    'Miteigentum ohne vollständige Eigentumsanteile',
  )
  await page.getByRole('link', { name: /Miteigentum ohne vollständige Eigentumsanteile/ }).click()
  await expect(page).toHaveURL(/\/eigentuemer$/)
  for (const nachname of ['Muster A', 'Muster B']) {
    const f = page.getByTestId('eigentuemer')
    await f.getByLabel('Nachname').fill(nachname)
    await f.getByLabel('Anteil Zähler').fill('1')
    await f.getByLabel('Nenner').fill('2')
    await f.getByLabel('Gilt ab').fill('2021-07-01')
    await f.getByRole('button', { name: 'Hinzufügen' }).click()
    await expect(page.getByTestId('eigentuemerliste')).toContainText(nachname)
  }
  await expect(page.getByTestId('anteile-summe')).toHaveText('Summe der Anteile: 1/1')

  // Alles grün
  await page.goto(akte)
  await expect(page.getByTestId('vollstaendig')).toBeVisible()
  for (const modul of ['stammdaten', 'nebenkosten', 'steuerpaket', 'mieterhoehung', 'finanzen']) {
    await expect(page.getByTestId(`ampel-${modul}`)).toHaveAttribute('data-ampel', 'gruen')
  }
})
