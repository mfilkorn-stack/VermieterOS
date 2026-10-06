'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import QRCode from 'qrcode'
import { auth } from '@/lib/auth'
import { feld, fehlertext } from '@/lib/form-status'
import { erfordereSitzung, sicheresZiel } from '@/lib/sitzung'
import type { FormStatus } from '@/lib/form-status'

export type EinrichtungStatus = {
  fehler?: string
  qrSvg?: string
  geheimnis?: string
  backupCodes?: string[]
}

/** Schritt 1: Passwort bestätigen, TOTP-Geheimnis erzeugen. Aktiv wird 2FA erst mit Schritt 2. */
export async function zweiFaktorStarten(
  _: EinrichtungStatus,
  daten: FormData,
): Promise<EinrichtungStatus> {
  try {
    const r = await auth.api.enableTwoFactor({
      body: { password: feld(daten, 'passwort'), method: 'totp' },
      headers: await headers(),
    })
    if (r.method !== 'totp') throw new Error('TOTP-Einrichtung fehlgeschlagen')
    const geheimnis = new URL(r.totpURI).searchParams.get('secret') ?? ''
    const qrSvg = await QRCode.toString(r.totpURI, { type: 'svg', margin: 1 })
    return { qrSvg, geheimnis, backupCodes: r.backupCodes }
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
}

/** Schritt 2: ersten Code prüfen, damit ist 2FA aktiv. */
export async function zweiFaktorBestaetigen(
  vorher: EinrichtungStatus,
  daten: FormData,
): Promise<EinrichtungStatus> {
  try {
    await auth.api.verifyTOTP({ body: { code: feld(daten, 'code') }, headers: await headers() })
  } catch (e) {
    return { ...vorher, fehler: fehlertext(e) }
  }
  redirect(sicheresZiel(feld(daten, 'weiter')))
}

export type BestaetigungStatus = FormStatus & { gesendet?: boolean }

/** Erzeugt einen neuen Bestätigungslink. Bis Phase 1 landet er im Server-Log statt im Postfach. */
export async function emailBestaetigungSenden(
  _: BestaetigungStatus,
  daten: FormData,
): Promise<BestaetigungStatus> {
  const s = await erfordereSitzung()
  try {
    await auth.api.sendVerificationEmail({
      body: { email: s.user.email, callbackURL: sicheresZiel(feld(daten, 'weiter')) },
      headers: await headers(),
    })
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  return { gesendet: true }
}
