import { v7 as uuidv7 } from 'uuid'
import type { Tx } from './client'
import { ereignisse, type Akteur, type EreignisTyp } from './schema/index'

/** Schreibt ein Ledger-Ereignis. `seq` und Hash setzt der Trigger. */
export async function ereignis(
  tx: Tx,
  p: {
    mandantId: string
    typ: EreignisTyp
    entitaet: string
    entitaetId: string
    akteur: Akteur
    payload: Record<string, unknown>
  },
): Promise<void> {
  await tx.insert(ereignisse).values({
    id: uuidv7(),
    mandantId: p.mandantId,
    typ: p.typ,
    entitaet: p.entitaet,
    entitaetId: p.entitaetId,
    akteurArt: p.akteur.art,
    akteurId: p.akteur.id,
    payload: p.payload,
  })
}
