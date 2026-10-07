import { expect, test, type Page } from '@playwright/test'
import { extractText, getDocumentProxy } from 'unpdf'
import { konto, registrieren } from './hilfen'
import { warteAufMail } from './postfach'

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
  const mieterMail = `bk.mieter.${Date.now()}@example.org`
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
  await v.getByLabel('E-Mail').fill(mieterMail)
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

  // Festschreiben mit neuer Vorauszahlung: PDF als Dokument, Abrechnung gesperrt
  const bkUrl = page.url()
  const f = page.getByTestId('bk-festschreiben-formular')
  await f.getByLabel('Datum des Schreibens').fill('2025-11-11')
  await f.getByLabel('Neue Vorauszahlung €').fill('150,00')
  await f.getByLabel('ab').fill('2026-01-01')
  await f.getByRole('button', { name: 'Festschreiben und PDF erstellen' }).click()
  const aus = page.getByTestId('bk-ausgestellt')
  await expect(aus).toContainText('Guthaben 479,11 €')
  await expect(aus).toContainText('neue Vorauszahlung 150,00 € ab 01.01.2026')
  await expect(page.getByTestId('bk-formular')).toHaveCount(0)
  await aus.getByTestId('bk-dokument').click()
  await expect(page.getByTestId('dokument-titel')).toHaveText('Betriebskostenabrechnung 2024')
  const r = await page.request.get(
    (await page.getByTestId('dokument-download').getAttribute('href'))!,
  )
  const { text } = await extractText(await getDocumentProxy(new Uint8Array(await r.body())), {
    mergePages: true,
  })
  const t = text.replace(/\s+/g, ' ')
  expect(t).toContain('Guthaben von 479,11 €')
  expect(t).toContain(
    'senken wir Ihre monatliche Vorauszahlung von bisher 189,00 € um 39,00 € auf 150,00 €',
  )
  expect(t).toContain('Lohnkostenanteil beträgt 112,24 €')
  expect(t).toContain('Wohnfläche: Ihre Wohnung 59,72 m² von 671,79 m² gesamt.')
  expect(t).toContain('Anteil Vermieter 30 %')

  // Versand: per Mail mit PDF (GreenMail) und Vermerk per Post, beides im Ledger
  await page.goto(bkUrl)
  await page.getByTestId('bk-mail').getByRole('button', { name: 'Per Mail senden' }).click()
  await expect(page.getByTestId('bk-versand').first()).toContainText(`an ${mieterMail}`)
  const mail = await warteAufMail(mieterMail, /Betriebskostenabrechnung 2024/)
  expect(mail).toContain('mit einem Guthaben von 479,11 €')
  await page.getByTestId('bk-ausgestellt').getByText('Versand per Post vermerken').click()
  const post = page.getByTestId('bk-post')
  await post.getByLabel('Datum').fill('2025-11-12')
  await post.getByLabel('Notiz').fill('Einwurf-Einschreiben')
  await post.getByRole('button', { name: 'Vermerken' }).click()
  await expect(page.getByTestId('bk-versand')).toHaveCount(2)
  await expect(page.getByTestId('bk-versand').nth(1)).toHaveText(
    'Per Post am 12.11.2025 (Einwurf-Einschreiben)',
  )

  // Korrektur: Festschreibung aufheben, PDF gilt als ersetzt, Entwurf wieder bearbeitbar
  await page.goto(bkUrl)
  await page.getByTestId('bk-ausgestellt').getByText('Korrigieren').click()
  const k = page.getByTestId('bk-aufheben')
  await k.getByLabel('Grund der Korrektur').fill('Grundsteuerbescheid geändert')
  await k.getByRole('button', { name: 'Festschreibung aufheben' }).click()
  await expect(page.getByTestId('bk-formular')).toBeVisible()
  await expect(page.getByTestId('bk-ausgestellt')).toHaveCount(0)

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

  // Frist-Wächter: beide Jahre stehen in der Übersicht, mit Link zur Abrechnung
  await page.goto('/betriebskosten')
  const fristen = page.getByTestId('bk-frist')
  await expect(fristen).toHaveCount(2)
  await expect(fristen.first()).toContainText('2024')
  await expect(fristen.first().getByRole('link', { name: 'Öffnen' })).toBeVisible()
})
