import postgres from 'postgres'
import { migriere } from '../src/migrate'

/**
 * Baut die Testdatenbank vor jedem Lauf neu auf: Schema leeren, Migrationen als Besitzer,
 * App-Rolle mit Login versehen. Besitzer ist in Tests der Superuser (lokal, CI).
 */
export default async function setup({
  provide,
}: {
  provide: (k: 'ownerUrl' | 'appUrl', v: string) => void
}) {
  const ownerUrl =
    process.env['TEST_DATABASE_URL'] ??
    'postgres://postgres:postgres@127.0.0.1:5432/vermieteros_test'

  const sql = postgres(ownerUrl, { max: 1 })
  try {
    await sql.unsafe('DROP SCHEMA IF EXISTS drizzle CASCADE')
    await sql.unsafe('DROP SCHEMA IF EXISTS auth CASCADE')
    await sql.unsafe('DROP SCHEMA public CASCADE')
    await sql.unsafe('CREATE SCHEMA public')
  } finally {
    await sql.end()
  }

  await migriere(ownerUrl)

  const sql2 = postgres(ownerUrl, { max: 1 })
  try {
    await sql2.unsafe(`ALTER ROLE vermieteros_app LOGIN PASSWORD 'app'`)
  } finally {
    await sql2.end()
  }

  const u = new URL(ownerUrl)
  u.username = 'vermieteros_app'
  u.password = 'app'
  provide('ownerUrl', ownerUrl)
  provide('appUrl', u.toString())
}

declare module 'vitest' {
  export interface ProvidedContext {
    ownerUrl: string
    appUrl: string
  }
}
