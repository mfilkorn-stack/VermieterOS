import type {
  BetrkvKostenart,
  Herkunft,
  JournalEintragDaten,
  JournalRichtung,
  Steuerkategorie,
} from '@vermieteros/schema'
import { sql } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import type { Db, Tx } from './client'
import { neueVersion, storniereVersion } from './ledger'
import { ereignisse, journalAnteile, journalEintraege, type Akteur } from './schema/index'

/**
 * Journal und Belegeingang (WP 1.8). Buchungen sind append-only; Korrektur per Storno
 * (`stornos`, entitaet `journaleintrag`) und Neubuchung. Belegnummer und Summenprüfung
 * liegen in der Datenbank (Migration 0022).
 */

export type NeueBuchung = {
  mandantId: string
  akteur: Akteur
  daten: JournalEintragDaten
  dokumentId?: string | null
  ticketId?: string | null
  vorschlagId?: string | null
  herkunft?: Herkunft
}

/** Bucht einen Eintrag mit Anteilen. Die Anteile prüft die Datenbank am Ende der Transaktion. */
export async function bucheJournal(
  tx: Tx,
  b: NeueBuchung,
): Promise<{ id: string; belegnummer: string }> {
  const id = uuidv7()
  const d = b.daten
  const [e] = await tx
    .insert(ereignisse)
    .values({
      id: uuidv7(),
      mandantId: b.mandantId,
      typ: 'journal_gebucht',
      entitaet: 'journaleintrag',
      entitaetId: id,
      versionId: id,
      akteurArt: b.akteur.art,
      akteurId: b.akteur.id,
      payload: {
        richtung: d.richtung,
        bruttoCent: d.bruttoCent,
        zahlungsdatum: d.zahlungsdatum,
        steuerkategorie: d.steuerkategorie,
        dokumentId: b.dokumentId ?? null,
        anteile: d.anteile,
      },
    })
    .returning({ id: ereignisse.id })
  if (!e) throw new Error('Ereignis wurde nicht geschrieben')

  const [r] = await tx
    .insert(journalEintraege)
    .values({
      id,
      mandantId: b.mandantId,
      richtung: d.richtung,
      gegenpartei: d.gegenpartei,
      beschreibung: d.beschreibung ?? null,
      rechnungsnummer: d.rechnungsnummer ?? null,
      rechnungsdatum: d.rechnungsdatum ?? null,
      zahlungsdatum: d.zahlungsdatum,
      leistungVon: d.leistungVon ?? null,
      leistungBis: d.leistungBis ?? null,
      bruttoCent: d.bruttoCent,
      umsatzsteuerCent: d.umsatzsteuerCent ?? null,
      steuerkategorie: d.steuerkategorie,
      verteilungJahre: d.verteilungJahre ?? null,
      kostenart: d.kostenart ?? null,
      umlagefaehig: d.umlagefaehig,
      dokumentId: b.dokumentId ?? null,
      ticketId: b.ticketId ?? null,
      vorschlagId: b.vorschlagId ?? null,
      herkunft: b.herkunft ?? {},
      ereignisId: e.id,
      erfasstVon: b.akteur.id,
    })
    .returning({ belegnummer: journalEintraege.belegnummer })
  await tx.insert(journalAnteile).values(
    d.anteile.map((a) => ({
      id: uuidv7(),
      mandantId: b.mandantId,
      eintragId: id,
      objektId: a.objektId,
      einheitId: a.einheitId ?? null,
      betragCent: a.betragCent,
    })),
  )
  return { id, belegnummer: r?.belegnummer ?? '' }
}

export async function storniereJournal(
  tx: Tx,
  p: { mandantId: string; akteur: Akteur; id: string; grund: string },
): Promise<void> {
  const [schon] = await tx.execute<{ n: number }>(
    sql`SELECT count(*)::int AS n FROM stornos WHERE version_id = ${p.id}`,
  )
  if (schon && schon.n > 0) throw new Error('Eintrag ist bereits storniert')
  await storniereVersion(tx, {
    entitaet: 'journaleintrag',
    mandantId: p.mandantId,
    versionId: p.id,
    akteur: p.akteur,
    grund: p.grund,
  })
}

