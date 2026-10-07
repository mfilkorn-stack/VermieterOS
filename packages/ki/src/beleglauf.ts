import { belegeOhneAuszug, withMandant, type Db } from '@vermieteros/db'
import { BELEG_EXTRAKTION } from './aufgaben/beleg'
import type { KiClient } from './client'
import { fuerBeleg } from './kontext/beleg'
import type { DateiQuelle } from './kontext/dokument'
import { erzeugeVorschlag } from './vorschlag'

/** Belege der letzten 30 Tage automatisch auslesen; ältere von Hand. */
const SEIT_TAGEN = 30
const MAX_FEHLVERSUCHE = 2

/**
 * Worker-Schritt (WP 1.8): liest neue Belege aus (belege@-Adresse, Uploads), damit beim
 * Öffnen schon ein Vorschlag bereitliegt. `limit` begrenzt die Modellaufrufe pro Durchlauf.
 */
export async function belegeAuslesen(o: {
  db: Db
  client: KiClient
  quelle: DateiQuelle
  mandantIds: string[]
  limit: number
  modell?: string
  log: (text: string) => void
}): Promise<{ gelesen: number; fehler: number }> {
  let gelesen = 0
  let fehler = 0
  for (const mandantId of new Set(o.mandantIds)) {
    const rest = o.limit - gelesen - fehler
    if (rest <= 0) break
    const ids = await withMandant(o.db, mandantId, (tx) =>
      belegeOhneAuszug(tx, {
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
          BELEG_EXTRAKTION,
          (tx) => fuerBeleg(tx, id, o.quelle),
        )
        gelesen++
      } catch (e) {
        fehler++
        o.log(`Beleg ${id} nicht ausgelesen: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }
  return { gelesen, fehler }
}
