'use server'

import { ordneNachrichtZu } from '@vermieteros/db'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { pflicht, text } from '@/lib/eingabe'
import { fehlertext, type FormStatus } from '@/lib/form-status'
import { sicheresZiel } from '@/lib/ziel'
import { mitMandant, verlange } from '@/lib/sitzung'

/** Ordnet von Hand zu oder hebt eine Zuordnung auf (leere Auswahl). Jede Änderung bleibt im Verlauf. */
export async function nachrichtZuordnen(_: FormStatus, d: FormData): Promise<FormStatus> {
  try {
    await verlange({ post: ['zuordnen'] })
    const nachrichtId = pflicht(d, 'nachrichtId', 'Nachricht')
    const mietverhaeltnisId = text(d, 'mietverhaeltnisId')
    await mitMandant((tx, k) =>
      ordneNachrichtZu(tx, {
        mandantId: k.mandantId,
        nachrichtId,
        mietverhaeltnisId,
        art: mietverhaeltnisId ? 'manuell' : 'aufgehoben',
        begruendung: text(d, 'begruendung'),
        akteur: { art: 'nutzer', id: k.nutzerId },
      }),
    )
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  // Menü im Layout zeigt Mandant und Zähler; Layouts rendern bei Navigation sonst nicht neu.
  revalidatePath('/', 'layout')
  redirect(sicheresZiel(text(d, 'zurueck'), '/posteingang'))
}
