import { nachrichtenOhneVorschlag, withMandant, type Db } from '@vermieteros/db'
import { SORTIERUNG } from './aufgaben/sortierung'
import type { KiClient } from './client'
import { fuerNachricht } from './kontext/nachricht'
import { erzeugeVorschlag } from './vorschlag'

/** Nur frische Mails automatisch sortieren; ältere bei Bedarf von Hand. */
const SEIT_TAGEN = 3
/** Nach zwei gescheiterten Versuchen bleibt eine Mail unsortiert, statt laufend Kosten zu erzeugen. */
const MAX_FEHLVERSUCHE = 2

/**
 * Worker-Schritt (WP 1.5): sortiert neue Mails aller Mandanten mit aktivem Postfach.
 * `limit` begrenzt die Modellaufrufe pro Durchlauf über alle Mandanten.
 */
export async function sortiereNeueNachrichten(o: {
  db: Db
  client: KiClient
  mandantIds: string[]
  limit: number
  modell?: string
  log: (text: string) => void
}): Promise<{ sortiert: number; fehler: number }> {
  let sortiert = 0
  let fehler = 0
  for (const mandantId of new Set(o.mandantIds)) {
    const rest = o.limit - sortiert - fehler
    if (rest <= 0) break
    const ids = await withMandant(o.db, mandantId, (tx) =>
      nachrichtenOhneVorschlag(tx, SORTIERUNG.name, {
        seitTagen: SEIT_TAGEN,
        limit: rest,
        maxFehlversuche: MAX_FEHLVERSUCHE,
      }),
    )
    for (const id of ids) {
      try {
        await erzeugeVorschlag(
          {
            db: o.db,
            mandantId,
            akteur: { art: 'system', id: 'worker' },
            client: o.client,
            ...(o.modell ? { modell: o.modell } : {}),
          },
          SORTIERUNG,
          (tx) => fuerNachricht(tx, id),
        )
        sortiert++
      } catch (e) {
        fehler++
        o.log(`Sortierung ${id} gescheitert: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }
  return { sortiert, fehler }
}
