/** Verbindungen und Ports für die E2E-Tests. Lokal und in CI über Umgebungsvariablen steuerbar. */
const ownerUrl =
  process.env['E2E_DATABASE_URL'] ?? 'postgres://postgres:postgres@127.0.0.1:5432/vermieteros_e2e'

function als(url: string, rolle: string, passwort: string): string {
  const u = new URL(url)
  u.username = rolle
  u.password = passwort
  return u.toString()
}

export const E2E = {
  ownerUrl,
  appUrl: als(ownerUrl, 'vermieteros_app', 'app'),
  workerUrl: als(ownerUrl, 'vermieteros_worker', 'worker'),
  /** Fester Testschlüssel für Postfach-Passwörter; Web und Worker müssen denselben nutzen. */
  postfachSchluessel: Buffer.alloc(32, 7).toString('base64'),
  s3: {
    endpoint: 'http://127.0.0.1:9100',
    bucket: 'e2e',
    accessKey: 'test',
    secretKey: 'test-geheim',
  },
  imap: { host: '127.0.0.1', port: 3143 },
  smtp: { host: '127.0.0.1', port: 3025 },
  port: Number(process.env['E2E_PORT'] ?? 3100),
}
