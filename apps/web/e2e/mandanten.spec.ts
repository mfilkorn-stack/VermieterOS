import { expect, test, type Page } from '@playwright/test'
import { totp } from './totp'
import { emailBestaetigt } from './hilfen'

/**
 * WP 0.5 Definition of Done: zwei Mandanten, zwei Nutzer, Isolation über die Oberfläche
 * nachgewiesen. Dazu Einladung mit eingeschränkter Rolle und Anmeldung mit 2FA.
 */

const lauf = Date.now()
const A = {
  name: 'Anna Alpha',
  email: `anna.${lauf}@example.org`,
  passwort: 'sehr-geheim-A-123',
  geheimnis: '',
}
const B = {
  name: 'Bernd Beta',
  email: `bernd.${lauf}@example.org`,
  passwort: 'sehr-geheim-B-123',
  geheimnis: '',
}

test.describe.configure({ mode: 'serial' })

async function registrieren(page: Page, p: typeof A) {
  await page.goto('/registrieren')
  const f = page.getByTestId('registrieren')
  await f.getByLabel('Name').fill(p.name)
  await f.getByLabel('E-Mail').fill(p.email)
  await f.getByLabel('Passwort (mindestens 12 Zeichen)').fill(p.passwort)
  await f.getByLabel('Passwort wiederholen').fill(p.passwort)
  await f.getByRole('button', { name: 'Konto anlegen' }).click()

  // 2FA ist Pflicht: Einrichtung erzwingt die App.
  await expect(page).toHaveURL(/\/sicherheit/)
  await page
    .getByTestId('zwei-faktor-start')
    .getByLabel('Passwort zur Bestätigung')
    .fill(p.passwort)
  await page.getByRole('button', { name: 'Einrichtung starten' }).click()
  p.geheimnis = (await page.getByTestId('totp-geheimnis').textContent())!.trim()
  await page
    .getByTestId('zwei-faktor-bestaetigen')
    .getByLabel('Code aus der App')
    .fill(totp(p.geheimnis))
  await page.getByRole('button', { name: 'Aktivieren' }).click()
}

async function mandantMitObjekt(page: Page, mandant: string, objekt: string, ort: string) {
  // Ohne Mandant landet man in der Mandantenauswahl.
  await expect(page).toHaveURL(/\/mandanten$/)
  await page.getByTestId('mandant-neu').click()
  await page.getByTestId('mandant-anlegen').getByLabel('Name').fill(mandant)
  await page.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByTestId('mandant-name')).toHaveText(mandant)

  await page.getByTestId('objekt-neu').click()
  const f = page.getByTestId('objekt-anlegen')
  await f.getByLabel('Bezeichnung').fill(objekt)
  await f.getByLabel('Im Bestand seit').fill('2021-07-01')
  await f.getByLabel('PLZ').fill('50667')
  await f.getByLabel('Ort').fill(ort)
  await f.getByRole('button', { name: 'Anlegen' }).click()
  // Nach dem Anlegen geht es in die Objektakte.
  await expect(page.getByTestId('objekt-titel')).toHaveText(objekt)
  await page.goto('/')
  await expect(page.getByTestId('objektliste')).toContainText(objekt)
}

