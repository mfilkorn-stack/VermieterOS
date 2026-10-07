import postgres from 'postgres'
import { migriere } from './migrate'

/**
 * Nur für Tests: Datenbank anlegen falls nötig, Schemas leeren, Migrationen als Besitzer,
 * Login für App- und Worker-Rolle. Liefert die Verbindungs-URLs der drei Rollen.
 */
export async function bereiteTestdatenbankVor(
  ownerUrl: string,
): Promise<{ ownerUrl: string; appUrl: string; workerUrl: string }> {
  const admin = new URL(ownerUrl)
  const name = admin.pathname.slice(1)
  admin.pathname = '/postgres'
  const a = postgres(admin.toString(), { max: 1, onnotice: () => {} })
  try {
    const da = await a`select 1 from pg_database where datname = ${name}`
    if (da.length === 0) await a.unsafe(`create database "${name}"`)
  } finally {
    await a.end()
  }

  const o = postgres(ownerUrl, { max: 1, onnotice: () => {} })
  try {
    await o.unsafe('DROP SCHEMA IF EXISTS drizzle CASCADE')
    await o.unsafe('DROP SCHEMA IF EXISTS auth CASCADE')
    await o.unsafe('DROP SCHEMA public CASCADE')
    await o.unsafe('CREATE SCHEMA public')
  } finally {
    await o.end()
  }

  await migriere(ownerUrl)

  const o2 = postgres(ownerUrl, { max: 1 })
  try {
    await o2.unsafe(`ALTER ROLE vermieteros_app LOGIN PASSWORD 'app'`)
    await o2.unsafe(`ALTER ROLE vermieteros_worker LOGIN PASSWORD 'worker'`)
  } finally {
    await o2.end()
  }

  const url = (rolle: string, pw: string) => {
    const u = new URL(ownerUrl)
    u.username = rolle
    u.password = pw
    return u.toString()
  }
  return {
    ownerUrl,
    appUrl: url('vermieteros_app', 'app'),
    workerUrl: url('vermieteros_worker', 'worker'),
  }
}
