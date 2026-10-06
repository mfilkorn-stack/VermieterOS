import { bereiteTestdatenbankVor } from '@vermieteros/db/testdb'

/**
 * Eigene Datenbank neben der von packages/db, damit beide Testläufe sich nicht stören.
 * Mail- und S3-Dienste startet ops/testdienste.sh (lokal und in CI).
 */
export default async function setup({
  provide,
}: {
  provide: (k: 'ownerUrl' | 'appUrl' | 'workerUrl', v: string) => void
}) {
  const basis = new URL(
    process.env['TEST_DATABASE_URL'] ??
      'postgres://postgres:postgres@127.0.0.1:5432/vermieteros_test',
  )
  basis.pathname = `${basis.pathname}_post`
  const urls = await bereiteTestdatenbankVor(basis.toString())
  provide('ownerUrl', urls.ownerUrl)
  provide('appUrl', urls.appUrl)
  provide('workerUrl', urls.workerUrl)
}

declare module 'vitest' {
  export interface ProvidedContext {
    ownerUrl: string
    appUrl: string
    workerUrl: string
  }
}
