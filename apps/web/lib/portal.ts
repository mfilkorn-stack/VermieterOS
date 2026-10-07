import 'server-only'
import { portalSitzung, schema, withMandant, type PortalSitzung, type Tx } from '@vermieteros/db'
import { and, eq, inArray } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { db } from './db'
import { sendeMail } from './mail'

/**
 * Mieterportal (WP 1.10, ADR 0010): eigene Sitzung im Cookie `vos_portal`, getrennt von der
 * Better-Auth-Sitzung des Vermieters. Alle Portal-Abfragen laufen im Mandanten des Zugangs
 * und filtern zusätzlich auf dessen Mietverhältnis; das prüfen die Portal-Funktionen selbst.
 */
const COOKIE = 'vos_portal'
export const SITZUNG_TAGE = 30
export const LINK_MINUTEN = 15
export const EINLADUNG_MINUTEN = 7 * 24 * 60

export const BASIS_URL = process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3000'

/** Diese Dokumente am eigenen Mietverhältnis sehen Mieter (Vertrag vollständig). */
export const PORTAL_DOKUMENTTYPEN = new Set([
  'mietvertrag',
  'nachtrag',
  'uebergabeprotokoll',
  'bescheinigung',
  'wohnungsgeberbestaetigung',
  'hausordnung',
  'energieausweis',
  'betriebskostenabrechnung',
])

export async function portalKontext(): Promise<PortalSitzung | null> {
  const wert = (await cookies()).get(COOKIE)?.value
  return wert ? portalSitzung(db, wert) : null
}

export async function verlangePortal(): Promise<PortalSitzung> {
  const s = await portalKontext()
  if (!s) redirect('/portal/login')
  return s
}

export async function mitPortal<T>(fn: (tx: Tx, s: PortalSitzung) => Promise<T>): Promise<T> {
  const s = await verlangePortal()
  return withMandant(db, s.mandantId, (tx) => fn(tx, s))
}

export async function setzePortalCookie(sitzung: string): Promise<void> {
  ;(await cookies()).set(COOKIE, sitzung, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/portal',
    maxAge: SITZUNG_TAGE * 24 * 60 * 60,
  })
}

export async function portalCookie(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE)?.value
}

export async function loeschePortalCookie(): Promise<void> {
  ;(await cookies()).delete({ name: COOKIE, path: '/portal' })
}

export function portalLink(token: string): string {
  return `${BASIS_URL}/portal/anmelden?token=${encodeURIComponent(token)}`
}

/**
 * Hinweis an alle, die beim Mandanten Post bearbeiten (Eigentümer, Miteigentümer,
 * Mitverwalter). Ohne Mailversand bleibt es beim Eintrag in der App.
 */
export async function benachrichtigeVermieter(
  mandantId: string,
  betreff: string,
  text: string,
): Promise<void> {
  const { member, user } = schema.auth
  const empfaenger = await db
    .select({ email: user.email })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(
      and(
        eq(member.organizationId, mandantId),
        inArray(member.role, ['eigentuemer', 'miteigentuemer', 'mitverwalter']),
      ),
    )
  for (const e of empfaenger) {
    await sendeMail({ art: 'portal-hinweis', an: e.email, betreff, text })
  }
}
