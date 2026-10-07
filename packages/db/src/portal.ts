import { createHash, randomBytes } from 'node:crypto'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import type { Db, Tx } from './client'
import { ereignis } from './ereignis'
import { portalNachrichten, portalZugaenge, type Akteur } from './schema/index'

/**
 * Mieterportal (WP 1.10, ADR 0010). Zwei Seiten:
 * - Vermieter (mit Mandantenkontext, RLS): Zugänge anlegen, widerrufen, Nachrichten lesen.
 * - Anmeldung (ohne Mandant): Einmal-Links und Sitzungen nur über die SECURITY-DEFINER-
 *   Funktionen der Migration 0024; in der Datenbank liegen nur SHA-256-Hashes.
 */

const hash = (t: string) => createHash('sha256').update(t).digest('hex')
const neuesGeheimnis = () => randomBytes(32).toString('base64url')

export type PortalZugang = {
  id: string
  mietverhaeltnisId: string
  personId: string
  email: string
  erstelltAm: string
  widerrufenAm: string | null
}

export async function legePortalZugangAn(
  tx: Tx,
  p: {
    mandantId: string
    mietverhaeltnisId: string
    personId: string
    email: string
    akteur: Akteur
  },
): Promise<string> {
  const id = uuidv7()
  const email = p.email.trim().toLowerCase()
  await tx.insert(portalZugaenge).values({
    id,
    mandantId: p.mandantId,
    mietverhaeltnisId: p.mietverhaeltnisId,
    personId: p.personId,
    email,
    erstelltVon: p.akteur.id,
  })
  await ereignis(tx, {
    mandantId: p.mandantId,
    typ: 'portal_zugang_angelegt',
    entitaet: 'portal_zugang',
    entitaetId: id,
    akteur: p.akteur,
    payload: { mietverhaeltnisId: p.mietverhaeltnisId, personId: p.personId, email },
  })
  return id
}

export async function widerrufePortalZugang(
  tx: Tx,
  p: { mandantId: string; id: string; akteur: Akteur },
): Promise<void> {
  const r = await tx
    .update(portalZugaenge)
    .set({ widerrufenAm: sql`now()`, widerrufenVon: p.akteur.id })
    .where(and(eq(portalZugaenge.id, p.id), isNull(portalZugaenge.widerrufenAm)))
    .returning({ id: portalZugaenge.id })
  if (r.length === 0) throw new Error('Zugang nicht gefunden oder schon widerrufen')
  await ereignis(tx, {
    mandantId: p.mandantId,
    typ: 'portal_zugang_widerrufen',
    entitaet: 'portal_zugang',
    entitaetId: p.id,
    akteur: p.akteur,
    payload: {},
  })
}

export async function portalZugaengeZuMv(
  tx: Tx,
  mietverhaeltnisId: string,
): Promise<PortalZugang[]> {
  return tx
    .select({
      id: portalZugaenge.id,
      mietverhaeltnisId: portalZugaenge.mietverhaeltnisId,
      personId: portalZugaenge.personId,
      email: portalZugaenge.email,
      erstelltAm: portalZugaenge.erstelltAm,
      widerrufenAm: portalZugaenge.widerrufenAm,
    })
    .from(portalZugaenge)
    .where(eq(portalZugaenge.mietverhaeltnisId, mietverhaeltnisId))
    .orderBy(portalZugaenge.erstelltAm)
}

/**
 * Einmal-Links für eine Adresse: je aktivem Zugang ein Token (z. B. zwei Wohnungen). Leer, wenn
 * die Adresse unbekannt ist oder zu oft angefragt wurde; die Oberfläche sagt in beiden Fällen
 * dasselbe, damit sich keine Adressen abfragen lassen.
 */
