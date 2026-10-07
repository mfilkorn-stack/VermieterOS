import postgres from 'postgres'
import { migriere } from './migrate'

/** Schlüssel der Sperre für die Testvorbereitung (beliebig, aber fest). */
const SPERRE = 7_340_101

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
  // Mehrere Pakete testen parallel, jedes in eigener Datenbank. Rollen gelten aber für den
  // ganzen Cluster: Anlegen und ALTER ROLE nacheinander, sonst „tuple concurrently updated“.
  // Advisory Locks gelten je Datenbank, deshalb hält die Verbindung zu `postgres` die Sperre.
  const a = postgres(admin.toString(), { max: 1, onnotice: () => {} })
  try {
    await a`select pg_advisory_lock(${SPERRE})`
    const da = await a`select 1 from pg_database where datname = ${name}`
    if (da.length === 0) await a.unsafe(`create database "${name}"`)

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
  } finally {
    await a`select pg_advisory_unlock(${SPERRE})`.catch(() => {})
    await a.end()
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
