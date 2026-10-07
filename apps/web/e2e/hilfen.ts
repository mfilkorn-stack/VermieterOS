import { expect, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { totp } from './totp'
import { E2E } from './umgebung'

export type Konto = { name: string; email: string; passwort: string; geheimnis: string }

export function konto(name: string, kurz: string): Konto {
  return {
    name,
    email: `${kurz}.${Date.now()}@example.org`,
    passwort: `sehr-geheim-${kurz}-123`,
    geheimnis: '',
  }
}

/** Registrierung mit Pflicht-2FA; danach steht man vor der Mandantenauswahl. */
export async function registrieren(page: Page, p: Konto) {
  await page.goto('/registrieren')
  const f = page.getByTestId('registrieren')
  await f.getByLabel('Name').fill(p.name)
  await f.getByLabel('E-Mail').fill(p.email)
  await f.getByLabel('Passwort (mindestens 12 Zeichen)').fill(p.passwort)
  await f.getByLabel('Passwort wiederholen').fill(p.passwort)
  await f.getByRole('button', { name: 'Konto anlegen' }).click()
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

/** Der Mailversand kommt in Phase 1; die Bestätigung des Links wird hier direkt gesetzt. */
export async function emailBestaetigt(email: string) {
  const sql = postgres(E2E.ownerUrl, { max: 1 })
  try {
    await sql`update auth."user" set email_verified = true where email = ${email}`
  } finally {
    await sql.end()
  }
}

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/** Ein Abruf-Durchlauf des Workers (apps/worker --einmal) mit denselben Schlüsseln wie die Web-App. */
export function workerEinmal() {
  execFileSync('pnpm', ['--silent', '--filter', '@vermieteros/worker', 'abruf'], {
    cwd: wurzel,
    env: {
      ...process.env,
      DATABASE_URL: E2E.workerUrl,
      POSTFACH_SCHLUESSEL: E2E.postfachSchluessel,
      S3_ENDPOINT: E2E.s3.endpoint,
      S3_BUCKET: E2E.s3.bucket,
      S3_ACCESS_KEY: E2E.s3.accessKey,
      S3_SECRET_KEY: E2E.s3.secretKey,
      ANTHROPIC_API_KEY: E2E.ki.schluessel,
      ANTHROPIC_BASE_URL: E2E.ki.url,
    },
    stdio: 'inherit',
  })
}
