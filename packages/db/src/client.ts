import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema/index'

/** Flaches Schema für Drizzle: Fachtabellen plus Better-Auth-Tabellen (Schema `auth`). */
const { auth, ...fach } = schema
const flachesSchema = { ...fach, ...auth }

export type Db = PostgresJsDatabase<typeof flachesSchema>
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

export type ClientOptions = {
  /** Verbindungen im Pool. Web: 10, Worker: 5, Tests: 2. */
  max?: number
}

/**
 * Erzeugt einen Drizzle-Client. Für die Laufzeit mit der App-Rolle (`DATABASE_URL`),
 * für Migrationen mit der Besitzerrolle (`DATABASE_URL_OWNER`).
 */
export function createDb(
  url: string,
  options: ClientOptions = {},
): { db: Db; close: () => Promise<void> } {
  const sql = postgres(url, {
    max: options.max ?? 10,
    // Alle Zeitpunkte als ISO-String durchreichen, keine JS-Date-Konvertierung.
    types: {
      date: {
        to: 1184,
        from: [1082, 1114, 1184],
        serialize: (x: string) => x,
        parse: (x: string) => x,
      },
      // int8 (Cent-Beträge, seq) als Number, nicht als String. Sicher bis 2^53.
      bigint: {
        to: 20,
        from: [20],
        serialize: (x: number) => x.toString(),
        parse: (x: string) => Number(x),
      },
    },
    connection: { TimeZone: 'Europe/Berlin' },
  })
  const db = drizzle(sql, { schema: flachesSchema, casing: 'snake_case' })
  return { db, close: () => sql.end({ timeout: 5 }) }
}
