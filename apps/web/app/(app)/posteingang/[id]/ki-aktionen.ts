'use server'

import {
  ANTWORTVORSCHLAG,
  bestaetigeVorschlag,
  EntwurfAbgelehnt,
  erzeugeVorschlag,
  fuerNachricht,
  KiFehler,
  SORTIERUNG,
  verwirfVorschlag,
} from '@vermieteros/ki'
import { revalidatePath } from 'next/cache'
import { pflicht } from '@/lib/eingabe'
import { fehlertext, type FormStatus } from '@/lib/form-status'
import { kiUmgebung } from '@/lib/ki'
import { verlange } from '@/lib/sitzung'

const KEINE_KI = 'Die KI ist nicht eingerichtet (ANTHROPIC_API_KEY).'

function kiFehlertext(e: unknown): string {
  if (e instanceof EntwurfAbgelehnt) {
    return 'Der Entwurf hielt die Regeln nicht ein (Zahlen oder unbekannte Platzhalter) und wurde verworfen. Bitte neu erstellen.'
  }
  if (e instanceof KiFehler) {
    return {
      nicht_konfiguriert: 'Die KI ist nicht eingerichtet.',
      verweigert: 'Die KI hat die Anfrage abgelehnt.',
      abgeschnitten: 'Die Antwort der KI war unvollständig. Bitte erneut versuchen.',
      ungueltig: 'Die Antwort der KI war unbrauchbar. Bitte erneut versuchen.',
      abgelehnt: `Die Antwort der KI wurde abgelehnt: ${e.message}`,
    }[e.art]
  }
  return fehlertext(e)
}

/** Einschätzung oder Antwortentwurf zu einer Mail erzeugen (Aufgabe aus dem Formular). */
export async function kiErzeugen(_: FormStatus, d: FormData): Promise<FormStatus> {
  try {
    const nachrichtId = pflicht(d, 'nachrichtId', 'Nachricht')
    const name = pflicht(d, 'aufgabe', 'Aufgabe')
    if (name !== 'sortierung' && name !== 'antwortvorschlag') throw new Error('Unbekannte Aufgabe')
    await verlange({ post: ['zuordnen'] })
    const u = await kiUmgebung()
    if (!u) return { fehler: KEINE_KI }
    const kontext = (tx: Parameters<typeof fuerNachricht>[0]) => fuerNachricht(tx, nachrichtId)
    if (name === 'sortierung') await erzeugeVorschlag(u, SORTIERUNG, kontext)
    else await erzeugeVorschlag(u, ANTWORTVORSCHLAG, kontext)
    revalidatePath(`/posteingang/${nachrichtId}`)
    return {}
  } catch (e) {
    return { fehler: kiFehlertext(e) }
  }
}

/** Übernehmen prüft den Stempel: Hat sich die Grundlage geändert, gilt der Vorschlag als veraltet. */
export async function kiUebernehmen(_: FormStatus, d: FormData): Promise<FormStatus> {
  try {
    const nachrichtId = pflicht(d, 'nachrichtId', 'Nachricht')
    await verlange({ post: ['zuordnen'] })
    const u = await kiUmgebung()
    if (!u) return { fehler: KEINE_KI }
    const p = await bestaetigeVorschlag(u, pflicht(d, 'vorschlagId', 'Vorschlag'))
    revalidatePath(`/posteingang/${nachrichtId}`)
    if (p.status === 'veraltet') {
      return { fehler: 'Seit dem Vorschlag haben sich Daten geändert. Bitte neu erstellen.' }
    }
    if (p.status !== 'bestaetigt') return { fehler: 'Über diesen Vorschlag ist schon entschieden.' }
    return {}
  } catch (e) {
    return { fehler: kiFehlertext(e) }
  }
}

export async function kiVerwerfen(_: FormStatus, d: FormData): Promise<FormStatus> {
  try {
    const nachrichtId = pflicht(d, 'nachrichtId', 'Nachricht')
    await verlange({ post: ['zuordnen'] })
    const u = await kiUmgebung()
    if (!u) return { fehler: KEINE_KI }
    await verwirfVorschlag(u, pflicht(d, 'vorschlagId', 'Vorschlag'), 'von Hand verworfen')
    revalidatePath(`/posteingang/${nachrichtId}`)
    return {}
  } catch (e) {
    return { fehler: kiFehlertext(e) }
  }
}
