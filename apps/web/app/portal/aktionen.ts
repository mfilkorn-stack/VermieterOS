'use server'

import {
  legePortalNachrichtAn,
  neueVersion,
  portalAbmelden,
  portalAnmelden,
  portalLinksAnfordern,
  type Tx,
} from '@vermieteros/db'
import { TicketDaten } from '@vermieteros/schema'
import { sql } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { Eingabefehler, pflicht, text, zodText } from '@/lib/eingabe'
import { fehlertext, type FormStatus } from '@/lib/form-status'
import { sendeMail } from '@/lib/mail'
import {
  benachrichtigeVermieter,
  BASIS_URL,
  LINK_MINUTEN,
  loeschePortalCookie,
  mitPortal,
  portalCookie,
  portalLink,
  setzePortalCookie,
  SITZUNG_TAGE,
} from '@/lib/portal'
import { objektSpeicher } from '@/lib/speicher'
import { uploadVorbereiten } from '@/lib/upload'
import { heuteBerlin } from '@/lib/zeit'

const FOTO_TYPEN = new Set(['image/jpeg', 'image/png', 'image/webp'])
const FOTO_FEHLER = 'Fotos bitte als JPG, PNG, WebP oder HEIC.'
const MAX_FOTO = 10 * 1024 * 1024
const MAX_FOTOS = 5
/** Unter der Grenze für Server Actions (next.config.ts) */
const MAX_FOTOS_ZUSAMMEN = 20 * 1024 * 1024

/**
 * Anmeldelink anfordern. Die Antwort ist immer dieselbe, ob die Adresse bekannt ist oder nicht;
 * so lassen sich keine Adressen abfragen.
 */
export async function linkAnfordern(_: FormStatus, d: FormData): Promise<FormStatus> {
  const hinweis =
    'Wenn die Adresse für ein Mieterportal hinterlegt ist, ist jetzt ein Anmeldelink unterwegs. Er gilt 15 Minuten.'
  try {
    const email = pflicht(d, 'email', 'E-Mail')
    if (!/^[^\s@]+@[^\s@]+$/.test(email))
      throw new Eingabefehler('Bitte eine E-Mail-Adresse angeben.')
    const links = await portalLinksAnfordern(db, email, LINK_MINUTEN)
    if (links.length > 0) {
      await sendeMail({
        art: 'portal-link',
        an: email,
        betreff: 'Ihr Anmeldelink zum Mieterportal',
        text: [
          'Guten Tag,',
          '',
          links.length === 1
            ? 'mit diesem Link melden Sie sich im Mieterportal an:'
            : 'Ihre Adresse ist für mehrere Wohnungen hinterlegt. Je Wohnung ein Link:',
          '',
          ...links.map((l) => portalLink(l.token)),
          '',
          'Der Link gilt 15 Minuten und nur einmal. Wenn Sie ihn nicht angefordert haben, ignorieren Sie diese Mail.',
        ].join('\n'),
      })
    }
  } catch (e) {
    if (e instanceof Eingabefehler) return { fehler: e.message }
    console.error(`[portal] Link anfordern: ${e instanceof Error ? e.message : e}`)
  }
  return { hinweis }
}

/**
 * Link einlösen. Bewusst per Knopf (POST) statt beim Öffnen: Virenscanner in Mailprogrammen
 * rufen Links vorab auf und würden den Einmal-Link sonst verbrauchen.
 */
export async function linkEinloesen(_: FormStatus, d: FormData): Promise<FormStatus> {
  const token = text(d, 'token')
  const s = token ? await portalAnmelden(db, token, SITZUNG_TAGE) : null
  if (!s)
    return {
      fehler: 'Der Link ist abgelaufen oder wurde schon benutzt. Bitte einen neuen anfordern.',
    }
  await setzePortalCookie(s.sitzung)
  redirect('/portal')
}

export async function abmelden(): Promise<void> {
  const c = await portalCookie()
  if (c) await portalAbmelden(db, c)
  await loeschePortalCookie()
  redirect('/portal/login')
}

async function ortDesMv(tx: Tx, mietverhaeltnisId: string) {
  const [r] = await tx.execute<{ objekt_id: string; einheit_id: string }>(sql`
    SELECT e.objekt_id, m.einheit_id FROM mietverhaeltnisse m
    JOIN einheiten e ON e.id = m.einheit_id WHERE m.id = ${mietverhaeltnisId}`)
  if (!r) throw new Eingabefehler('Mietverhältnis nicht gefunden.')
  return r
}