export async function portalLinksAnfordern(
  db: Db,
  email: string,
  gueltigMinuten: number,
): Promise<{ zugangId: string; mandantId: string; token: string }[]> {
  const zugaenge = await db.execute<{ zugang_id: string; mandant_id: string }>(
    sql`SELECT * FROM portal_zugaenge_zur_adresse(${email})`,
  )
  const out = []
  for (const z of zugaenge) {
    const token = neuesGeheimnis()
    const [r] = await db.execute<{ ok: boolean }>(
      sql`SELECT portal_token_anlegen(${z.zugang_id}::uuid, ${hash(token)}, ${gueltigMinuten}) AS ok`,
    )
    if (r?.ok) out.push({ zugangId: z.zugang_id, mandantId: z.mandant_id, token })
  }
  return out
}

/**
 * Einladungslink für genau einen Zugang (Vermieter lädt ein). Nur im Mandantenkontext: die
 * Datenbank lehnt Zugänge anderer Mandanten ab. null bei widerrufen, fremd oder zu oft.
 */
export async function portalLinkFuerZugang(
  tx: Tx,
  zugangId: string,
  gueltigMinuten: number,
): Promise<string | null> {
  const token = neuesGeheimnis()
  const [r] = await tx.execute<{ ok: boolean }>(
    sql`SELECT portal_token_anlegen(${zugangId}::uuid, ${hash(token)}, ${gueltigMinuten}) AS ok`,
  )
  return r?.ok ? token : null
}

/** Löst einen Link ein; liefert das Sitzungsgeheimnis für das Cookie oder null. */
export async function portalAnmelden(
  db: Db,
  token: string,
  sitzungTage: number,
): Promise<{ sitzung: string; zugangId: string; mandantId: string } | null> {
  const sitzung = neuesGeheimnis()
  const [r] = await db.execute<{ zugang_id: string; mandant_id: string }>(
    sql`SELECT * FROM portal_token_einloesen(${hash(token)}, ${hash(sitzung)}, ${sitzungTage})`,
  )
  return r ? { sitzung, zugangId: r.zugang_id, mandantId: r.mandant_id } : null
}

export type PortalSitzung = {
  zugangId: string
  mandantId: string
  mietverhaeltnisId: string
  personId: string
  email: string
}

export async function portalSitzung(db: Db, sitzung: string): Promise<PortalSitzung | null> {
  const [r] = await db.execute<{
    zugang_id: string
    mandant_id: string
    mietverhaeltnis_id: string
    person_id: string
    email: string
  }>(sql`SELECT * FROM portal_sitzung_lesen(${hash(sitzung)})`)
  return r
    ? {
        zugangId: r.zugang_id,
        mandantId: r.mandant_id,
        mietverhaeltnisId: r.mietverhaeltnis_id,
        personId: r.person_id,
        email: r.email,
      }
    : null
}

export async function portalAbmelden(db: Db, sitzung: string): Promise<void> {
  await db.execute(sql`SELECT portal_abmelden(${hash(sitzung)})`)
}

export async function legePortalNachrichtAn(
  tx: Tx,
  p: { s: PortalSitzung; betreff: string; text: string },
): Promise<string> {
  const id = uuidv7()
  await tx.insert(portalNachrichten).values({
    id,
    mandantId: p.s.mandantId,
    mietverhaeltnisId: p.s.mietverhaeltnisId,
    zugangId: p.s.zugangId,
    betreff: p.betreff,
    text: p.text,
  })
  await ereignis(tx, {
    mandantId: p.s.mandantId,
    typ: 'portal_nachricht',
    entitaet: 'portal_nachricht',
    entitaetId: id,
    akteur: { art: 'portal', id: p.s.zugangId },
    payload: { mietverhaeltnisId: p.s.mietverhaeltnisId },
  })
  return id
}

export type PortalNachricht = {
  id: string
  betreff: string
  text: string
  erstelltAm: string
  email: string
}

export async function portalNachrichtenZuMv(
  tx: Tx,
  mietverhaeltnisId: string,
): Promise<PortalNachricht[]> {
  return tx.execute<PortalNachricht>(sql`
    SELECT n.id, n.betreff, n.text, n.erstellt_am AS "erstelltAm", z.email
    FROM portal_nachrichten n JOIN portal_zugaenge z ON z.id = n.zugang_id
    WHERE n.mietverhaeltnis_id = ${mietverhaeltnisId}
    ORDER BY n.erstellt_am DESC`)
}