export type JournalAnteilZeile = {
  objektId: string
  objekt: string
  einheitId: string | null
  einheit: string | null
  betragCent: number
}

export type JournalZeile = {
  id: string
  belegnummer: string
  jahr: number
  richtung: JournalRichtung
  gegenpartei: string
  beschreibung: string | null
  rechnungsnummer: string | null
  rechnungsdatum: string | null
  zahlungsdatum: string
  leistungVon: string | null
  leistungBis: string | null
  bruttoCent: number
  umsatzsteuerCent: number | null
  steuerkategorie: Steuerkategorie
  verteilungJahre: number | null
  kostenart: BetrkvKostenart | null
  umlagefaehig: boolean
  dokumentId: string | null
  ticketId: string | null
  vorschlagId: string | null
  herkunft: Herkunft
  erfasstAm: string
  erfasstVon: string
  anteile: JournalAnteilZeile[]
  storno: { grund: string; erfasstAm: string } | null
}

const ZEILE = sql`
  SELECT e.id, e.belegnummer, e.jahr, e.richtung, e.gegenpartei, e.beschreibung,
         e.rechnungsnummer, e.rechnungsdatum::text AS "rechnungsdatum",
         e.zahlungsdatum::text AS "zahlungsdatum", e.leistung_von::text AS "leistungVon",
         e.leistung_bis::text AS "leistungBis", e.brutto_cent::int AS "bruttoCent",
         e.umsatzsteuer_cent::int AS "umsatzsteuerCent", e.steuerkategorie,
         e.verteilung_jahre AS "verteilungJahre", e.kostenart, e.umlagefaehig,
         e.dokument_id AS "dokumentId", e.ticket_id AS "ticketId", e.vorschlag_id AS "vorschlagId",
         e.herkunft, e.erfasst_am AS "erfasstAm", e.erfasst_von AS "erfasstVon",
         (SELECT json_agg(json_build_object(
                   'objektId', a.objekt_id, 'objekt', o.bezeichnung,
                   'einheitId', a.einheit_id, 'einheit', eh.bezeichnung,
                   'betragCent', a.betrag_cent) ORDER BY o.bezeichnung, eh.bezeichnung)
            FROM journal_anteile a
            LEFT JOIN objekte_aktuell o ON o.objekt_id = a.objekt_id
            LEFT JOIN einheiten_aktuell eh ON eh.einheit_id = a.einheit_id
           WHERE a.eintrag_id = e.id) AS anteile,
         (SELECT json_build_object('grund', s.grund, 'erfasstAm', s.erfasst_am)
            FROM stornos s WHERE s.version_id = e.id) AS storno
  FROM journal_eintraege e`

export async function ladeJournalEintrag(tx: Tx, id: string): Promise<JournalZeile | null> {
  const [r] = await tx.execute<JournalZeile>(sql`${ZEILE} WHERE e.id = ${id}`)
  return r ? { ...r, anteile: r.anteile ?? [] } : null
}

/**
 * Journal eines Zahlungsjahres, jüngste zuerst. Mit `objektId` nur Einträge mit einem Anteil
 * an diesem Objekt. Stornierte Einträge bleiben sichtbar (`storno` gesetzt).
 */
export async function listeJournal(
  tx: Tx,
  o: { jahr: number; objektId?: string | null; mitStorno?: boolean },
): Promise<JournalZeile[]> {
  const bed = [sql`e.jahr = ${o.jahr}`]
  if (o.objektId) {
    bed.push(
      sql`EXISTS (SELECT 1 FROM journal_anteile a WHERE a.eintrag_id = e.id AND a.objekt_id = ${o.objektId})`,
    )
  }
  if (!o.mitStorno) bed.push(sql`NOT EXISTS (SELECT 1 FROM stornos s WHERE s.version_id = e.id)`)
  const rows = await tx.execute<JournalZeile>(
    sql`${ZEILE} WHERE ${sql.join(bed, sql` AND `)} ORDER BY e.zahlungsdatum DESC, e.lfd_nr DESC`,
  )
  return rows.map((r) => ({ ...r, anteile: r.anteile ?? [] }))
}

