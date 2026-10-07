'use server'

import {
  legePortalZugangAn,
  legeTelefonnotizAn,
  letzteVersion,
  portalLinkFuerZugang,
  portalZugaengeZuMv,
  widerrufePortalZugang,
} from '@vermieteros/db'
import { GESPRAECH_RICHTUNGEN, type GespraechRichtung } from '@vermieteros/schema'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Eingabefehler, pflicht, text } from '@/lib/eingabe'
import { fehlertext, type FormStatus } from '@/lib/form-status'
import { sendeMail } from '@/lib/mail'
import { EINLADUNG_MINUTEN, portalLink } from '@/lib/portal'
import { mitMandant, verlange } from '@/lib/sitzung'
import { berlinZuIso } from '@/lib/zeit'

/** Neue Telefonnotiz oder Korrektur einer bestehenden (ersetztId). */
export async function telefonnotizSpeichern(_: FormStatus, d: FormData): Promise<FormStatus> {
  const mietverhaeltnisId = pflicht(d, 'mietverhaeltnisId', 'Mietverhältnis')
  try {
    await verlange({ post: ['notieren'] })
    const richtung = pflicht(d, 'richtung', 'Richtung')
    if (!(GESPRAECH_RICHTUNGEN as readonly string[]).includes(richtung))
      throw new Eingabefehler('Richtung: eingehend oder ausgehend.')
    let zeitpunkt: string
    try {
      zeitpunkt = berlinZuIso(pflicht(d, 'zeitpunkt', 'Zeitpunkt'))
    } catch {
      throw new Eingabefehler('Zeitpunkt: Datum und Uhrzeit angeben.')
    }
    if (new Date(zeitpunkt).getTime() > Date.now() + 5 * 60_000)
      throw new Eingabefehler('Zeitpunkt liegt in der Zukunft.')
    await mitMandant((tx, k) =>
      legeTelefonnotizAn(tx, {
        mandantId: k.mandantId,
        mietverhaeltnisId,
        zeitpunkt,
        richtung: richtung as GespraechRichtung,
        gespraechspartner: pflicht(d, 'gespraechspartner', 'Gesprächspartner'),
        betreff: pflicht(d, 'betreff', 'Betreff'),
        inhalt: pflicht(d, 'inhalt', 'Inhalt'),
        ersetztId: text(d, 'ersetztId'),
        akteur: { art: 'nutzer', id: k.nutzerId },
      }),
    )
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  redirect(`/mietverhaeltnisse/${mietverhaeltnisId}`)
}

/**
 * Mieter ins Portal einladen: Zugang für eine Mieterperson dieses Mietverhältnisses, dazu ein
 * Einladungslink (7 Tage). Ohne Mailversand steht der Link im Hinweis zum Weitergeben.
 */
export async function portalEinladen(_: FormStatus, d: FormData): Promise<FormStatus> {
  const mietverhaeltnisId = pflicht(d, 'mietverhaeltnisId', 'Mietverhältnis')
  try {
    await verlange({ stammdaten: ['schreiben'] })
    const personId = pflicht(d, 'personId', 'Mieter')
    const email = pflicht(d, 'email', 'E-Mail').toLowerCase()
    if (!/^[^\s@]+@[^\s@]+$/.test(email))
      throw new Eingabefehler('Bitte eine E-Mail-Adresse angeben.')
    const token = await mitMandant(async (tx, k) => {
      const mv = await letzteVersion(tx, 'mietverhaeltnis', mietverhaeltnisId)
      if (!mv?.mieterIds.includes(personId))
        throw new Eingabefehler('Die Person ist nicht Mieter dieses Mietverhältnisses.')
      const vorhanden = await portalZugaengeZuMv(tx, mietverhaeltnisId)
      if (vorhanden.some((z) => !z.widerrufenAm && z.email === email))
        throw new Eingabefehler(
          'Für diese Adresse gibt es schon einen Zugang. Einen neuen Link fordert der Mieter auf der Anmeldeseite an.',
        )
      const id = await legePortalZugangAn(tx, {
        mandantId: k.mandantId,
        mietverhaeltnisId,
        personId,
        email,
        akteur: { art: 'nutzer', id: k.nutzerId },
      })
      return portalLinkFuerZugang(tx, id, EINLADUNG_MINUTEN)
    })
    revalidatePath(`/mietverhaeltnisse/${mietverhaeltnisId}`)
    if (!token) return { fehler: 'Der Zugang ist angelegt, der Einladungslink aber nicht.' }
    const link = portalLink(token)
    const gesendet = await sendeMail({
      art: 'portal-einladung',
      an: email,
      betreff: 'Einladung zum Mieterportal',
      text: [
        'Guten Tag,',
        '',
        'Ihr Vermieter hat für Sie ein Mieterportal eingerichtet. Dort sehen Sie Ihren Mietvertrag,',
        'die Notfallnummern Ihres Hauses und können Mängel mit Foto melden.',
        '',
        'Mit diesem Link melden Sie sich zum ersten Mal an (gültig 7 Tage, nur einmal):',
        link,
        '',
        'Später fordern Sie auf der Anmeldeseite einfach einen neuen Link an.',
      ].join('\n'),
    })
    return gesendet
      ? { hinweis: `Einladung an ${email} verschickt.` }
      : {
          hinweis: `Zugang angelegt. Mailversand ist nicht eingerichtet; bitte diesen Link persönlich weitergeben (gültig 7 Tage, nur einmal): ${link}`,
        }
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
}

export async function portalSperren(_: FormStatus, d: FormData): Promise<FormStatus> {
  const mietverhaeltnisId = pflicht(d, 'mietverhaeltnisId', 'Mietverhältnis')
  try {
    await verlange({ stammdaten: ['schreiben'] })
    const id = pflicht(d, 'zugangId', 'Zugang')
    await mitMandant((tx, k) =>
      widerrufePortalZugang(tx, {
        mandantId: k.mandantId,
        id,
        akteur: { art: 'nutzer', id: k.nutzerId },
      }),
    )
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  revalidatePath(`/mietverhaeltnisse/${mietverhaeltnisId}`)
  return { hinweis: 'Zugang gesperrt.' }
}
