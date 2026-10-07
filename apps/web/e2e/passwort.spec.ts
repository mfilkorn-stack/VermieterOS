import { expect, test, type Page } from '@playwright/test'
import { konto, registrieren } from './hilfen'
import { warteAufMail } from './postfach'
import { totp } from './totp'

async function anmeldeVersuch(page: Page, email: string, passwort: string) {
  await page.goto('/login')
  const f = page.getByTestId('login')
  await f.getByLabel('E-Mail').fill(email)
  await f.getByLabel('Passwort').fill(passwort)
  await f.getByRole('button', { name: 'Anmelden' }).click()
}

/**
 * Passwort vergessen: Link per Mail (GreenMail), neues Passwort setzen. Das alte Passwort gilt
 * danach nicht mehr, der Link nur einmal, und die Anmeldung verlangt weiter den zweiten Faktor.
 */
test('Passwort vergessen: Link per Mail, neues Passwort, 2FA bleibt', async ({ browser }) => {
  test.setTimeout(90_000)
  const p = konto('Passwort Vergessen', 'pwv')
  const neu = 'ganz-neues-passwort-456'
  const ctxA = await browser.newContext()
  await registrieren(await ctxA.newPage(), p)

  // Unbekannte Adresse: gleiche Antwort, keine Mail, kein Hinweis auf fehlendes Konto.
  const page = await (await browser.newContext()).newPage()
  await page.goto('/login')
  await page.getByRole('link', { name: 'Passwort vergessen?' }).click()
  const v = page.getByTestId('passwort-vergessen')
  await v.getByLabel('E-Mail').fill(`niemand.${Date.now()}@example.org`)
  await v.getByRole('button', { name: 'Link anfordern' }).click()
  await expect(v).toContainText('Wenn es zu dieser Adresse ein Konto gibt')

  await v.getByLabel('E-Mail').fill(p.email)
  await v.getByRole('button', { name: 'Link anfordern' }).click()
  const text = await warteAufMail(p.email, /Passwort zurücksetzen/)
  const link = /https?:\/\/\S+\/passwort-neu\?token=[\w%-]+/.exec(text)?.[0]
  expect(link).toBeTruthy()

  await page.goto(link!)
  const n = page.getByTestId('passwort-neu')
  await n.getByLabel('Neues Passwort (mindestens 12 Zeichen)').fill(neu)
  await n.getByLabel('Passwort wiederholen').fill(neu)
  await n.getByRole('button', { name: 'Passwort speichern' }).click()
  await expect(page.getByTestId('passwort-geaendert')).toBeVisible()

  // Bestehende Sitzungen sind beendet.
  const alt = await ctxA.newPage()
  await alt.goto('/')
  await expect(alt).toHaveURL(/\/login/)

  // Der Link gilt nur einmal.
  await page.goto(link!)
  await n.getByLabel('Neues Passwort (mindestens 12 Zeichen)').fill('noch-ein-passwort-789')
  await n.getByLabel('Passwort wiederholen').fill('noch-ein-passwort-789')
  await n.getByRole('button', { name: 'Passwort speichern' }).click()
  await expect(n.getByRole('alert')).toHaveText(
    'Der Link ist ungültig oder abgelaufen. Bitte einen neuen anfordern.',
  )

  await anmeldeVersuch(page, p.email, p.passwort)
  await expect(page.getByTestId('login').getByRole('alert')).toHaveText(
    'E-Mail oder Passwort ist falsch.',
  )

  await anmeldeVersuch(page, p.email, neu)
  await expect(page).toHaveURL(/\/login\/zwei-faktor/)
  await page.getByTestId('zwei-faktor').getByLabel('Code').fill(totp(p.geheimnis))
  await page.getByRole('button', { name: 'Bestätigen' }).click()
  await expect(page).not.toHaveURL(/\/login/)
  await ctxA.close()
})
