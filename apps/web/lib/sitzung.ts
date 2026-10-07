import 'server-only'
import { withMandant, type Tx } from '@vermieteros/db'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { auth } from './auth'
import { db } from './db'
import { istRolle, statements, type Rolle } from './rechte'

/** 2FA ist Pflicht für Mandanten-Mitglieder, außer ausdrücklich abgeschaltet (lokale Entwicklung). */
export const ZWEI_FAKTOR_PFLICHT = process.env['ZWEI_FAKTOR_PFLICHT'] !== 'aus'

export const sitzung = cache(async () => auth.api.getSession({ headers: await headers() }))

/** Sitzung oder Weiterleitung zum Login. `weiter` ist der Pfad nach dem Login. */
export async function erfordereSitzung(weiter?: string) {
  const s = await sitzung()
  if (!s) redirect(weiter ? `/login?weiter=${encodeURIComponent(weiter)}` : '/login')
  return s
}

/** Sitzung mit eingerichteter 2FA, sonst Weiterleitung zur Einrichtung. */
export async function erfordereGesicherteSitzung(weiter?: string) {
  const s = await erfordereSitzung(weiter)
  if (ZWEI_FAKTOR_PFLICHT && !s.user.twoFactorEnabled) {
    redirect(weiter ? `/sicherheit?weiter=${encodeURIComponent(weiter)}` : '/sicherheit')
  }
  return s
}

export type MandantKontext = {
  mandantId: string
  rolle: Rolle
  nutzerId: string
  nutzerName: string
}

/**
 * Aktiver Mandant aus der Sitzung, Mitgliedschaft geprüft, oder `null`, wenn keiner gewählt ist.
 * Für Stellen, die auch ohne Mandant funktionieren müssen (Navigation, Mandantenauswahl).
 */
export const mandantOderNull = cache(async (): Promise<MandantKontext | null> => {
  const s = await erfordereGesicherteSitzung()
  const mandantId = s.session.activeOrganizationId
  if (!mandantId) return null
  const mitglied = await auth.api.getActiveMember({ headers: await headers() })
  if (!mitglied || mitglied.organizationId !== mandantId) return null
  const rolle = mitglied.role.split(',')[0] ?? ''
  if (!istRolle(rolle)) throw new Error(`unbekannte Rolle: ${mitglied.role}`)
  return { mandantId, rolle, nutzerId: s.user.id, nutzerName: s.user.name }
})

/**
 * Aktiver Mandant aus der Sitzung, Mitgliedschaft geprüft. Ohne aktiven Mandanten
 * geht es zur Mandantenauswahl. Einzige Quelle für `mandantId` in der Web-App.
 */
export const aktiverMandant = cache(async (): Promise<MandantKontext> => {
  const k = await mandantOderNull()
  if (!k) redirect('/mandanten')
  return k
})

/** Führt `fn` im RLS-Kontext des aktiven Mandanten aus. */
export async function mitMandant<T>(fn: (tx: Tx, k: MandantKontext) => Promise<T>): Promise<T> {
  const k = await aktiverMandant()
  return withMandant(db, k.mandantId, (tx) => fn(tx, k))
}

type Rechte = { [K in keyof typeof statements]?: Array<(typeof statements)[K][number]> }

/** Prüft Rechte der aktiven Rolle (Better-Auth-Access-Control). */
export async function darf(rechte: Rechte): Promise<boolean> {
  const r = await auth.api.hasPermission({
    headers: await headers(),
    body: { permissions: rechte as Record<string, string[]> },
  })
  return r.success
}

/** Wie `darf`, wirft aber, wenn das Recht fehlt. Für Server Actions. */
export async function verlange(rechte: Rechte): Promise<void> {
  if (!(await darf(rechte))) throw new Error('Keine Berechtigung')
}

export { sicheresZiel } from './ziel'
