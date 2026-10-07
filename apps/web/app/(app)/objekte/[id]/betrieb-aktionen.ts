'use server'

import { letzteVersion, ladeNotfallkarte, storniereAlles, type Tx } from '@vermieteros/db'
import { NotfallkarteDaten, WissensartikelDaten } from '@vermieteros/schema'
import { redirect } from 'next/navigation'
import type { NotfallRoh } from '@/components/notfallkarte-editor'
import { Eingabefehler, haken, json, pflicht, text, zodText } from '@/lib/eingabe'
import { fehlertext, type FormStatus } from '@/lib/form-status'
import { mitMandant, verlange, type MandantKontext } from '@/lib/sitzung'
import { speichere } from '@/lib/speichern'
import { heuteBerlin } from '@/lib/zeit'

async function amObjekt(
  d: FormData,
  fn: (tx: Tx, k: MandantKontext, objektId: string) => Promise<unknown>,
): Promise<FormStatus> {
  let objektId: string
  try {
    await verlange({ stammdaten: ['schreiben'] })
    objektId = pflicht(d, 'objektId', 'Objekt')
    await mitMandant(async (tx, k) => {
      if (!(await letzteVersion(tx, 'objekt', objektId)))
        throw new Eingabefehler('Objekt nicht gefunden.')
      await fn(tx, k, objektId)
    })
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  redirect(`/objekte/${objektId}`)
}

/** Notfallkarte als Ganzes speichern; jede Änderung ist eine neue Version. */
export async function notfallkarteSpeichern(_: FormStatus, d: FormData): Promise<FormStatus> {
  return amObjekt(d, async (tx, k, objektId) => {
    const roh = json<NotfallRoh[]>(d, 'eintraege') ?? []
    const eintraege = roh
      .filter((z) => z.handwerkerId || z.name.trim() || z.telefon.trim())
      .map((z) => ({
        art: z.art,
        handwerkerId: z.handwerkerId || null,
        name: z.handwerkerId ? null : z.name.trim() || null,
        telefon: z.handwerkerId ? null : z.telefon.trim() || null,
        hinweis: z.hinweis.trim() || null,
      }))
    const p = NotfallkarteDaten.safeParse({ eintraege })
    if (!p.success) throw new Eingabefehler(zodText(p.error))
    const vorhanden = await ladeNotfallkarte(tx, objektId)
    if (vorhanden) {
      await speichere(tx, k, {
        entitaet: 'notfallkarte',
        identId: vorhanden.id,
        daten: p.data,
        gueltigAb: heuteBerlin() > vorhanden.gueltigAb ? heuteBerlin() : vorhanden.gueltigAb,
        begruendung: 'Notfallkarte aktualisiert',
      })
    } else {
      await speichere(tx, k, {
        entitaet: 'notfallkarte',
        identitaet: { objektId },
        daten: p.data,
        gueltigAb: heuteBerlin(),
      })
    }
  })
}

export async function wissenSpeichern(_: FormStatus, d: FormData): Promise<FormStatus> {
  return amObjekt(d, async (tx, k, objektId) => {
    const p = WissensartikelDaten.safeParse({
      titel: text(d, 'titel'),
      kategorie: text(d, 'kategorie'),
      inhalt: text(d, 'inhalt'),
      mieterSichtbar: haken(d, 'mieterSichtbar'),
    })
    if (!p.success) {
      throw new Eingabefehler(
        zodText(p.error, { titel: 'Titel', inhalt: 'Inhalt', kategorie: 'Art' }),
      )
    }
    const id = text(d, 'wissensartikelId')
    if (id) {
      const letzte = await letzteVersion(tx, 'wissensartikel', id)
      if (!letzte) throw new Eingabefehler('Artikel nicht gefunden.')
      await speichere(tx, k, {
        entitaet: 'wissensartikel',
        identId: id,
        daten: p.data,
        gueltigAb: heuteBerlin() > letzte.gueltigAb ? heuteBerlin() : letzte.gueltigAb,
        begruendung: 'Artikel überarbeitet',
      })
    } else {
      await speichere(tx, k, {
        entitaet: 'wissensartikel',
        identitaet: { objektId },
        daten: p.data,
        gueltigAb: heuteBerlin(),
      })
    }
  })
}

export async function wissenEntfernen(_: FormStatus, d: FormData): Promise<FormStatus> {
  return amObjekt(d, (tx, k) =>
    storniereAlles(tx, {
      entitaet: 'wissensartikel',
      identId: pflicht(d, 'wissensartikelId', 'Artikel'),
      mandantId: k.mandantId,
      akteur: { art: 'nutzer', id: k.nutzerId },
      grund: 'Artikel entfernt',
    }),
  )
}
