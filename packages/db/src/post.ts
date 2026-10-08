import type { GespraechRichtung, PostfachZweck, ZuordnungArt } from '@vermieteros/schema'
import { eq, sql } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import type { Db, Tx } from './client'
import {
  anhaenge,
  antworten,
  nachrichten,
  nachrichtZuordnungen,
  postfaecher,
  telefonnotizen,
} from './schema/index'
import type { Akteur } from './schema/index'
import { ereignis } from './ereignis'

/**
 * Mail-Eingang (WP 1.1): Postfächer, Nachrichten, Anhänge, Zuordnungen.
 * Alle Funktionen mit `tx` laufen im Mandantenkontext (`withMandant`), RLS greift.
 */

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
  zweck?: PostfachZweck
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
  zweck: postfaecher.zweck,
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
    zweck: p.zweck ?? 'post',
  })
  await ereignis(tx, {
    mandantId: p.mandantId,
    typ: 'postfach_angelegt',
    entitaet: 'postfach',
    entitaetId: id,
    akteur: p.akteur,
    payload: {
      bezeichnung: p.bezeichnung,
      host: p.host,
      benutzer: p.benutzer,
      ordner: p.ordner,
      zweck: p.zweck ?? 'post',
    },
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
  objektId: string
  einheitId: string
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
    objekt_id: string
    einheit_id: string
    beginn: string
    ende: string | null
    mieter_emails: string[] | null
    mieter_namen: string[] | null
    einheit: string
    objekt: string
    strasse: string | null
    hausnummer: string | null
  }>(sql`
    SELECT mv.mietverhaeltnis_id, ei.objekt_id, m.einheit_id, mv.beginn, mv.ende,
           array_remove(array_agg(DISTINCT lower(p.email)), NULL) AS mieter_emails,
           array_remove(array_agg(DISTINCT concat_ws(' ', p.vorname, p.nachname)), NULL) AS mieter_namen,
           e.bezeichnung AS einheit, o.bezeichnung AS objekt, o.strasse, o.hausnummer
    FROM mietverhaeltnisse_aktuell mv
    JOIN mietverhaeltnisse m ON m.id = mv.mietverhaeltnis_id
    JOIN einheiten_aktuell e ON e.einheit_id = m.einheit_id
    JOIN einheiten ei ON ei.id = m.einheit_id
    JOIN objekte_aktuell o ON o.objekt_id = ei.objekt_id
    LEFT JOIN personen_aktuell p ON p.person_id = ANY (mv.mieter_ids)
    GROUP BY mv.mietverhaeltnis_id, ei.objekt_id, m.einheit_id, mv.beginn, mv.ende, e.bezeichnung,
             o.bezeichnung, o.strasse, o.hausnummer
    ORDER BY mv.beginn`)
  return rows.map((r) => ({
    mietverhaeltnisId: r.mietverhaeltnis_id,
    objektId: r.objekt_id,
    einheitId: r.einheit_id,
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

/** Posteingang des Mandanten (ohne Beleg-Postfächer), jüngste zuerst. `nurOffen`: ohne aktuelle Zuordnung. */
export async function ladePosteingang(
  tx: Tx,
  optionen: { nurOffen?: boolean; suche?: string | null; limit?: number } = {},
): Promise<PosteingangEintrag[]> {
  // Mails an die Beleg-Adresse landen im Belegeingang, nicht im Posteingang (WP 1.8).
  const bedingungen = [sql`pf.zweck = 'post'`]
  if (optionen.nurOffen) bedingungen.push(sql`za.mietverhaeltnis_id IS NULL`)
  const suche = optionen.suche?.trim()
  if (suche) {
    const muster = `%${suche.replace(/[\\%_]/g, (z) => `\\${z}`)}%`
    bedingungen.push(
      sql`(n.betreff ILIKE ${muster} OR n.von_adresse ILIKE ${muster} OR n.von_name ILIKE ${muster} OR n.text ILIKE ${muster})`,
    )
  }
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
    WHERE ${sql.join(bedingungen, sql` AND `)}
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
    JOIN postfaecher pf ON pf.id = n.postfach_id AND pf.zweck = 'post'
    LEFT JOIN nachrichten_zuordnung_aktuell za ON za.nachricht_id = n.id
    WHERE za.mietverhaeltnis_id IS NULL`)
  return rows[0]?.n ?? 0
}

// ---------------------------------------------------------------------------
// Nachricht im Detail, Anhänge, Rohmail (WP 1.2)
// ---------------------------------------------------------------------------

export type NachrichtDetail = {
  id: string
  postfach: string
  /** Mailadresse des Postfachs (Reply-To für Antworten), null wenn der Benutzer keine Adresse ist */
  postfachAdresse: string | null
  messageId: string | null
  referenzen: string[]
  vonAdresse: string
  vonName: string | null
  an: string[]
  betreff: string
  gesendetAm: string | null
  empfangenAm: string
  text: string
  rohGroesse: number
  rohSha256: string
  anhaenge: { id: string; dateiname: string; mimeTyp: string; groesse: number; sha256: string }[]
  /** Alle Zuordnungen, älteste zuerst; die letzte gilt. */
  zuordnungen: {
    mietverhaeltnisId: string | null
    art: ZuordnungArt
    begruendung: string | null
    akteurArt: string
    akteurId: string
    erfasstAm: string
  }[]
}

export async function ladeNachricht(tx: Tx, id: string): Promise<NachrichtDetail | null> {
  const [n] = await tx.execute<{
    id: string
    postfach: string
    benutzer: string
    message_id: string | null
    referenzen: string[]
    von_adresse: string
    von_name: string | null
    an: string[]
    betreff: string
    gesendet_am: string | null
    empfangen_am: string
    text: string
    roh_groesse: number
    roh_sha256: string
  }>(sql`
    SELECT n.id, pf.bezeichnung AS postfach, pf.benutzer, n.message_id, n.referenzen,
           n.von_adresse, n.von_name, n.an, n.betreff,
           n.gesendet_am, n.empfangen_am, n.text, n.roh_groesse, n.roh_sha256
    FROM nachrichten n JOIN postfaecher pf ON pf.id = n.postfach_id
    WHERE n.id = ${id}`)
  if (!n) return null
  const anhaengeZeilen = await tx
    .select({
      id: anhaenge.id,
      dateiname: anhaenge.dateiname,
      mimeTyp: anhaenge.mimeTyp,
      groesse: anhaenge.groesse,
      sha256: anhaenge.sha256,
    })
    .from(anhaenge)
    .where(eq(anhaenge.nachrichtId, id))
    .orderBy(anhaenge.dateiname)
  const zuordnungen = await tx
    .select({
      mietverhaeltnisId: nachrichtZuordnungen.mietverhaeltnisId,
      art: nachrichtZuordnungen.art,
      begruendung: nachrichtZuordnungen.begruendung,
      akteurArt: nachrichtZuordnungen.akteurArt,
      akteurId: nachrichtZuordnungen.akteurId,
      erfasstAm: nachrichtZuordnungen.erfasstAm,
    })
    .from(nachrichtZuordnungen)
    .where(eq(nachrichtZuordnungen.nachrichtId, id))
    .orderBy(nachrichtZuordnungen.erfasstAm, nachrichtZuordnungen.id)
  return {
    id: n.id,
    postfach: n.postfach,
    postfachAdresse: n.benutzer.includes('@') ? n.benutzer : null,
    messageId: n.message_id,
    referenzen: n.referenzen,
    vonAdresse: n.von_adresse,
    vonName: n.von_name,
    an: n.an,
    betreff: n.betreff,
    gesendetAm: n.gesendet_am,
    empfangenAm: n.empfangen_am,
    text: n.text,
    rohGroesse: n.roh_groesse,
    rohSha256: n.roh_sha256,
    anhaenge: anhaengeZeilen,
    zuordnungen,
  }
}

/** Für den Download: Schlüssel im Object Storage und Metadaten. RLS stellt den Mandanten sicher. */
export async function ladeAnhangZumHerunterladen(tx: Tx, id: string) {
  const [a] = await tx
    .select({
      schluessel: anhaenge.schluessel,
      dateiname: anhaenge.dateiname,
      mimeTyp: anhaenge.mimeTyp,
      sha256: anhaenge.sha256,
    })
    .from(anhaenge)
    .where(eq(anhaenge.id, id))
  return a ?? null
}

export async function ladeRohmailZumHerunterladen(tx: Tx, nachrichtId: string) {
  const [n] = await tx
    .select({
      schluessel: nachrichten.rohSchluessel,
      sha256: nachrichten.rohSha256,
      betreff: nachrichten.betreff,
    })
    .from(nachrichten)
    .where(eq(nachrichten.id, nachrichtId))
  return n ?? null
}

// ---------------------------------------------------------------------------
// Telefonnotizen und Verlauf pro Mietverhältnis (WP 1.2)
// ---------------------------------------------------------------------------

export type NeueTelefonnotiz = {
  mandantId: string
  mietverhaeltnisId: string
  zeitpunkt: string
  richtung: GespraechRichtung
  gespraechspartner: string
  betreff: string
  inhalt: string
  /** Korrektur einer früheren Notiz */
  ersetztId?: string | null
  akteur: Akteur
}

export async function legeTelefonnotizAn(tx: Tx, n: NeueTelefonnotiz): Promise<string> {
  const id = uuidv7()
  await tx.insert(telefonnotizen).values({
    id,
    mandantId: n.mandantId,
    mietverhaeltnisId: n.mietverhaeltnisId,
    zeitpunkt: n.zeitpunkt,
    richtung: n.richtung,
    gespraechspartner: n.gespraechspartner.trim(),
    betreff: n.betreff.trim(),
    inhalt: n.inhalt.trim(),
    ersetztId: n.ersetztId ?? null,
    akteurArt: n.akteur.art,
    akteurId: n.akteur.id,
  })
  // Im Ledger nur Metadaten; der Inhalt steht in der append-only Tabelle.
  await ereignis(tx, {
    mandantId: n.mandantId,
    typ: 'telefonnotiz_erfasst',
    entitaet: 'telefonnotiz',
    entitaetId: id,
    akteur: n.akteur,
    payload: { mietverhaeltnisId: n.mietverhaeltnisId, ersetztId: n.ersetztId ?? null },
  })
  return id
}

export type NeueAntwort = {
  mandantId: string
  nachrichtId: string
  mietverhaeltnisId: string | null
  an: string[]
  betreff: string
  text: string
  messageId: string
  akteur: Akteur
}

/** Vermerkt eine aus der App verschickte Antwort; der Versand selbst läuft in der Web-App. */
export async function legeAntwortAn(tx: Tx, a: NeueAntwort): Promise<string> {
  const id = uuidv7()
  await tx.insert(antworten).values({
    id,
    mandantId: a.mandantId,
    nachrichtId: a.nachrichtId,
    mietverhaeltnisId: a.mietverhaeltnisId,
    an: a.an,
    betreff: a.betreff.trim(),
    text: a.text.trim(),
    messageId: a.messageId,
    akteurArt: a.akteur.art,
    akteurId: a.akteur.id,
  })
  await ereignis(tx, {
    mandantId: a.mandantId,
    typ: 'antwort_gesendet',
    entitaet: 'antwort',
    entitaetId: id,
    akteur: a.akteur,
    payload: { nachrichtId: a.nachrichtId, mietverhaeltnisId: a.mietverhaeltnisId, an: a.an },
  })
  return id
}

export type Antwort = {
  id: string
  an: string[]
  betreff: string
  text: string
  gesendetAm: string
}

export async function antwortenZuNachricht(tx: Tx, nachrichtId: string): Promise<Antwort[]> {
  return tx
    .select({
      id: antworten.id,
      an: antworten.an,
      betreff: antworten.betreff,
      text: antworten.text,
      gesendetAm: antworten.gesendetAm,
    })
    .from(antworten)
    .where(eq(antworten.nachrichtId, nachrichtId))
    .orderBy(antworten.gesendetAm)
}

export type VerlaufEintrag =
  | {
      art: 'nachricht'
      id: string
      zeitpunkt: string
      betreff: string
      von: string
      auszug: string
      anhaenge: number
      zuordnung: ZuordnungArt
    }
  | {
      art: 'telefonnotiz'
      id: string
      zeitpunkt: string
      betreff: string
      gespraechspartner: string
      richtung: GespraechRichtung
      inhalt: string
      korrigiert: boolean
    }
  | {
      art: 'portal'
      id: string
      zeitpunkt: string
      betreff: string
      von: string
      text: string
    }
  | {
      art: 'antwort'
      id: string
      /** Nachricht, auf die geantwortet wurde */
      nachrichtId: string
      zeitpunkt: string
      betreff: string
      an: string[]
      text: string
    }

/**
 * Mails (aktuell zugeordnet), aus der App verschickte Antworten, Telefonnotizen (aktuelle
 * Fassung) und Nachrichten aus dem Mieterportal eines Mietverhältnisses, jüngste zuerst.
 */
export async function ladeVerlauf(tx: Tx, mietverhaeltnisId: string): Promise<VerlaufEintrag[]> {
  const rows = await tx.execute<{
    art: 'nachricht' | 'telefonnotiz' | 'portal' | 'antwort'
    id: string
    nachricht_id: string | null
    zeitpunkt: string
    betreff: string
    wer: string
    text: string
    anhaenge: number
    zuordnung: ZuordnungArt | null
    richtung: GespraechRichtung | null
    korrigiert: boolean
  }>(sql`
    SELECT 'nachricht' AS art, n.id, NULL::uuid AS nachricht_id,
           coalesce(n.gesendet_am, n.empfangen_am) AS zeitpunkt, n.betreff,
           coalesce(n.von_name, n.von_adresse) AS wer, left(n.text, 400) AS text,
           (SELECT count(*)::int FROM anhaenge a WHERE a.nachricht_id = n.id) AS anhaenge,
           za.art AS zuordnung, NULL AS richtung, false AS korrigiert
    FROM nachrichten n
    JOIN nachrichten_zuordnung_aktuell za ON za.nachricht_id = n.id
    WHERE za.mietverhaeltnis_id = ${mietverhaeltnisId}
    UNION ALL
    SELECT 'telefonnotiz', t.id, NULL, t.zeitpunkt, t.betreff, t.gespraechspartner, t.inhalt, 0, NULL, t.richtung,
           t.ersetzt_id IS NOT NULL
    FROM telefonnotizen_aktuell t
    WHERE t.mietverhaeltnis_id = ${mietverhaeltnisId}
    UNION ALL
    SELECT 'portal', p.id, NULL, p.erstellt_am, p.betreff, z.email, p.text, 0, NULL, NULL, false
    FROM portal_nachrichten p JOIN portal_zugaenge z ON z.id = p.zugang_id
    WHERE p.mietverhaeltnis_id = ${mietverhaeltnisId}
    UNION ALL
    SELECT 'antwort', w.id, w.nachricht_id, w.gesendet_am, w.betreff, array_to_string(w.an, ', '),
           w.text, 0, NULL, NULL, false
    FROM antworten w
    WHERE w.mietverhaeltnis_id = ${mietverhaeltnisId}
    ORDER BY zeitpunkt DESC, id DESC`)
  return rows.map((r): VerlaufEintrag =>
    r.art === 'antwort'
      ? {
          art: 'antwort' as const,
          id: r.id,
          nachrichtId: r.nachricht_id!,
          zeitpunkt: r.zeitpunkt,
          betreff: r.betreff,
          an: r.wer.split(', '),
          text: r.text,
        }
      : r.art === 'portal'
        ? {
            art: 'portal' as const,
            id: r.id,
            zeitpunkt: r.zeitpunkt,
            betreff: r.betreff,
            von: r.wer,
            text: r.text,
          }
        : r.art === 'nachricht'
          ? {
              art: 'nachricht' as const,
              id: r.id,
              zeitpunkt: r.zeitpunkt,
              betreff: r.betreff,
              von: r.wer,
              auszug: r.text,
              anhaenge: r.anhaenge,
              zuordnung: r.zuordnung!,
            }
          : {
              art: 'telefonnotiz' as const,
              id: r.id,
              zeitpunkt: r.zeitpunkt,
              betreff: r.betreff,
              gespraechspartner: r.wer,
              richtung: r.richtung!,
              inhalt: r.text,
              korrigiert: r.korrigiert,
            },
  )
}
