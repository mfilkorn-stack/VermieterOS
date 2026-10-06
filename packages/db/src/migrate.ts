import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createDb } from './client'

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations')

/** Führt alle ausstehenden Migrationen aus. Immer mit der Besitzerrolle aufrufen. */
export async function migriere(ownerUrl: string): Promise<void> {
  const { db, close } = createDb(ownerUrl, { max: 1 })
  try {
    await migrate(db, { migrationsFolder })
  } finally {
    await close()
  }
}
