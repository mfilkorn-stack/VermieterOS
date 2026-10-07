'use server'

import { bkAbrechnungZuJahr, ladeBkAbrechnung, neueVersion } from '@vermieteros/db'
import type { BkAbrechnungDaten } from '@vermieteros/schema'
import { redirect } from 'next/navigation'
import { ausRoh, datenAusVersion, type BkRoh } from '@/lib/bk'
import { Eingabefehler, json, pflicht } from '@/lib/eingabe'
import { fehlertext, type FormStatus } from '@/lib/form-status'
import { mitMandant, verlange } from '@/lib/sitzung'
import { heuteBerlin } from '@/lib/zeit'

/**
 * Neue Abrechnung für Einheit und Jahr. Positionen und Bezugsgrößen kommen aus dem Vorjahr,
 * die Beträge sind leer: Jede Zahl wird für das neue Jahr bewusst eingetragen.
 */
export async function bkAnlegen(_: FormStatus, d: FormData): Promise<FormStatus> {
  let id: string
  try {
    await verlange({ stammdaten: ['schreiben'] })
    const einheitId = pflicht(d, 'einheitId', 'Einheit')
    const jahr = Number(pflicht(d, 'jahr', 'Jahr'))
    if (!Number.isInteger(jahr) || jahr < 2000 || jahr > 2100)
      throw new Eingabefehler('Jahr zwischen 2000 und 2100.')
    id = await mitMandant(async (tx, k) => {
      const vorhanden = await bkAbrechnungZuJahr(tx, einheitId, jahr)
      if (vorhanden) return vorhanden
      const vorjahrId = await bkAbrechnungZuJahr(tx, einheitId, jahr - 1)
      const vorjahr = vorjahrId ? await ladeBkAbrechnung(tx, vorjahrId) : null
      const alt = vorjahr ? datenAusVersion(vorjahr.version) : null
      const daten: BkAbrechnungDaten = {
        zeitraumVon: `${jahr}-01-01`,
        zeitraumBis: `${jahr}-12-31`,
        positionen: (alt?.positionen ?? []).map((p) => ({
          ...p,
          gesamtCent: 0,
          schluessel:
            p.schluessel.art === 'direkt' ? { art: 'direkt', einheitCent: 0 } : p.schluessel,
        })),
        messdienst: null,
        vorauszahlungen: null,
        status: 'entwurf',
        notizen: null,
      }
      const r = await neueVersion(tx, {
        entitaet: 'bk_abrechnung',
        mandantId: k.mandantId,
        akteur: { art: 'nutzer', id: k.nutzerId },
        gueltigAb: heuteBerlin(),
        identitaet: { einheitId, jahr },
        daten,
      })
      return r.identId
    })
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  redirect(`/betriebskosten/${id}`)
}

export async function bkSpeichern(_: FormStatus, d: FormData): Promise<FormStatus> {
  const id = pflicht(d, 'id', 'Abrechnung')
  try {
    await verlange({ stammdaten: ['schreiben'] })
    const roh = json<BkRoh>(d, 'daten')
    if (!roh) throw new Eingabefehler('Keine Daten.')
    const daten = ausRoh(roh, 'entwurf')
    await mitMandant(async (tx, k) => {
      const a = await ladeBkAbrechnung(tx, id)
      if (!a) throw new Eingabefehler('Abrechnung nicht gefunden.')
      if (a.version.status === 'festgeschrieben')
        throw new Eingabefehler(
          'Die Abrechnung ist festgeschrieben und lässt sich nicht mehr ändern.',
        )
      await neueVersion(tx, {
        entitaet: 'bk_abrechnung',
        mandantId: k.mandantId,
        akteur: { art: 'nutzer', id: k.nutzerId },
        gueltigAb: heuteBerlin(),
        identId: id,
        begruendung: 'Entwurf bearbeitet',
        daten,
      })
    })
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  redirect(`/betriebskosten/${id}`)
}
