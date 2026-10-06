import { inject } from 'vitest'
import { v7 as uuidv7 } from 'uuid'
import { createDb, type Db } from '../src/client'
import { withMandant } from '../src/mandant'
import { legeMandantAn } from '../src/ledger'
import type { Akteur } from '../src/schema/index'

export const NUTZER: Akteur = { art: 'nutzer', id: 'test-nutzer' }

export function verbindungen(): { app: Db; owner: Db; close: () => Promise<void> } {
  const a = createDb(inject('appUrl'), { max: 2 })
  const o = createDb(inject('ownerUrl'), { max: 2 })
  return {
    app: a.db,
    owner: o.db,
    close: async () => {
      await a.close()
      await o.close()
    },
  }
}

export async function neuerMandant(app: Db, name = 'Test-Eigentümerschaft'): Promise<string> {
  const id = uuidv7()
  await withMandant(app, id, (tx) => legeMandantAn(tx, { id, name, art: 'allein', akteur: NUTZER }))
  return id
}

/** Drizzle verpackt Datenbankfehler; die Postgres-Meldung steht in `cause`. */
export async function erwarteFehler(fn: () => Promise<unknown>, muster: RegExp): Promise<void> {
  let gefangen: unknown
  try {
    await fn()
  } catch (e) {
    gefangen = e
  }
  if (gefangen === undefined)
    throw new Error(`erwartet: Fehler /${muster.source}/, bekommen: kein Fehler`)
  const e = gefangen as { message?: string; cause?: { message?: string } }
  const text = `${e.message ?? ''}\n${e.cause?.message ?? ''}`
  if (!muster.test(text)) throw new Error(`erwartet: /${muster.source}/, bekommen: ${text}`)
}
