'use server'

import { ladeDokument, ladeSteuerpaket, neueVersion, storniereVersion } from '@vermieteros/db'
import { SteuerpaketDaten } from '@vermieteros/schema'
import { redirect } from 'next/navigation'
import { Eingabefehler, euro, haken, pflicht, text, zodText } from '@/lib/eingabe'
import { fehlertext, type FormStatus } from '@/lib/form-status'
import { mitMandant, verlange } from '@/lib/sitzung'
import { ladeSteuerSeite, WEITERE_ZEILEN } from '@/lib/steuer'
import { steuerFestschreiben as festschreiben } from '@/lib/steuer-paket'
import { heuteBerlin } from '@/lib/zeit'

function ziel(d: FormData): { objektId: string; jahr: number } {
  const objektId = pflicht(d, 'objektId', 'Objekt')
  const jahr = Number(pflicht(d, 'jahr', 'Jahr'))
  if (!Number.isInteger(jahr) || jahr < 2000 || jahr > 2100)
    throw new Eingabefehler('Jahr zwischen 2000 und 2100.')
  return { objektId, jahr }
}

const pfad = (z: { objektId: string; jahr: number }) => `/steuer/${z.objektId}/${z.jahr}`

/** Korrekturen speichern (Entwurf): Mietausfall, Hausgeld laut WEG-Abrechnung, Zinsen, weitere. */
export async function steuerSpeichern(_: FormStatus, d: FormData): Promise<FormStatus> {
  let z: { objektId: string; jahr: number }
  try {
    await verlange({ stammdaten: ['schreiben'] })
    z = ziel(d)
    const gezahlt = euro(d, 'hausgeldGezahlt', 'Hausgeld gezahlt')
    const weitere = []
    for (let i = 0; i < WEITERE_ZEILEN; i++) {
      const bezeichnung = text(d, `weitereBez_${i}`)
      const betrag = euro(d, `weitereBetrag_${i}`, 'Betrag')
      if (!bezeichnung && betrag == null) continue
      if (!bezeichnung || betrag == null)
        throw new Eingabefehler('Weitere Werbungskosten brauchen Bezeichnung und Betrag.')
      weitere.push({ bezeichnung, betragCent: betrag })
    }
    const p = SteuerpaketDaten.safeParse({
      mietausfallCent: euro(d, 'mietausfall', 'Mietausfall') ?? 0,
      hausgeld:
        gezahlt == null
          ? null
          : {
              gezahltCent: gezahlt,
              zufuehrungCent: euro(d, 'hausgeldZufuehrung', 'Zuführung Rücklage') ?? 0,
              entnahmeCent: euro(d, 'hausgeldEntnahme', 'Entnahme Rücklage') ?? 0,
            },
      schuldzinsenCent: euro(d, 'schuldzinsen', 'Schuldzinsen'),
      weitere,
      notizen: text(d, 'notizen'),
      status: 'entwurf',
    })
    if (!p.success) throw new Eingabefehler(zodText(p.error))
    await mitMandant(async (tx, k) => {
      const paket = await ladeSteuerpaket(tx, z.objektId, z.jahr)
      if (paket?.version.status === 'festgeschrieben')
        throw new Eingabefehler('Das Steuerpaket ist festgeschrieben und lässt sich nicht ändern.')
      const basis = {
        entitaet: 'steuerpaket' as const,
        mandantId: k.mandantId,
        akteur: { art: 'nutzer' as const, id: k.nutzerId },
        gueltigAb: heuteBerlin(),
        daten: p.data,
      }
      if (paket) await neueVersion(tx, { ...basis, identId: paket.id, begruendung: 'Korrekturen' })
      else await neueVersion(tx, { ...basis, identitaet: z })
    })
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  redirect(pfad(z))
}

export async function steuerFestschreiben(_: FormStatus, d: FormData): Promise<FormStatus> {
  let z: { objektId: string; jahr: number }
  try {
    await verlange({ stammdaten: ['schreiben'], export: ['steuerpaket'] })
    z = ziel(d)
    await mitMandant(async (tx, k) => {
      const s = await ladeSteuerSeite(tx, z.objektId, z.jahr)
      if (!s) throw new Eingabefehler('Objekt nicht gefunden.')
      await festschreiben(tx, k, s, { befundeBestaetigt: haken(d, 'bestaetigt') })
    })
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  redirect(pfad(z))
}

/** Korrektur nach Festschreibung: Version stornieren, Paket gilt als ersetzt. */
export async function steuerAufheben(_: FormStatus, d: FormData): Promise<FormStatus> {
  let z: { objektId: string; jahr: number }
  try {
    await verlange({ stammdaten: ['schreiben'] })
    z = ziel(d)
    const grund = pflicht(d, 'grund', 'Grund der Korrektur')
    await mitMandant(async (tx, k) => {
      const p = await ladeSteuerpaket(tx, z.objektId, z.jahr)
      if (!p || p.version.status !== 'festgeschrieben')
        throw new Eingabefehler('Das Steuerpaket ist nicht festgeschrieben.')
      const akteur = { art: 'nutzer' as const, id: k.nutzerId }
      const dok = p.version.paketDokumentId
        ? await ladeDokument(tx, p.version.paketDokumentId)
        : null
      if (dok && dok.status === 'gueltig')
        await neueVersion(tx, {
          entitaet: 'dokument',
          mandantId: k.mandantId,
          akteur,
          gueltigAb: heuteBerlin(),
          identId: dok.id,
          begruendung: `Steuerpaket korrigiert: ${grund}`,
          daten: {
            typ: dok.typ,
            titel: dok.titel,
            dokumentdatum: dok.dokumentdatum,
            gueltigBis: dok.gueltigBis,
            notizen: dok.notizen,
            status: 'ersetzt',
          },
        })
      await storniereVersion(tx, {
        entitaet: 'steuerpaket',
        mandantId: k.mandantId,
        versionId: p.version.id,
        akteur,
        grund,
      })
    })
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  redirect(pfad(z))
}
