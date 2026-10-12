'use server'

import {
  ladeNachricht,
  ladePortalNachricht,
  legeAntwortAn,
  listePostfaecher,
} from '@vermieteros/db'
import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Eingabefehler, pflicht, text } from '@/lib/eingabe'
import { fehlertext, type FormStatus } from '@/lib/form-status'
import { absenderAdresse, mailEingerichtet, sendeMail } from '@/lib/mail'
import { mitMandant, verlange } from '@/lib/sitzung'

/**
 * Antwort auf eine eingegangene Mail über den zentralen SMTP. Reply-To ist das Postfach, aus dem
 * die Mail kam, damit die Rückantwort wieder im Posteingang landet. Der Vermerk wird vor dem
 * Versand geschrieben und mit der Transaktion verworfen, wenn der Server ablehnt.
 */
export async function antwortSenden(_: FormStatus, d: FormData): Promise<FormStatus> {
  const portalNachrichtId = text(d, 'portalNachrichtId')
  const nachrichtId = portalNachrichtId ? null : pflicht(d, 'nachrichtId', 'Nachricht')
  const zurueck = portalNachrichtId
    ? `/posteingang/portal/${portalNachrichtId}`
    : `/posteingang/${nachrichtId}`
  try {
    await verlange({ post: ['zuordnen'] })
    if (!mailEingerichtet())
      throw new Eingabefehler('Der Mailversand ist nicht eingerichtet (SMTP_HOST).')
    const an = pflicht(d, 'an', 'Empfänger').toLowerCase()
    if (!/^[^\s@]+@[^\s@]+$/.test(an)) throw new Eingabefehler('Empfänger: keine Mailadresse.')
    const betreff = pflicht(d, 'betreff', 'Betreff')
    const text = pflicht(d, 'text', 'Text')
    await mitMandant(async (tx, k) => {
      const messageId = `<${randomUUID()}@${absenderAdresse().split('@')[1] ?? 'vermieteros'}>`
      if (portalNachrichtId) {
        // Nachricht aus dem Mieterportal: Antwort per Mail an die Portal-Adresse, Rückantworten
        // ins Vermietungs-Postfach, damit sie im Posteingang landen.
        const p = await ladePortalNachricht(tx, portalNachrichtId)
        if (!p) throw new Eingabefehler('Nachricht nicht gefunden.')
        const postfach = (await listePostfaecher(tx)).find(
          (x) => x.aktiv && x.zweck === 'post' && x.benutzer.includes('@'),
        )
        await legeAntwortAn(tx, {
          mandantId: k.mandantId,
          nachrichtId: null,
          portalNachrichtId,
          mietverhaeltnisId: p.mietverhaeltnisId,
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
          replyTo: postfach?.benutzer ?? null,
        })
        if (!ok) throw new Eingabefehler('Der Mailserver hat die Antwort abgelehnt.')
        return
      }
      const n = await ladeNachricht(tx, nachrichtId!)
      if (!n) throw new Eingabefehler('Nachricht nicht gefunden.')
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
  revalidatePath(zurueck)
  redirect(zurueck)
}
