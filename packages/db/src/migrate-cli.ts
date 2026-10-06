import { migriere } from './migrate'

/** Einstieg für `pnpm --filter @vermieteros/db migrate` und das gebündelte `db/dist/migrate.mjs` im Image. */
const url = process.env['DATABASE_URL_OWNER']
if (!url) {
  console.error('DATABASE_URL_OWNER fehlt')
  process.exit(1)
}
migriere(url)
  .then(() => console.log('Migrationen ausgeführt'))
  .catch((e: unknown) => {
    console.error(e)
    process.exit(1)
  })
