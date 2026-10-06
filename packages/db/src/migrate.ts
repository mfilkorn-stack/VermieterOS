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

// CLI: pnpm --filter @vermieteros/db migrate
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const url = process.env['DATABASE_URL_OWNER']
  if (!url) {
    console.error('DATABASE_URL_OWNER fehlt')
    process.exit(1)
  }
  migriere(url)
    .then(() => console.log('Migrationen ausgeführt'))
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
}