/** Mangel melden: wird ein Ticket „gemeldet“ am eigenen Mietverhältnis, Fotos als Dokumente. */
export async function mangelMelden(_: FormStatus, d: FormData): Promise<FormStatus> {
  try {
    const fotos = d.getAll('fotos').filter((f): f is File => f instanceof File && f.size > 0)
    if (fotos.length > MAX_FOTOS) throw new Eingabefehler(`Höchstens ${MAX_FOTOS} Fotos.`)
    for (const f of fotos) {
      if (f.size > MAX_FOTO) throw new Eingabefehler('Ein Foto ist größer als 10 MB.')
    }
    if (fotos.reduce((n, f) => n + f.size, 0) > MAX_FOTOS_ZUSAMMEN)
      throw new Eingabefehler('Die Fotos sind zusammen größer als 20 MB.')
    const p = TicketDaten.safeParse({
      titel: text(d, 'titel'),
      beschreibung: text(d, 'beschreibung'),
      status: 'gemeldet',
      prioritaet: text(d, 'dringend') ? 'hoch' : 'normal',
    })
    if (!p.success) throw new Eingabefehler(zodText(p.error, { titel: 'Was ist kaputt?' }))
    const inhalte = await Promise.all(
      fotos.map((f) => uploadVorbereiten(f, FOTO_TYPEN, FOTO_FEHLER)),
    )
    const s = await mitPortal(async (tx, s) => {
      const ort = await ortDesMv(tx, s.mietverhaeltnisId)
      const akteur = { art: 'portal' as const, id: s.zugangId }
      const t = await neueVersion(tx, {
        entitaet: 'ticket',
        mandantId: s.mandantId,
        akteur,
        gueltigAb: heuteBerlin(),
        identitaet: {
          objektId: ort.objekt_id,
          einheitId: ort.einheit_id,
          mietverhaeltnisId: s.mietverhaeltnisId,
        },
        daten: p.data,
      })
      for (const f of inhalte) {
        const a = await objektSpeicher().ablegen(s.mandantId, 'dokument', f.inhalt, f.mime)
        await neueVersion(tx, {
          entitaet: 'dokument',
          mandantId: s.mandantId,
          akteur,
          gueltigAb: heuteBerlin(),
          identitaet: {
            objektId: ort.objekt_id,
            mietverhaeltnisId: s.mietverhaeltnisId,
            ticketId: t.identId,
            dateiHash: a.sha256,
            speicherSchluessel: a.schluessel,
            dateiname: f.dateiname || 'foto.jpg',
            mime: f.mime,
            groesseBytes: a.groesse,
          },
          daten: {
            typ: 'mangelfoto',
            status: 'gueltig',
            titel: `Foto: ${p.data.titel}`.slice(0, 200),
          },
        })
      }
      return { ...s, ticketId: t.identId }
    })
    await benachrichtigeVermieter(
      s.mandantId,
      `Mängelmeldung im Mieterportal: ${p.data.titel}`,
      [
        `${s.email} hat im Mieterportal einen Mangel gemeldet:`,
        '',
        p.data.titel,
        p.data.beschreibung ?? '',
        fotos.length ? `${fotos.length} Foto(s) angehängt.` : '',
        '',
        `${BASIS_URL}/tickets/${s.ticketId}`,
      ]
        .filter((z, i, l) => z !== '' || l[i - 1] !== '')
        .join('\n'),
    )
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  redirect('/portal?gemeldet=1')
}

export async function nachrichtSenden(_: FormStatus, d: FormData): Promise<FormStatus> {
  try {
    const betreff = pflicht(d, 'betreff', 'Betreff').slice(0, 200)
    const inhalt = pflicht(d, 'text', 'Nachricht')
    if (inhalt.length > 5000) throw new Eingabefehler('Die Nachricht ist länger als 5000 Zeichen.')
    const s = await mitPortal(async (tx, s) => {
      await legePortalNachrichtAn(tx, { s, betreff, text: inhalt })
      return s
    })
    await benachrichtigeVermieter(
      s.mandantId,
      `Nachricht im Mieterportal: ${betreff}`,
      [
        `${s.email} schreibt im Mieterportal:`,
        '',
        inhalt,
        '',
        `${BASIS_URL}/mietverhaeltnisse/${s.mietverhaeltnisId}`,
      ].join('\n'),
    )
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  redirect('/portal?gesendet=1')
}
