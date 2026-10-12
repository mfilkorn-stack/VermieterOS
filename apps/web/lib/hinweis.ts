import 'server-only'
import { cookies } from 'next/headers'

export const HINWEIS_COOKIE = 'vos-hinweis'

/**
 * Kurze Bestätigung nach einer Aktion mit Redirect („Gespeichert.“). Liegt für wenige Sekunden
 * in einem Cookie; das Layout zeigt sie einmal an und der Browser löscht sie wieder.
 */
export async function setzeHinweis(text: string): Promise<void> {
  ;(await cookies()).set(HINWEIS_COOKIE, text, { maxAge: 15, path: '/', sameSite: 'lax' })
}

export async function liesHinweis(): Promise<string | null> {
  return (await cookies()).get(HINWEIS_COOKIE)?.value ?? null
}