test('Mandanten sind über die Oberfläche strikt getrennt, Rollen greifen', async ({ browser }) => {
  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  const a = await ctxA.newPage()
  const b = await ctxB.newPage()

  // Ohne Sitzung: Login.
  await a.goto('/')
  await expect(a).toHaveURL(/\/login/)

  await registrieren(a, A)
  await mandantMitObjekt(a, `Familie Alpha ${lauf}`, 'Alphaweg 1', 'Köln')

  await registrieren(b, B)
  await mandantMitObjekt(b, `Beta GbR ${lauf}`, 'Betastraße 2', 'Bonn')

  // Isolation: jeder sieht nur seinen Mandanten.
  await expect(b.getByTestId('objektliste')).not.toContainText('Alphaweg 1')
  await a.reload()
  await expect(a.getByTestId('objektliste')).toContainText('Alphaweg 1')
  await expect(a.getByTestId('objektliste')).not.toContainText('Betastraße 2')
  await a.goto('/mandanten')
  await expect(a.getByTestId('mandantenliste')).not.toContainText('Beta GbR')

  // A lädt B als Steuerberater ein.
  await a.goto('/mitglieder')
  const e = a.getByTestId('einladen')
  await e.getByLabel('E-Mail').fill(B.email)
  await e.getByLabel('Rolle').selectOption('steuerberater')
  await e.getByRole('button', { name: 'Einladung erstellen' }).click()
  const link = (await a.getByTestId('einladungslink').first().textContent())!.trim()

  // Ohne bestätigte E-Mail keine Einladung, auch mit Link.
  await b.goto(new URL(link).pathname)
  await expect(b.getByTestId('einladung-email-unbestaetigt')).toBeVisible()
  await expect(b.getByRole('button', { name: 'Annehmen' })).toHaveCount(0)

  await emailBestaetigt(B.email)
  await b.goto(new URL(link).pathname)
  await b.getByRole('button', { name: 'Annehmen' }).click()
  await expect(b.getByTestId('mandant-name')).toHaveText(`Familie Alpha ${lauf}`)
  await expect(b.getByText('Deine Rolle: Steuerberater')).toBeVisible()
  await expect(b.getByTestId('objektliste')).toContainText('Alphaweg 1')
  await expect(b.getByTestId('objektliste')).not.toContainText('Betastraße 2')
  // Steuerberater liest nur: kein Anlegen, kein Einladen.
  await expect(b.getByTestId('objekt-neu')).toHaveCount(0)
  await b.goto('/objekte/neu')
  await expect(b).toHaveURL(/\/$/)
  await b.goto('/mitglieder')
  await expect(b.getByTestId('einladen')).toHaveCount(0)

  // Zurück in den eigenen Mandanten: wieder nur die eigenen Objekte.
  await b.goto('/mandanten')
  await b.getByTestId('mandantenliste').getByRole('button', { name: 'Wechseln' }).click()
  await expect(b.getByTestId('mandant-name')).toHaveText(`Beta GbR ${lauf}`)
  await expect(b.getByTestId('objektliste')).toContainText('Betastraße 2')
  await expect(b.getByTestId('objektliste')).not.toContainText('Alphaweg 1')

  await ctxA.close()
  await ctxB.close()
})

test('Anmeldung verlangt den zweiten Faktor', async ({ page }) => {
  await page.goto('/login')
  const f = page.getByTestId('login')
  await f.getByLabel('E-Mail').fill(A.email)
  await f.getByLabel('Passwort').fill(A.passwort)
  await f.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page).toHaveURL(/\/login\/zwei-faktor/)

  const code = page.getByTestId('zwei-faktor').getByLabel('Code')
  await code.fill('000000')
  await page.getByRole('button', { name: 'Bestätigen' }).click()
  await expect(page.getByTestId('zwei-faktor').getByRole('alert')).toHaveText(
    'Der Code stimmt nicht.',
  )
  // Formulare setzen sich bei Fehlern nicht zurück: die Eingabe bleibt stehen.
  await expect(code).toHaveValue('000000')

  await code.fill(totp(A.geheimnis))
  await page.getByRole('button', { name: 'Bestätigen' }).click()
  // Neue Sitzung startet im zuletzt genutzten Mandanten.
  await expect(page.getByTestId('mandant-name')).toHaveText(`Familie Alpha ${lauf}`)
})

test('falsches Passwort wird abgewiesen', async ({ page }) => {
  await page.goto('/login')
  const f = page.getByTestId('login')
  await f.getByLabel('E-Mail').fill(A.email)
  await f.getByLabel('Passwort').fill('falsch-falsch-falsch')
  await f.getByRole('button', { name: 'Anmelden' }).click()
  await expect(f.getByRole('alert')).toHaveText('E-Mail oder Passwort ist falsch.')
})
