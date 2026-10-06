'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { feld, fehlertext, type FormStatus } from '@/lib/form-status'
import { sicheresZiel } from '@/lib/sitzung'

export async function anmelden(_: FormStatus, daten: FormData): Promise<FormStatus> {
  const weiter = sicheresZiel(feld(daten, 'weiter'))
  let zweiFaktor = false
  try {
    const r = await auth.api.signInEmail({
      body: { email: feld(daten, 'email'), password: feld(daten, 'passwort') },
      headers: await headers(),
    })
    zweiFaktor = 'twoFactorRedirect' in r && r.twoFactorRedirect === true
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  if (zweiFaktor) redirect(`/login/zwei-faktor?weiter=${encodeURIComponent(weiter)}`)
  redirect(weiter)
}

export async function zweiFaktorAnmelden(_: FormStatus, daten: FormData): Promise<FormStatus> {
  const weiter = sicheresZiel(feld(daten, 'weiter'))
  try {
    await auth.api.verifyTOTP({ body: { code: feld(daten, 'code') }, headers: await headers() })
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  redirect(weiter)
}

export async function registrieren(_: FormStatus, daten: FormData): Promise<FormStatus> {
  const passwort = feld(daten, 'passwort')
  if (passwort !== feld(daten, 'passwort2')) return { fehler: 'Die Passwörter sind verschieden.' }
  const weiter = sicheresZiel(feld(daten, 'weiter'))
  try {
    await auth.api.signUpEmail({
      body: { name: feld(daten, 'name'), email: feld(daten, 'email'), password: passwort },
      headers: await headers(),
    })
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  redirect(`/sicherheit?weiter=${encodeURIComponent(weiter)}`)
}

export async function abmelden(): Promise<void> {
  await auth.api.signOut({ headers: await headers() })
  redirect('/login')
}
