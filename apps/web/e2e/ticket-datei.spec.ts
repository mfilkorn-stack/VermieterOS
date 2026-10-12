import { expect, test } from '@playwright/test'
import { musterPdf } from '../../../packages/ki/src/testpdf'
import { konto, registrieren } from './hilfen'

/**
 * UX-8: Ticket aus einer hochgeladenen Mängelmeldung. Die KI-Attrappe liest Titel, Beschreibung
 * und Priorität; das Formular ist vorbelegt, erst das Anlegen schreibt das Ticket, die Datei
 * hängt danach am Ticket.
 */
test('Ticket aus Datei: hochladen, auslesen, bestätigen', async ({ page }) => {
  test.setTimeout(90_000)
  await registrieren(page, konto('Ticket Datei', 'tdatei'))
  await page.getByTestId('mandant-neu').click()
  const m = page.getByTestId('mandant-anlegen')
  await m.getByLabel('Name').fill('Ticket Mandant')
  await m.getByRole('button', { name: 'Anlegen' }).click()
  await page.getByTestId('objekt-neu').click()
  const o = page.getByTestId('objekt-anlegen')
  await o.getByLabel('Bezeichnung').fill('Musterweg 1')
  await o.getByLabel('Im Bestand seit').fill('2020-01-01')
  await o.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByTestId('objekt-titel')).toHaveText('Musterweg 1')

  await page.goto('/tickets/neu')
  const f = page.getByTestId('ticket-aus-datei')
  await f.getByLabel(/Datei/).setInputFiles({
    name: 'meldung.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(
      musterPdf([
        [
          'Mängelmeldung',
          'Seit Montagabend bleibt die Heizung im Bad kalt.',
          'Bitte um einen Termin mit dem Heizungsbauer.',
        ],
      ]),
    ),
  })
  await f.getByRole('button', { name: 'Hochladen und auslesen' }).click()
  await expect(page).toHaveURL(/\/tickets\/neu\?dokument=/)
  const t = page.getByTestId('ticket-anlegen')
  await expect(page.getByTestId('ticket-aus-datei-hinweis')).toContainText('meldung.pdf')
  await expect(t.getByLabel('Titel')).toHaveValue('Heizung im Bad bleibt kalt')
  await expect(t.getByLabel('Beschreibung')).toHaveValue(/Montagabend/)
  await expect(t.getByLabel('Priorität')).toHaveValue('hoch')
  // Vorbelegt, nicht festgelegt: der Mensch korrigiert vor dem Anlegen
  await t.getByLabel('Titel').fill('Heizkörper im Bad bleibt kalt')
  await t.getByRole('button', { name: 'Ticket anlegen' }).click()
  await expect(page.getByTestId('ticket-titel')).toHaveText('Heizkörper im Bad bleibt kalt')
  await expect(page.getByTestId('ticket-dateien')).toContainText('meldung.pdf')

  // Die Datei liegt am Ticket, nicht mehr als gültiges Dokument am Objekt
  await page.getByRole('link', { name: 'Musterweg 1' }).first().click()
  await expect(page.getByTestId('dokumentliste').getByTestId('dokument')).toHaveCount(1)
  await expect(page.getByTestId('dokumentliste')).toContainText('ersetzt')
})
