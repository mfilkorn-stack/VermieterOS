import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import postgres from 'postgres'
import { starteKiAttrappe } from './ki-attrappe'
import { E2E } from './umgebung'

/**
 * Frische E2E-Datenbank: anlegen falls nötig, Schemas leeren, Migrationen als Besitzer,
 * App-Rolle mit Passwort. Die Web-App verbindet sich danach als App-Rolle (RLS aktiv).
 */
export default async function globalSetup() {
  const basis = new URL(E2E.ownerUrl)
  const dbName = basis.pathname.slice(1)
  const admin = new URL(E2E.ownerUrl)
  admin.pathname = '/postgres'

  const a = postgres(admin.toString(), { max: 1 })
  try {
    const da = await a`select 1 from pg_database where datname = ${dbName}`
    if (da.length === 0) await a.unsafe(`create database "${dbName}"`)
  } finally {
    await a.end()
  }

  const o = postgres(E2E.ownerUrl, { max: 1 })
  try {
    await o.unsafe('drop schema if exists drizzle cascade')
    await o.unsafe('drop schema if exists auth cascade')
    await o.unsafe('drop schema public cascade')
    await o.unsafe('create schema public')
  } finally {
    await o.end()
  }

  const dbPaket = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'packages', 'db')
  execFileSync('pnpm', ['exec', 'tsx', 'src/migrate-cli.ts'], {
    cwd: dbPaket,
    env: { ...process.env, DATABASE_URL_OWNER: E2E.ownerUrl },
    stdio: 'inherit',
  })

  const o2 = postgres(E2E.ownerUrl, { max: 1 })
  try {
    await o2.unsafe(`alter role vermieteros_app login password 'app'`)
    await o2.unsafe(`alter role vermieteros_worker login password 'worker'`)
  } finally {
    await o2.end()
  }

  const ki = await starteKiAttrappe(E2E.ki.port)
  return () => new Promise<void>((r) => ki.close(() => r()))
}
