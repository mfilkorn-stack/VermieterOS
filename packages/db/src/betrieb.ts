import type {
  Gewerk,
  NotfallArt,
  NotfallEintrag,
  Prioritaet,
  TicketStatus,
  WissenKategorie,
} from '@vermieteros/schema'
import { sql } from 'drizzle-orm'
import type { Tx } from './client'
import { storniereVersion } from './ledger'
import type { Akteur } from './schema/index'

/**
 * Lesefunktionen für Handwerker, Notfallkarte, Wissensbasis und Tickets (WP 1.6).
 * Schreiben läuft über `neueVersion` wie bei allen versionierten Entitäten.
 */

export type HandwerkerZeile = {
  id: string
  firma: string
  ansprechpartner: string | null
  gewerke: Gewerk[]
  telefon: string | null
  notdienstTelefon: string | null
  email: string | null
  notdienst: boolean
  objektIds: string[]
  bewertung: number | null
  notizen: string | null
  gueltigAb: string
}

export async function listeHandwerker(tx: Tx): Promise<HandwerkerZeile[]> {
  return tx.execute<HandwerkerZeile>(sql`
    SELECT handwerker_id AS id, firma, ansprechpartner, gewerke, telefon,
           notdienst_telefon AS "notdienstTelefon", email, notdienst, objekt_ids AS "objektIds",
           bewertung, notizen, gueltig_ab::text AS "gueltigAb"
    FROM handwerker_aktuell ORDER BY lower(firma)`)
}

export type NotfallZeile = {
  art: NotfallArt
  name: string
  telefon: string | null
  hinweis: string | null
  handwerkerId: string | null
}

export type Notfallkarte = {
  id: string
  gueltigAb: string
  eintraege: NotfallEintrag[]
  zeilen: NotfallZeile[]
}

/** Notfallkarte eines Objekts; Zeilen mit Handwerker zeigen dessen aktuelle Firma und Notdienstnummer. */
export async function ladeNotfallkarte(tx: Tx, objektId: string): Promise<Notfallkarte | null> {
  const [k] = await tx.execute<{ id: string; gueltig_ab: string; eintraege: NotfallEintrag[] }>(sql`
    SELECT n.id, a.gueltig_ab::text, a.eintraege FROM notfallkarten n
    JOIN notfallkarten_aktuell a ON a.notfallkarte_id = n.id
    WHERE n.objekt_id = ${objektId}`)
  if (!k) return null
  const handwerker = new Map((await listeHandwerker(tx)).map((h) => [h.id, h]))
  const zeilen = k.eintraege.map((e): NotfallZeile => {
    const h = e.handwerkerId ? handwerker.get(e.handwerkerId) : undefined
    return {
      art: e.art,
      name: h?.firma ?? e.name ?? 'unbekannt',
      telefon: h ? (h.notdienstTelefon ?? h.telefon) : (e.telefon ?? null),
      hinweis: e.hinweis ?? null,
      handwerkerId: e.handwerkerId ?? null,
    }
  })
  return { id: k.id, gueltigAb: k.gueltig_ab, eintraege: k.eintraege, zeilen }
}

export type WissenZeile = {
  id: string
  titel: string
  kategorie: WissenKategorie
  inhalt: string
  mieterSichtbar: boolean
  gueltigAb: string
}

export async function listeWissen(tx: Tx, objektId: string): Promise<WissenZeile[]> {
  return tx.execute<WissenZeile>(sql`
    SELECT w.id, a.titel, a.kategorie, a.inhalt, a.mieter_sichtbar AS "mieterSichtbar",
           a.gueltig_ab::text AS "gueltigAb"
    FROM wissensartikel w JOIN wissensartikel_aktuell a ON a.wissensartikel_id = w.id
    WHERE w.objekt_id = ${objektId}
    ORDER BY a.kategorie, lower(a.titel)`)
}

export const OFFENE_TICKET_STATUS: TicketStatus[] = ['gemeldet', 'beauftragt', 'termin', 'erledigt']

export type TicketZeile = {
  id: string
  objektId: string
  objekt: string
  einheitId: string | null
  einheit: string | null
  mietverhaeltnisId: string | null
  nachrichtId: string | null
  titel: string
  beschreibung: string | null
  status: TicketStatus
  prioritaet: Prioritaet
  auftragnehmerId: string | null
  auftragnehmer: string | null
  termin: string | null
  notizen: string | null
  gueltigAb: string
  angelegtAm: string
  geaendertAm: string
}

