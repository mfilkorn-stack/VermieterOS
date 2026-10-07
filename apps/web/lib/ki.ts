import 'server-only'
import { kiClientAusUmgebung, type KiUmgebung } from '@vermieteros/ki'
import { db } from './db'
import { aktiverMandant } from './sitzung'

/** KI ist eingerichtet, wenn ANTHROPIC_API_KEY gesetzt ist. Ohne Schlüssel läuft alles andere. */
export function kiEingerichtet(): boolean {
  return kiClientAusUmgebung() !== null
}

/** Umgebung für einen KI-Aufruf im Namen der angemeldeten Person; null ohne Schlüssel. */
export async function kiUmgebung(): Promise<KiUmgebung | null> {
  const client = kiClientAusUmgebung()
  if (!client) return null
  const k = await aktiverMandant()
  return { db, mandantId: k.mandantId, akteur: { art: 'nutzer', id: k.nutzerId }, client }
}
