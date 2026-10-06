'use server'

import { neueVersion } from '@vermieteros/db'
import { EigentuemerschaftArt, ObjektDaten, type Herkunft } from '@vermieteros/schema'
import { headers } from 'next/headers'
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
  redirect('/')
}

export async function mandantAktivieren(daten: FormData): Promise<void> {
  await auth.api.setActiveOrganization({
    body: { organizationId: feld(daten, 'id') },
    headers: await headers(),
  })
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
  const roh = {
    bezeichnung: feld(daten, 'bezeichnung'),
    art: feld(daten, 'art'),
    strasse: feld(daten, 'strasse') || null,
    hausnummer: feld(daten, 'hausnummer') || null,
    plz: feld(daten, 'plz') || null,
    ort: feld(daten, 'ort') || null,
  }
  const p = ObjektDaten.safeParse(roh)
  if (!p.success)
    return { fehler: p.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · ') }
  try {
    await verlange({ stammdaten: ['schreiben'] })
    await mitMandant((tx, k) => {
      const herkunft: Herkunft = Object.fromEntries(
        Object.entries(p.data)
          .filter(([, v]) => v != null)
          .map(([f]) => [f, { quelle: 'manuell' as const }]),
      )
      return neueVersion(tx, {
        entitaet: 'objekt',
        mandantId: k.mandantId,
        akteur: { art: 'nutzer', id: k.nutzerId },
        gueltigAb: new Date().toISOString().slice(0, 10),
        identitaet: {},
        herkunft,
        daten: p.data,
      })
    })
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  redirect('/')
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