export type JournalSumme = {
  richtung: JournalRichtung
  steuerkategorie: Steuerkategorie
  summeCent: number
  anzahl: number
}

/**
 * Summen je Steuerkategorie eines Zahlungsjahres, nur gültige Einträge. Mit `objektId` zählt
 * nur der Anteil dieses Objekts (eine aufgeteilte Steuerberatung zählt anteilig).
 */
export async function journalSummen(
  tx: Tx,
  o: { jahr: number; objektId?: string | null },
): Promise<JournalSumme[]> {
  return tx.execute<JournalSumme>(sql`
    SELECT e.richtung, e.steuerkategorie, sum(a.betrag_cent)::int AS "summeCent",
           count(DISTINCT e.id)::int AS anzahl
    FROM journal_gueltig e JOIN journal_anteile a ON a.eintrag_id = e.id
    WHERE e.jahr = ${o.jahr} ${o.objektId ? sql`AND a.objekt_id = ${o.objektId}` : sql``}
    GROUP BY e.richtung, e.steuerkategorie
    ORDER BY e.richtung DESC, e.steuerkategorie`)
}

/** Jahre mit Buchungen, absteigend; das laufende Jahr ist immer dabei. */
export async function journalJahre(tx: Tx, laufendesJahr: number): Promise<number[]> {
  const rows = await tx.execute<{ jahr: number }>(
    sql`SELECT DISTINCT jahr FROM journal_eintraege ORDER BY jahr DESC`,
  )
  return [...new Set([laufendesJahr, ...rows.map((r) => r.jahr)])].sort((a, b) => b - a)
}

/** Buchungen zu einem Beleg, auch stornierte, älteste zuerst. */
export async function buchungenZuBeleg(tx: Tx, dokumentId: string): Promise<JournalZeile[]> {
  const rows = await tx.execute<JournalZeile>(
    sql`${ZEILE} WHERE e.dokument_id = ${dokumentId} ORDER BY e.erfasst_am`,
  )
  return rows.map((r) => ({ ...r, anteile: r.anteile ?? [] }))
}

// ---------------------------------------------------------------------------
// Belegeingang
// ---------------------------------------------------------------------------

export type BelegZeile = {
  id: string
  titel: string
  dateiname: string
  mime: string
  groesseBytes: number
  dateiHash: string
  objektId: string | null
  ticketId: string | null
  anhangId: string | null
  /** Nachricht, aus deren Anhang der Beleg stammt */
  nachrichtId: string | null
  erstelltAm: string
  /** Gültige Buchung, falls vorhanden */
  buchung: { id: string; belegnummer: string; bruttoCent: number } | null
  /** Status des jüngsten KI-Auszugs */
  kiStatus: string | null
}

const BELEG = sql`
  SELECT d.id, a.titel, d.dateiname, d.mime, d.groesse_bytes::int AS "groesseBytes",
         d.datei_hash AS "dateiHash", d.objekt_id AS "objektId", d.ticket_id AS "ticketId",
         d.anhang_id AS "anhangId", an.nachricht_id AS "nachrichtId", d.erstellt_am AS "erstelltAm",
         (SELECT json_build_object('id', g.id, 'belegnummer', g.belegnummer, 'bruttoCent', g.brutto_cent)
            FROM journal_gueltig g WHERE g.dokument_id = d.id LIMIT 1) AS buchung,
         (SELECT v.status FROM ki_vorschlaege_aktuell v
           WHERE v.aufgabe = 'beleg_extraktion' AND v.bezug_entitaet = 'dokument' AND v.bezug_id = d.id
           ORDER BY v.erfasst_am DESC LIMIT 1) AS "kiStatus"
  FROM dokumente d
  JOIN dokumente_aktuell a ON a.dokument_id = d.id
  LEFT JOIN anhaenge an ON an.id = d.anhang_id`

