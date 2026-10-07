import type { ZuordnungArt } from '@vermieteros/schema'
import { eq, sql } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import type { Db, Tx } from './client'
import {
  anhaenge,
  ereignisse,
  nachrichten,
  nachrichtZuordnungen,
  postfaecher,
} from './schema/index'
import type { Akteur, EreignisTyp } from './schema/index'

/**
 * Mail-Eingang (WP 1.1): Postfächer, Nachrichten, Anhänge, Zuordnungen.
 * Alle Funktionen mit `tx` laufen im Mandantenkontext (`withMandant`), RLS greift.
 */

async function ereignis(
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

// ---------------------------------------------------------------------------
// Postfächer
// ---------------------------------------------------------------------------

export type PostfachEinstellungen = {
  bezeichnung: string
  host: string
  port: number
  tls: boolean
  benutzer: string
  ordner: string
  abrufAb: string
}

/** Spalten, die die App-Rolle lesen darf (ohne `passwort_chiffre`). */
const postfachSpalten = {
  id: postfaecher.id,
  mandantId: postfaecher.mandantId,
  bezeichnung: postfaecher.bezeichnung,
  host: postfaecher.host,
  port: postfaecher.port,
  tls: postfaecher.tls,
  benutzer: postfaecher.benutzer,
  ordner: postfaecher.ordner,
  abrufAb: postfaecher.abrufAb,
  aktiv: postfaecher.aktiv,
  letzterAbruf: postfaecher.letzterAbruf,
  letzterFehler: postfaecher.letzterFehler,
}
export type Postfach = {
  [K in keyof typeof postfachSpalten]: (typeof postfaecher.$inferSelect)[K]
}

export async function legePostfachAn(
  tx: Tx,
  p: PostfachEinstellungen & { mandantId: string; passwortChiffre: string; akteur: Akteur },
): Promise<string> {
  const id = uuidv7()
  await tx.insert(postfaecher).values({
    id,
    mandantId: p.mandantId,
    bezeichnung: p.bezeichnung,
    host: p.host,
    port: p.port,
    tls: p.tls,
    benutzer: p.benutzer,
    passwortChiffre: p.passwortChiffre,
    ordner: p.ordner,
    abrufAb: p.abrufAb,
  })
  await ereignis(tx, {
    mandantId: p.mandantId,
    typ: 'postfach_angelegt',
    entitaet: 'postfach',
    entitaetId: id,
    akteur: p.akteur,
    payload: { bezeichnung: p.bezeichnung, host: p.host, benutzer: p.benutzer, ordner: p.ordner },
  })
  return id
}

/** Ändert Einstellungen; ein neues Passwort nur, wenn angegeben. Nie gelöscht, nur deaktiviert. */
export async function aenderePostfach(
  tx: Tx,
  p: Partial<PostfachEinstellungen> & {
    id: string
    mandantId: string
    aktiv?: boolean
    passwortChiffre?: string
    akteur: Akteur
  },
): Promise<void> {
  const { id, mandantId, akteur, passwortChiffre, ...felder } = p
  const r = await tx
    .update(postfaecher)
    .set({ ...felder, ...(passwortChiffre ? { passwortChiffre } : {}), letzterFehler: null })
    .where(eq(postfaecher.id, id))
    .returning({ id: postfaecher.id })
  if (r.length === 0) throw new Error('Postfach nicht gefunden')
  await ereignis(tx, {
    mandantId,
    typ: 'postfach_geaendert',
    entitaet: 'postfach',
    entitaetId: id,
    akteur,
    payload: { felder: Object.keys(felder), passwortNeu: Boolean(passwortChiffre) },
  })
}

export async function listePostfaecher(tx: Tx): Promise<Postfach[]> {
  return tx.select(postfachSpalten).from(postfaecher).orderBy(postfaecher.angelegtAm)
}

/** Worker: aktive Postfächer aller Mandanten (Policy `postfaecher_worker_lesen`). Ohne Mandantenkontext. */
export async function aktivePostfaecherAllerMandanten(
  db: Db,
): Promise<{ id: string; mandantId: string }[]> {
  return db
    .select({ id: postfaecher.id, mandantId: postfaecher.mandantId })
    .from(postfaecher)
    .where(eq(postfaecher.aktiv, true))
    .orderBy(postfaecher.angelegtAm)
}

/** Worker: vollständiger Datensatz inklusive Chiffre und Abrufstand. */
export async function ladePostfachFuerAbruf(tx: Tx, id: string) {
  const [p] = await tx.select().from(postfaecher).where(eq(postfaecher.id, id))
  return p ?? null
}

export async function setzeAbrufstand(
  tx: Tx,
  id: string,
  stand: { uidValidity?: number; letzteUid?: number; fehler?: string | null },
): Promise<void> {
  await tx
    .update(postfaecher)
    .set({
      ...(stand.uidValidity !== undefined ? { uidValidity: stand.uidValidity } : {}),
      ...(stand.letzteUid !== undefined ? { letzteUid: stand.letzteUid } : {}),
      letzterAbruf: sql`now()`,
      letzterFehler: stand.fehler ?? null,
    })
    .where(eq(postfaecher.id, id))
}

// ---------------------------------------------------------------------------
// Nachrichten
// ---------------------------------------------------------------------------

export type NeueNachricht = {
  mandantId: string
  postfachId: string
  uidValidity: number | null
  imapUid: number | null
  messageId: string | null
  inReplyTo: string | null
  referenzen: string[]
  vonAdresse: string
  vonName: string | null
  an: string[]
  betreff: string
  gesendetAm: string | null
  text: string
  roh: { schluessel: string; sha256: string; groesse: number }
  anhaenge: {
    dateiname: string
    mimeTyp: string
    groesse: number
    sha256: string
    schluessel: string
  }[]
}

/**
 * Legt eine Nachricht mit Anhängen an. Liefert null, wenn dieselbe Rohmail in diesem Postfach
 * schon liegt (erneuter Abruf nach neuer UIDVALIDITY oder Abbruch mitten im Lauf).
 */
export async function legeNachrichtAn(
  tx: Tx,
  n: NeueNachricht,
  akteur: Akteur,
): Promise<string | null> {
  const id = uuidv7()
  const r = await tx
    .insert(nachrichten)
    .values({
      id,
      mandantId: n.mandantId,
      postfachId: n.postfachId,
      uidValidity: n.uidValidity,
      imapUid: n.imapUid,
      messageId: n.messageId,
      inReplyTo: n.inReplyTo,
      referenzen: n.referenzen,
      vonAdresse: n.vonAdresse.toLowerCase(),
      vonName: n.vonName,
      an: n.an,
      betreff: n.betreff,
      gesendetAm: n.gesendetAm,
      text: n.text,
      rohSchluessel: n.roh.schluessel,
      rohSha256: n.roh.sha256,
      rohGroesse: n.roh.groesse,
    })
    .onConflictDoNothing({ target: [nachrichten.postfachId, nachrichten.rohSha256] })
    .returning({ id: nachrichten.id })
  if (r.length === 0) return null
  if (n.anhaenge.length > 0) {
    await tx
      .insert(anhaenge)
      .values(
        n.anhaenge.map((a) => ({ id: uuidv7(), mandantId: n.mandantId, nachrichtId: id, ...a })),
      )
  }
  // Im Ledger nur Metadaten, kein Inhalt: Der Inhalt liegt mit Prüfsumme im Object Storage.
  await ereignis(tx, {
    mandantId: n.mandantId,
    typ: 'nachricht_eingegangen',
    entitaet: 'nachricht',
    entitaetId: id,
    akteur,
    payload: {
      postfachId: n.postfachId,
      rohSha256: n.roh.sha256,
      anhaenge: n.anhaenge.map((a) => a.sha256),
    },
  })
  return id
}

export async function ordneNachrichtZu(
  tx: Tx,
  p: {
    mandantId: string
    nachrichtId: string
    mietverhaeltnisId: string | null
    art: ZuordnungArt
    begruendung?: string | null
    akteur: Akteur
  },
): Promise<void> {
  await tx.insert(nachrichtZuordnungen).values({
    id: uuidv7(),
    mandantId: p.mandantId,
    nachrichtId: p.nachrichtId,
    mietverhaeltnisId: p.mietverhaeltnisId,
    art: p.art,
    begruendung: p.begruendung?.trim() || null,
    akteurArt: p.akteur.art,
    akteurId: p.akteur.id,
  })
  await ereignis(tx, {
    mandantId: p.mandantId,
    typ: 'nachricht_zugeordnet',
    entitaet: 'nachricht',
    entitaetId: p.nachrichtId,
    akteur: p.akteur,
    payload: { mietverhaeltnisId: p.mietverhaeltnisId, art: p.art },
  })
}

/** Zuordnung über den Verlauf: aktuelle Zuordnung der jüngsten Nachricht mit einer der Message-IDs. */
export async function zuordnungImVerlauf(tx: Tx, messageIds: string[]): Promise<string | null> {
  if (messageIds.length === 0) return null
  const rows = await tx.execute<{ mietverhaeltnis_id: string | null }>(sql`
    SELECT z.mietverhaeltnis_id
    FROM nachrichten n
    JOIN nachrichten_zuordnung_aktuell z ON z.nachricht_id = n.id
    WHERE n.message_id IN (${sql.join(
      messageIds.map((m) => sql`${m}`),
      sql`, `,
    )})
    ORDER BY n.empfangen_am DESC
    LIMIT 1`)
  return rows[0]?.mietverhaeltnis_id ?? null
}

export type ZuordnungsKandidat = {
  mietverhaeltnisId: string
  beginn: string
  ende: string | null
  mieterEmails: string[]
  mieterNamen: string[]
  einheit: string
  objekt: string
  strasse: string | null
  hausnummer: string | null
}

/** Alle Mietverhältnisse des Mandanten mit Mieter-Adressen und Bezeichnungen für die Zuordnung. */
export async function ladeZuordnungsKandidaten(tx: Tx): Promise<ZuordnungsKandidat[]> {
  const rows = await tx.execute<{
    mietverhaeltnis_id: string
    beginn: string
    ende: string | null
    mieter_emails: string[] | null
    mieter_namen: string[] | null
    einheit: string
    objekt: string
    strasse: string | null
    hausnummer: string | null
  }>(sql`
    SELECT mv.mietverhaeltnis_id, mv.beginn, mv.ende,
           array_remove(array_agg(DISTINCT lower(p.email)), NULL) AS mieter_emails,
           array_remove(array_agg(DISTINCT concat_ws(' ', p.vorname, p.nachname)), NULL) AS mieter_namen,
           e.bezeichnung AS einheit, o.bezeichnung AS objekt, o.strasse, o.hausnummer
    FROM mietverhaeltnisse_aktuell mv
    JOIN mietverhaeltnisse m ON m.id = mv.mietverhaeltnis_id
    JOIN einheiten_aktuell e ON e.einheit_id = m.einheit_id
    JOIN einheiten ei ON ei.id = m.einheit_id
    JOIN objekte_aktuell o ON o.objekt_id = ei.objekt_id
    LEFT JOIN personen_aktuell p ON p.person_id = ANY (mv.mieter_ids)
    GROUP BY mv.mietverhaeltnis_id, mv.beginn, mv.ende, e.bezeichnung, o.bezeichnung, o.strasse, o.hausnummer
    ORDER BY mv.beginn`)
  return rows.map((r) => ({
    mietverhaeltnisId: r.mietverhaeltnis_id,
    beginn: r.beginn,
    ende: r.ende,
    mieterEmails: r.mieter_emails ?? [],
    mieterNamen: r.mieter_namen ?? [],
    einheit: r.einheit,
    objekt: r.objekt,
    strasse: r.strasse,
    hausnummer: r.hausnummer,
  }))
}

export type PosteingangEintrag = {
  id: string
  postfach: string
  vonAdresse: string
  vonName: string | null
  betreff: string
  gesendetAm: string | null
  empfangenAm: string
  text: string
  anhaenge: { dateiname: string; groesse: number; sha256: string }[]
  zuordnung: {
    mietverhaeltnisId: string | null
    art: ZuordnungArt
    begruendung: string | null
  } | null
}

/** Posteingang des Mandanten, jüngste zuerst. `nurOffen`: ohne aktuelle Zuordnung. */
export async function ladePosteingang(
  tx: Tx,
  optionen: { nurOffen?: boolean; limit?: number } = {},
): Promise<PosteingangEintrag[]> {
  const z = sql`nachrichten_zuordnung_aktuell`
  const rows = await tx.execute<{
    id: string
    postfach: string
    von_adresse: string
    von_name: string | null
    betreff: string
    gesendet_am: string | null
    empfangen_am: string
    text: string
    anhaenge: { dateiname: string; groesse: number; sha256: string }[] | null
    mietverhaeltnis_id: string | null
    art: ZuordnungArt | null
    begruendung: string | null
  }>(sql`
    SELECT n.id, pf.bezeichnung AS postfach, n.von_adresse, n.von_name, n.betreff, n.gesendet_am,
           n.empfangen_am, n.text,
           (SELECT json_agg(json_build_object('dateiname', a.dateiname, 'groesse', a.groesse, 'sha256', a.sha256)
                            ORDER BY a.dateiname)
              FROM anhaenge a WHERE a.nachricht_id = n.id) AS anhaenge,
           za.mietverhaeltnis_id, za.art, za.begruendung
    FROM nachrichten n
    JOIN postfaecher pf ON pf.id = n.postfach_id
    LEFT JOIN ${z} za ON za.nachricht_id = n.id
    ${optionen.nurOffen ? sql`WHERE za.mietverhaeltnis_id IS NULL` : sql``}
    ORDER BY coalesce(n.gesendet_am, n.empfangen_am) DESC, n.id DESC
    LIMIT ${optionen.limit ?? 100}`)
  return rows.map((r) => ({
    id: r.id,
    postfach: r.postfach,
    vonAdresse: r.von_adresse,
    vonName: r.von_name,
    betreff: r.betreff,
    gesendetAm: r.gesendet_am,
    empfangenAm: r.empfangen_am,
    text: r.text,
    anhaenge: r.anhaenge ?? [],
    zuordnung: r.art
      ? { mietverhaeltnisId: r.mietverhaeltnis_id, art: r.art, begruendung: r.begruendung }
      : null,
  }))
}

/** Anzahl der Nachrichten ohne aktuelle Zuordnung, für Navigation und Startseite. */
export async function offeneNachrichten(tx: Tx): Promise<number> {
  const rows = await tx.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM nachrichten n
    LEFT JOIN nachrichten_zuordnung_aktuell za ON za.nachricht_id = n.id
    WHERE za.mietverhaeltnis_id IS NULL`)
  return rows[0]?.n ?? 0
}
