'use server'

import { ladeNachricht, legeAntwortAn } from '@vermieteros/db'
import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Eingabefehler, pflicht } from '@/lib/eingabe'
import { fehlertext, type FormStatus } from '@/lib/form-status'
import { absenderAdresse, mailEingerichtet, sendeMail } from '@/lib/mail'
import { mitMandant, verlange } from '@/lib/sitzung'

/**
 * Antwort auf eine eingegangene Mail über den zentralen SMTP. Reply-To ist das Postfach, aus dem
 * die Mail kam, damit die Rückantwort wieder im Posteingang landet. Der Vermerk wird vor dem
 * Versand geschrieben und mit der Transaktion verworfen, wenn der Server ablehnt.
 */
export async function antwortSenden(_: FormStatus, d: FormData): Promise<FormStatus> {
  const nachrichtId = pflicht(d, 'nachrichtId', 'Nachricht')
  try {
    await verlange({ post: ['zuordnen'] })
    if (!mailEingerichtet())
      throw new Eingabefehler('Der Mailversand ist nicht eingerichtet (SMTP_HOST).')
    const an = pflicht(d, 'an', 'Empfänger').toLowerCase()
    if (!/^[^\s@]+@[^\s@]+$/.test(an)) throw new Eingabefehler('Empfänger: keine Mailadresse.')
    const betreff = pflicht(d, 'betreff', 'Betreff')
    const text = pflicht(d, 'text', 'Text')
    await mitMandant(async (tx, k) => {
      const n = await ladeNachricht(tx, nachrichtId)
      if (!n) throw new Eingabefehler('Nachricht nicht gefunden.')
      const messageId = `<${randomUUID()}@${absenderAdresse().split('@')[1] ?? 'vermieteros'}>`
      await legeAntwortAn(tx, {
        mandantId: k.mandantId,
        nachrichtId,
        mietverhaeltnisId: n.zuordnungen.at(-1)?.mietverhaeltnisId ?? null,
        an: [an],
        betreff,
        text,
        messageId,
        akteur: { art: 'nutzer', id: k.nutzerId },
      })
      const ok = await sendeMail({
        art: 'antwort',
        an,
        betreff,
        text,
        messageId,
        inReplyTo: n.messageId,
        referenzen: n.messageId ? [...n.referenzen, n.messageId] : n.referenzen,
        replyTo: n.postfachAdresse,
      })
      if (!ok) throw new Eingabefehler('Der Mailserver hat die Antwort abgelehnt.')
    })
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  revalidatePath(`/posteingang/${nachrichtId}`)
  redirect(`/posteingang/${nachrichtId}`)
}