const TICKET_SELECT = sql`
  SELECT t.id, t.objekt_id AS "objektId", o.bezeichnung AS objekt,
         t.einheit_id AS "einheitId", e.bezeichnung AS einheit,
         t.mietverhaeltnis_id AS "mietverhaeltnisId", t.nachricht_id AS "nachrichtId",
         a.titel, a.beschreibung, a.status, a.prioritaet, a.auftragnehmer_id AS "auftragnehmerId",
         h.firma AS auftragnehmer, a.termin, a.notizen, a.gueltig_ab::text AS "gueltigAb",
         t.erstellt_am AS "angelegtAm", a.erfasst_am AS "geaendertAm"
  FROM tickets t
  JOIN tickets_aktuell a ON a.ticket_id = t.id
  JOIN objekte_aktuell o ON o.objekt_id = t.objekt_id
  LEFT JOIN einheiten_aktuell e ON e.einheit_id = t.einheit_id
  LEFT JOIN handwerker_aktuell h ON h.handwerker_id = a.auftragnehmer_id`

/** Tickets, dringende zuerst, dann jüngste. `offen`: alles vor „abgeschlossen“ und „verworfen“. */
export async function listeTickets(
  tx: Tx,
  o: { offen?: boolean; objektId?: string; nachrichtId?: string } = {},
): Promise<TicketZeile[]> {
  const bed = [sql`true`]
  if (o.offen) bed.push(sql`a.status IN ('gemeldet', 'beauftragt', 'termin', 'erledigt')`)
  if (o.objektId) bed.push(sql`t.objekt_id = ${o.objektId}`)
  if (o.nachrichtId) bed.push(sql`t.nachricht_id = ${o.nachrichtId}`)
  return tx.execute<TicketZeile>(sql`${TICKET_SELECT}
    WHERE ${sql.join(bed, sql` AND `)}
    ORDER BY CASE a.prioritaet WHEN 'notfall' THEN 0 WHEN 'hoch' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
             t.erstellt_am DESC`)
}

export async function ladeTicket(tx: Tx, id: string): Promise<TicketZeile | null> {
  const [t] = await tx.execute<TicketZeile>(sql`${TICKET_SELECT} WHERE t.id = ${id}`)
  return t ?? null
}

export type TicketSchritt = {
  versionNr: number
  status: TicketStatus
  erfasstAm: string
  erfasstVon: string
  begruendung: string | null
}

/** Verlauf eines Tickets aus seinen Versionen. */
export async function ticketVerlauf(tx: Tx, id: string): Promise<TicketSchritt[]> {
  return tx.execute<TicketSchritt>(sql`
    SELECT v.version_nr AS "versionNr", v.status, v.erfasst_am AS "erfasstAm",
           coalesce(u.name, 'Mieterportal, ' || z.email, v.erfasst_von) AS "erfasstVon",
           v.begruendung
    FROM ticket_versionen v
    LEFT JOIN auth."user" u ON u.id = v.erfasst_von
    LEFT JOIN portal_zugaenge z ON z.id::text = v.erfasst_von
    WHERE v.ticket_id = ${id}
      AND NOT EXISTS (SELECT 1 FROM stornos s WHERE s.version_id = v.id)
    ORDER BY v.version_nr`)
}

/** Gemeldete Tickets, die noch niemand beauftragt hat: Handlung nötig. */
export async function gemeldeteTickets(tx: Tx): Promise<number> {
  const [r] = await tx.execute<{ n: number }>(
    sql`SELECT count(*)::int AS n FROM tickets_aktuell WHERE status = 'gemeldet'`,
  )
  return r?.n ?? 0
}

/** Entfernt einen Datensatz aus allen Sichten: alle noch gültigen Versionen werden storniert. */
export async function storniereAlles(
  tx: Tx,
  p: {
    entitaet: 'wissensartikel' | 'handwerker'
    identId: string
    mandantId: string
    akteur: Akteur
    grund: string
  },
): Promise<number> {
  const tabelle =
    p.entitaet === 'wissensartikel' ? 'wissensartikel_versionen' : 'handwerker_versionen'
  const fk = p.entitaet === 'wissensartikel' ? 'wissensartikel_id' : 'handwerker_id'
  const ids = await tx.execute<{ id: string }>(sql`
    SELECT v.id FROM ${sql.identifier(tabelle)} v
    WHERE ${sql.identifier(fk)} = ${p.identId}
      AND NOT EXISTS (SELECT 1 FROM stornos s WHERE s.version_id = v.id)`)
  for (const v of ids) {
    await storniereVersion(tx, {
      entitaet: p.entitaet,
      versionId: v.id,
      mandantId: p.mandantId,
      akteur: p.akteur,
      grund: p.grund,
    })
  }
  return ids.length
}
