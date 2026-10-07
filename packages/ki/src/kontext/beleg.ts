import {
  ladeDokument,
  ladeTicket,
  objekteFuerBeleg,
  type BelegObjekt,
  type Tx,
} from '@vermieteros/db'
import { seitenTexte } from '../pdf'
import type { DateiQuelle } from './dokument'
import { Referenzen, type Kontext } from './kontext'

export type BelegKontextDaten = {
  titel: string
  dateiname: string
  mime: string
  /** Text je Seite, für die Prüfung der Fundstellen; leer bei Fotos und Scans */
  seiten: string[]
  datei: Uint8Array
  /** Objekte des Mandanten zur Auswahl; die KI darf nur diese IDs vorschlagen */
  objekte: BelegObjekt[]
  /** Beim Upload gewähltes Objekt, falls schon bekannt */
  objektId: string | null
  /** Ticket, zu dem die Rechnung gehört */
  ticket: { titel: string; objektId: string; objekt: string; handwerker: string | null } | null
}

/**
 * Kontext für das Auslesen eines Belegs (WP 1.8, PLAN 4.1 `fuerBelegExtraktion`). Stammt die
 * Rechnung aus einem Ticket, kennt die KI Objekt und Handwerker; sonst wählt sie aus der Liste.
 */
export async function fuerBeleg(
  tx: Tx,
  dokumentId: string,
  quelle: DateiQuelle,
): Promise<Kontext<BelegKontextDaten>> {
  const d = await ladeDokument(tx, dokumentId)
  if (!d) throw new Error(`Beleg ${dokumentId} nicht gefunden`)
  if (d.status !== 'gueltig') throw new Error('Nur gültige Belege werden ausgewertet')
  const t = d.ticketId ? await ladeTicket(tx, d.ticketId) : null
  const datei = new Uint8Array(await quelle.holen(d.speicherSchluessel))
  const objekte = await objekteFuerBeleg(tx)
  const refs = new Referenzen().merke('dokument', d.id).merke('ticket', t?.id)
  for (const o of objekte) refs.merke('objekt', o.id)
  return {
    bezug: { entitaet: 'dokument', id: d.id },
    daten: {
      titel: d.titel,
      dateiname: d.dateiname,
      mime: d.mime,
      seiten: d.mime === 'application/pdf' ? await seitenTexte(datei) : [],
      datei,
      objekte,
      objektId: d.objektId ?? t?.objektId ?? null,
      ticket: t
        ? { titel: t.titel, objektId: t.objektId, objekt: t.objekt, handwerker: t.auftragnehmer }
        : null,
    },
    platzhalter: {},
    referenzen: refs.liste(),
    dokumentIds: [d.id],
  }
}
