import { defineConfig, devices } from '@playwright/test'
import { E2E } from './e2e/umgebung'

const basisUrl = `http://localhost:${E2E.port}`

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: basisUrl,
    trace: 'retain-on-failure',
    locale: 'de-DE',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm exec next build && pnpm exec next start -p ${E2E.port}`,
    url: `${basisUrl}/login`,
    reuseExistingServer: !process.env['CI'],
    timeout: 240_000,
    stdout: 'pipe',
    env: {
      DATABASE_URL: E2E.appUrl,
      BETTER_AUTH_URL: basisUrl,
      BETTER_AUTH_SECRET: 'e2e-geheimnis-nur-fuer-tests-0123456789',
      AUTH_RATE_LIMIT: 'aus',
      POSTFACH_SCHLUESSEL: E2E.postfachSchluessel,
    },
  },
})