/**
 * Belege: `offen` = gültig und noch nicht gebucht, `gebucht` = mit gültiger Buchung.
 * Rechnungen zu Objekten (Typ `beleg`) zählen mit, auch wenn sie nicht über den Eingang kamen.
 */
export async function listeBelege(
  tx: Tx,
  o: { status: 'offen' | 'gebucht'; limit?: number },
): Promise<BelegZeile[]> {
  const gebucht = sql`EXISTS (SELECT 1 FROM journal_gueltig g WHERE g.dokument_id = d.id)`
  return tx.execute<BelegZeile>(sql`${BELEG}
    WHERE a.typ = 'beleg' AND a.status = 'gueltig'
      AND ${o.status === 'offen' ? sql`NOT ${gebucht}` : gebucht}
    ORDER BY d.erstellt_am ${o.status === 'offen' ? sql`ASC` : sql`DESC`}, d.id
    LIMIT ${o.limit ?? 200}`)
}

export async function ladeBeleg(tx: Tx, id: string): Promise<BelegZeile | null> {
  const [r] = await tx.execute<BelegZeile>(sql`${BELEG} WHERE d.id = ${id} AND a.typ = 'beleg'`)
  return r ?? null
}

/** Rechnungen zu einem Ticket, gebucht oder offen. */
export async function belegeZuTicket(tx: Tx, ticketId: string): Promise<BelegZeile[]> {
  return tx.execute<BelegZeile>(sql`${BELEG}
    WHERE d.ticket_id = ${ticketId} AND a.typ = 'beleg' AND a.status = 'gueltig'
    ORDER BY d.erstellt_am`)
}

