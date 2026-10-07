import { defineConfig } from '@playwright/test'
import basis from './playwright.config'

/** Rundgang für die Vorschau auf GitHub Pages. Gleiche App, Datenbank und Dienste wie die E2E-Tests. */
export default defineConfig({
  ...basis,
  testDir: './vorschau',
  reporter: 'list',
})
