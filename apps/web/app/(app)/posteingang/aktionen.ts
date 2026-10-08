'use server'

import { ordneNachrichtZu } from '@vermieteros/db'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Eingabefehler, pflicht, text } from '@/lib/eingabe'
import { fehlertext, type FormStatus } from '@/lib/form-status'
import { setzeHinweis } from '@/lib/hinweis'
import { sicheresZiel } from '@/lib/ziel'
import { mitMandant, verlange } from '@/lib/sitzung'

/**
 * Ordnet von Hand zu (Mietverhältnis, Objekt oder Handwerker), schließt als erledigt ab oder hebt
 * eine Zuordnung auf (leere Auswahl). Jede Änderung bleibt im Verlauf.
 */
export async function nachrichtZuordnen(_: FormStatus, d: FormData): Promise<FormStatus> {
  try {
    await verlange({ post: ['zuordnen'] })
    const nachrichtId = pflicht(d, 'nachrichtId', 'Nachricht')
    const ziel = text(d, 'ziel') ?? ''
    const [art, id] = ziel.includes(':') ? ziel.split(':', 2) : [ziel, null]
    if (
      !['', 'erledigt', 'mv', 'objekt', 'handwerker'].includes(art!) ||
      (art !== '' && art !== 'erledigt' && !id)
    )
      throw new Eingabefehler('Bitte ein Ziel wählen.')
    await mitMandant((tx, k) =>
      ordneNachrichtZu(tx, {
        mandantId: k.mandantId,
        nachrichtId,
        mietverhaeltnisId: art === 'mv' ? id : null,
        objektId: art === 'objekt' ? id : null,
        handwerkerId: art === 'handwerker' ? id : null,
        art: art === '' ? 'aufgehoben' : art === 'erledigt' ? 'erledigt' : 'manuell',
        begruendung: text(d, 'begruendung'),
        akteur: { art: 'nutzer', id: k.nutzerId },
      }),
    )
    await setzeHinweis(
      art === '' ? 'Zuordnung aufgehoben.' : art === 'erledigt' ? 'Erledigt.' : 'Zugeordnet.',
    )
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  // Menü im Layout zeigt Mandant und Zähler; Layouts rendern bei Navigation sonst nicht neu.
  revalidatePath('/', 'layout')
  redirect(sicheresZiel(text(d, 'zurueck'), '/posteingang'))
}
