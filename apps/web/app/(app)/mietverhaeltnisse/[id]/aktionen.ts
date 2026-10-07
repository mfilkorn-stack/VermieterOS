'use server'

import { legeTelefonnotizAn } from '@vermieteros/db'
import { GESPRAECH_RICHTUNGEN, type GespraechRichtung } from '@vermieteros/schema'
import { redirect } from 'next/navigation'
import { Eingabefehler, pflicht, text } from '@/lib/eingabe'
import { fehlertext, type FormStatus } from '@/lib/form-status'
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
