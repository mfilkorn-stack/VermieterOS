/** Verbindungen und Ports für die E2E-Tests. Lokal und in CI über Umgebungsvariablen steuerbar. */
const ownerUrl =
  process.env['E2E_DATABASE_URL'] ?? 'postgres://postgres:postgres@127.0.0.1:5432/vermieteros_e2e'

function alsApp(url: string): string {
  const u = new URL(url)
  u.username = 'vermieteros_app'
  u.password = 'app'
  return u.toString()
}

export const E2E = {
  ownerUrl,
  appUrl: alsApp(ownerUrl),
  port: Number(process.env['E2E_PORT'] ?? 3100),
}
