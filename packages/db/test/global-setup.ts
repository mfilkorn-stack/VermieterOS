import { bereiteTestdatenbankVor } from '../src/testdb'

/** Baut die Testdatenbank vor jedem Lauf neu auf. Besitzer ist in Tests der Superuser (lokal, CI). */
export default async function setup({
  provide,
}: {
  provide: (k: 'ownerUrl' | 'appUrl' | 'workerUrl', v: string) => void
}) {
  const urls = await bereiteTestdatenbankVor(
    process.env['TEST_DATABASE_URL'] ??
      'postgres://postgres:postgres@127.0.0.1:5432/vermieteros_test',
  )
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
