'use server'

import { neueVersion } from '@vermieteros/db'
import { EigentuemerschaftArt, ObjektDaten, type Herkunft } from '@vermieteros/schema'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { feld, fehlertext, type FormStatus } from '@/lib/form-status'
import { istRolle } from '@/lib/rechte'
import { mitMandant, verlange } from '@/lib/sitzung'

export async function mandantAnlegen(_: FormStatus, daten: FormData): Promise<FormStatus> {
  const name = feld(daten, 'name')
  const art = EigentuemerschaftArt.safeParse(feld(daten, 'art'))
  if (name.length < 2) return { fehler: 'Bitte einen Namen angeben.' }
  if (!art.success) return { fehler: 'Bitte die Art der Eigentümerschaft wählen.' }
  try {
    await auth.api.createOrganization({
      body: { name, slug: slug(name), metadata: { art: art.data } },
      headers: await headers(),
    })
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  // Menü im Layout zeigt Mandant und Zähler; Layouts rendern bei Navigation sonst nicht neu.
  revalidatePath('/', 'layout')
  redirect('/')
}

export async function mandantAktivieren(daten: FormData): Promise<void> {
  await auth.api.setActiveOrganization({
    body: { organizationId: feld(daten, 'id') },
    headers: await headers(),
  })
  revalidatePath('/', 'layout')
  redirect('/')
}

export async function einladen(_: FormStatus, daten: FormData): Promise<FormStatus> {
  const rolle = feld(daten, 'rolle')
  if (!istRolle(rolle)) return { fehler: 'Unbekannte Rolle.' }
  try {
    await verlange({ invitation: ['create'] })
    await auth.api.createInvitation({
      body: { email: feld(daten, 'email'), role: rolle },
      headers: await headers(),
    })
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  redirect('/mitglieder')
}

export async function objektAnlegen(_: FormStatus, daten: FormData): Promise<FormStatus> {
  const bestandSeit = feld(daten, 'bestandSeit')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bestandSeit))
    return { fehler: 'Bitte „Im Bestand seit“ angeben.' }
  const roh = {
    bezeichnung: feld(daten, 'bezeichnung'),
    anschaffungsdatum: bestandSeit,
    art: feld(daten, 'art'),
    strasse: feld(daten, 'strasse') || null,
    hausnummer: feld(daten, 'hausnummer') || null,
    plz: feld(daten, 'plz') || null,
    ort: feld(daten, 'ort') || null,
    bundesland: feld(daten, 'bundesland') || null,
  }
  const p = ObjektDaten.safeParse(roh)
  if (!p.success)
    return { fehler: p.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · ') }
  let objektId: string
  try {
    await verlange({ stammdaten: ['schreiben'] })
    objektId = await mitMandant(async (tx, k) => {
      const herkunft: Herkunft = Object.fromEntries(
        Object.entries(p.data)
          .filter(([, v]) => v != null)
          .map(([f]) => [f, { quelle: 'manuell' as const }]),
      )
      const r = await neueVersion(tx, {
        entitaet: 'objekt',
        mandantId: k.mandantId,
        akteur: { art: 'nutzer', id: k.nutzerId },
        // Stammdaten gelten ab Beginn des Bestands, sonst fehlen sie in früheren Steuerjahren.
        gueltigAb: bestandSeit,
        identitaet: {},
        herkunft,
        daten: p.data,
      })
      return r.identId
    })
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  revalidatePath('/', 'layout')
  redirect(`/objekte/${objektId}`)
}

function slug(name: string): string {
  const basis = name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `${basis || 'mandant'}-${crypto.randomUUID().slice(0, 6)}`
}
