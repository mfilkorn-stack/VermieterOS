'use server'

import { storniereAlles } from '@vermieteros/db'
import { GEWERKE, HandwerkerDaten } from '@vermieteros/schema'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { datum, Eingabefehler, ganz, haken, pflicht, text, zodText } from '@/lib/eingabe'
import { fehlertext, type FormStatus } from '@/lib/form-status'
import { mitMandant, verlange } from '@/lib/sitzung'
import { speichere } from '@/lib/speichern'

export async function handwerkerSpeichern(_: FormStatus, d: FormData): Promise<FormStatus> {
  try {
    await verlange({ stammdaten: ['schreiben'] })
    const roh = {
      firma: pflicht(d, 'firma', 'Firma'),
      ansprechpartner: text(d, 'ansprechpartner'),
      gewerke: d.getAll('gewerke').filter((g): g is string => GEWERKE.includes(g as never)),
      telefon: text(d, 'telefon'),
      notdienstTelefon: text(d, 'notdienstTelefon'),
      email: text(d, 'email'),
      strasse: text(d, 'strasse'),
      hausnummer: text(d, 'hausnummer'),
      plz: text(d, 'plz'),
      ort: text(d, 'ort'),
      webseite: text(d, 'webseite'),
      notdienst: haken(d, 'notdienst'),
      objektIds: d.getAll('objektIds').map(String),
      bewertung: ganz(d, 'bewertung', 'Bewertung'),
      notizen: text(d, 'notizen'),
    }
    const p = HandwerkerDaten.safeParse(roh)
    if (!p.success) throw new Eingabefehler(zodText(p.error))
    const id = text(d, 'handwerkerId')
    await mitMandant((tx, k) =>
      id
        ? speichere(tx, k, {
            entitaet: 'handwerker',
            identId: id,
            daten: p.data,
            gueltigAb: datum(d, 'giltAb', 'Gilt ab'),
            begruendung: text(d, 'begruendung'),
          })
        : speichere(tx, k, {
            entitaet: 'handwerker',
            identitaet: {},
            daten: p.data,
            gueltigAb: datum(d, 'giltAb', 'Gilt ab'),
          }),
    )
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  revalidatePath('/', 'layout')
  redirect('/handwerker')
}

export async function handwerkerEntfernen(_: FormStatus, d: FormData): Promise<FormStatus> {
  try {
    await verlange({ stammdaten: ['schreiben'] })
    const id = pflicht(d, 'handwerkerId', 'Handwerker')
    await mitMandant((tx, k) =>
      storniereAlles(tx, {
        entitaet: 'handwerker',
        identId: id,
        mandantId: k.mandantId,
        akteur: { art: 'nutzer', id: k.nutzerId },
        grund: 'aus dem Verzeichnis entfernt',
      }),
    )
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  redirect('/handwerker')
}