export async function offeneBelege(tx: Tx): Promise<number> {
  const [r] = await tx.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM dokumente_aktuell a
    WHERE a.typ = 'beleg' AND a.status = 'gueltig'
      AND NOT EXISTS (SELECT 1 FROM journal_gueltig g WHERE g.dokument_id = a.dokument_id)`)
  return r?.n ?? 0
}

/** Gibt es diesen Beleg schon (gleiche Prüfsumme, gültig)? Für den Sammel-Import. */
export async function belegMitHash(tx: Tx, dateiHash: string): Promise<string | null> {
  const [r] = await tx.execute<{ id: string }>(sql`
    SELECT d.id FROM dokumente d JOIN dokumente_aktuell a ON a.dokument_id = d.id
    WHERE d.datei_hash = ${dateiHash} AND a.typ = 'beleg' AND a.status = 'gueltig'
    LIMIT 1`)
  return r?.id ?? null
}

/** Worker: Belege ohne KI-Auszug, älteste zuerst, mit Fehlerbremse wie bei der Sortierung. */
export async function belegeOhneAuszug(
  tx: Tx,
  o: { seitTagen: number; limit: number; maxFehlversuche: number },
): Promise<string[]> {
  const rows = await tx.execute<{ id: string }>(sql`
    SELECT d.id FROM dokumente d JOIN dokumente_aktuell a ON a.dokument_id = d.id
    WHERE a.typ = 'beleg' AND a.status = 'gueltig'
      AND d.erstellt_am > now() - make_interval(days => ${o.seitTagen})
      AND NOT EXISTS (SELECT 1 FROM journal_eintraege g WHERE g.dokument_id = d.id)
      AND NOT EXISTS (
        SELECT 1 FROM ki_vorschlaege v
        WHERE v.aufgabe = 'beleg_extraktion' AND v.bezug_entitaet = 'dokument' AND v.bezug_id = d.id)
      AND (SELECT count(*) FROM ereignisse e
           WHERE e.typ = 'ki_aufruf'
             AND e.payload->'bezug'->>'id' = d.id::text
             AND e.payload->>'promptVersion' LIKE 'beleg_extraktion@%'
             AND e.payload->>'ok' = 'false') < ${o.maxFehlversuche}
    ORDER BY d.erstellt_am, d.id
    LIMIT ${o.limit}`)
  return rows.map((r) => r.id)
}

export type BelegObjekt = {
  id: string
  bezeichnung: string
  anschrift: string | null
  einheiten: { id: string; bezeichnung: string }[]
}

/** Objekte mit Anschrift und Einheiten: Auswahl beim Buchen und Kontext für die KI. */
export async function objekteFuerBeleg(tx: Tx): Promise<BelegObjekt[]> {
  const rows = await tx.execute<BelegObjekt>(sql`
    SELECT o.objekt_id AS id, o.bezeichnung,
           nullif(concat_ws(', ', nullif(concat_ws(' ', o.strasse, o.hausnummer), ''),
                                  nullif(concat_ws(' ', o.plz, o.ort), '')), '') AS anschrift,
           (SELECT json_agg(json_build_object('id', e.einheit_id, 'bezeichnung', e.bezeichnung)
                            ORDER BY e.bezeichnung)
              FROM einheiten_aktuell e JOIN einheiten ei ON ei.id = e.einheit_id
             WHERE ei.objekt_id = o.objekt_id) AS einheiten
    FROM objekte_aktuell o
    ORDER BY o.bezeichnung`)
  return rows.map((r) => ({ ...r, einheiten: r.einheiten ?? [] }))
}

/**
 * Worker: Mandanten mit Dokumenten der letzten Tage, auch ohne Postfach (Belege per Upload).
 * SECURITY-DEFINER-Funktion, liefert nur IDs; gelesen wird danach im Mandantenkontext.
 */
export async function mandantenMitNeuenDokumenten(db: Db, seitTagen: number): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(
    sql`SELECT mandanten_mit_neuen_dokumenten(${seitTagen}) AS id`,
  )
  return rows.map((r) => r.id)
}

/** Dateitypen, die als Beleg taugen; Signaturen, vCards und Kalendereinträge bleiben in der Mail. */
export const BELEG_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const

/**
 * Mail an die Beleg-Adresse (WP 1.8): jeder PDF- oder Bild-Anhang wird ein Beleg im Eingang,
 * ohne Objekt; Objekt und Aufteilung entstehen beim Buchen. Derselbe Anhang wird nie zweimal
 * abgelegt, eine bereits vorhandene Datei (gleiche Prüfsumme) auch nicht.
 */
export async function legeBelegeAusNachrichtAn(
  tx: Tx,
  p: { mandantId: string; nachrichtId: string; akteur: Akteur; heute: string },
): Promise<number> {
  const anhaenge = await tx.execute<{
    id: string
    dateiname: string
    mimeTyp: string
    groesse: number
    sha256: string
    schluessel: string
    betreff: string
  }>(sql`
    SELECT a.id, a.dateiname, a.mime_typ AS "mimeTyp", a.groesse::int AS groesse, a.sha256,
           a.schluessel, n.betreff
    FROM anhaenge a JOIN nachrichten n ON n.id = a.nachricht_id
    WHERE a.nachricht_id = ${p.nachrichtId}
      AND a.mime_typ IN (${sql.join(
        BELEG_MIME.map((m) => sql`${m}`),
        sql`, `,
      )})
      AND NOT EXISTS (SELECT 1 FROM dokumente d WHERE d.anhang_id = a.id AND d.beleg)
    ORDER BY a.dateiname`)
  let n = 0
  for (const a of anhaenge) {
    if (await belegMitHash(tx, a.sha256)) continue
    await neueVersion(tx, {
      entitaet: 'dokument',
      mandantId: p.mandantId,
      akteur: p.akteur,
      gueltigAb: p.heute,
      identitaet: {
        beleg: true,
        anhangId: a.id,
        dateiHash: a.sha256,
        speicherSchluessel: a.schluessel,
        dateiname: a.dateiname,
        mime: a.mimeTyp,
        groesseBytes: a.groesse,
      },
      daten: {
        typ: 'beleg',
        status: 'gueltig',
        titel: (a.betreff.trim() || a.dateiname).slice(0, 200),
      },
    })
    n++
  }
  return n
}
