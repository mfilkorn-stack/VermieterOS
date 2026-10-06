import { createDb, type Db } from '@vermieteros/db'

/**
 * Laufzeit-Client mit der App-Rolle. Nur über `withMandant()` benutzen (Fachdaten)
 * oder direkt für die Auth-Tabellen im Schema `auth` (ohne RLS).
 */
const globalForDb = globalThis as unknown as { __vermieterosDb?: Db }

export const db: Db =
  globalForDb.__vermieterosDb ??
  createDb(
    process.env['DATABASE_URL'] ?? 'postgres://vermieteros_app:app@127.0.0.1:5432/vermieteros',
    {
      max: 10,
    },
  ).db

if (process.env.NODE_ENV !== 'production') globalForDb.__vermieterosDb = db
