'use server'

import {
  fachdaten,
  ladeDokument,
  ladeTicket,
  legeAntwortAn,
  letzteVersion,
  listeDokumente,
  listeHandwerker,
  listePostfaecher,
  schema,
  type Tx,
} from '@vermieteros/db'
import { sha256 } from '@vermieteros/post'
import { randomUUID } from 'node:crypto'
import {
  bestaetigeVorschlagInTx,
  erzeugeVorschlag,
  fuerDokument,
  TICKET_EXTRAKTION,
} from '@vermieteros/ki'
import { eq } from 'drizzle-orm'
import { DokumentDaten, TicketDaten, type TicketStatus } from '@vermieteros/schema'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { TICKET_STATUS_TEXT } from '@/lib/betrieb-text'
import { DATEI_FEHLER, ERLAUBTE_TYPEN, MAX_GROESSE } from '@/lib/dokument-text'
import { Eingabefehler, pflicht, text, zodText } from '@/lib/eingabe'
import { fehlertext, type FormStatus } from '@/lib/form-status'
import { kiUmgebung } from '@/lib/ki'
import { absenderAdresse, mailEingerichtet, sendeMail } from '@/lib/mail'
import { mitMandant, verlange, type MandantKontext } from '@/lib/sitzung'
import { objektSpeicher } from '@/lib/speicher'
import { speichere } from '@/lib/speichern'
import { uploadVorbereiten } from '@/lib/upload'
import { berlinZuIso, heuteBerlin } from '@/lib/zeit'

const LABELS = { titel: 'Titel', auftragnehmerId: 'Handwerker', termin: 'Termin' }

/** Beauftragt und Termin brauchen einen Handwerker, ein Termin braucht ein Datum. */
function pruefeAblauf(d: {
  status: TicketStatus
  auftragnehmerId?: string | null | undefined
  termin?: string | null | undefined
}) {
  if ((d.status === 'beauftragt' || d.status === 'termin') && !d.auftragnehmerId) {
    throw new Eingabefehler('Für „beauftragt“ bitte einen Handwerker wählen.')
  }
  if (d.status === 'termin' && !d.termin) throw new Eingabefehler('Bitte den Termin angeben.')
}

async function einheitGehoertZumObjekt(tx: Tx, objektId: string, einheitId: string | null) {
  if (!einheitId) return
  const [e] = await tx
    .select({ objektId: schema.einheiten.objektId })
    .from(schema.einheiten)
    .where(eq(schema.einheiten.id, einheitId))
  if (!e || e.objektId !== objektId)
    throw new Eingabefehler('Die Einheit gehört nicht zur Immobilie.')
}

export async function ticketAnlegen(_: FormStatus, d: FormData): Promise<FormStatus> {
  let id: string
  try {
    await verlange({ stammdaten: ['schreiben'] })
    const [objektId, einheitId] = pflicht(d, 'ort', 'Immobilie').split('|')
    const p = TicketDaten.safeParse({
      titel: text(d, 'titel'),
      beschreibung: text(d, 'beschreibung'),
      status: 'gemeldet',
      prioritaet: text(d, 'prioritaet') ?? 'normal',
    })
    if (!p.success) throw new Eingabefehler(zodText(p.error, LABELS))
    id = await mitMandant(async (tx, k) => {
      if (!objektId || !(await letzteVersion(tx, 'objekt', objektId))) {
        throw new Eingabefehler('Immobilie nicht gefunden.')
      }
      await einheitGehoertZumObjekt(tx, objektId, einheitId || null)
      const r = await speichere(tx, k, {
        entitaet: 'ticket',
        identitaet: {
          objektId,
          einheitId: einheitId || null,
          mietverhaeltnisId: text(d, 'mietverhaeltnisId'),
          nachrichtId: text(d, 'nachrichtId'),
        },
        daten: p.data,
        gueltigAb: heuteBerlin(),
      })
      const dokumentId = text(d, 'dokumentId')
      if (dokumentId) await dateiAnsTicket(tx, k, dokumentId, r.identId, objektId)
      const vorschlagId = text(d, 'vorschlagId')
      if (vorschlagId) {
        // Der Vorschlag gilt als bestätigt, sobald das Ticket aus ihm entsteht; veraltete
        // Vorschläge (Datei inzwischen ersetzt) halten das Anlegen nicht auf.
        await bestaetigeVorschlagInTx(
          tx,
          { mandantId: k.mandantId, akteur: { art: 'nutzer', id: k.nutzerId } },
          vorschlagId,
        ).catch(() => undefined)
      }
      return r.identId
    })
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  revalidatePath('/', 'layout')
  redirect(`/tickets/${id}`)
}

/** Status, Handwerker, Termin, Notizen; jede Änderung ist eine Version mit Begründung. */
export async function ticketAktualisieren(_: FormStatus, d: FormData): Promise<FormStatus> {
  let id: string
  try {
    await verlange({ stammdaten: ['schreiben'] })
    id = pflicht(d, 'ticketId', 'Ticket')
    const termin = text(d, 'termin')
    await mitMandant(async (tx, k) => {
      const alt = await ladeTicket(tx, id)
      if (!alt) throw new Eingabefehler('Ticket nicht gefunden.')
      const p = TicketDaten.safeParse({
        titel: text(d, 'titel') ?? alt.titel,
        beschreibung: text(d, 'beschreibung') ?? alt.beschreibung,
        status: text(d, 'status'),
        prioritaet: text(d, 'prioritaet') ?? alt.prioritaet,
        auftragnehmerId: text(d, 'auftragnehmerId'),
        termin: termin ? berlinZuIso(termin) : null,
        notizen: text(d, 'notizen'),
      })
      if (!p.success) throw new Eingabefehler(zodText(p.error, LABELS))
      pruefeAblauf(p.data)
      const heute = heuteBerlin()
      await speichere(tx, k, {
        entitaet: 'ticket',
        identId: id,
        daten: p.data,
        gueltigAb: heute > alt.gueltigAb ? heute : alt.gueltigAb,
        begruendung:
          text(d, 'begruendung') ??
          (p.data.status !== alt.status
            ? `Status: ${TICKET_STATUS_TEXT[p.data.status]}`
            : 'Ticket aktualisiert'),
      })
    })
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  revalidatePath('/', 'layout')
  redirect(`/tickets/${id}`)
}

/**
 * Datei einer Meldung ans Ticket hängen: Dokumente sind unveränderlich, deshalb entsteht ein
 * zweiter Eintrag am Ticket mit derselben Datei (kein zweiter Upload), und der Eintrag am
 * Objekt gilt als ersetzt.
 */
async function dateiAnsTicket(
  tx: Tx,
  k: MandantKontext,
  dokumentId: string,
  ticketId: string,
  objektId: string,
) {
  const alt = await ladeDokument(tx, dokumentId)
  const v = await letzteVersion(tx, 'dokument', dokumentId)
  if (!alt || !v || alt.objektId !== objektId || alt.ticketId)
    throw new Eingabefehler('Die Datei gehört nicht zu dieser Immobilie.')
  const daten = fachdaten('dokument', v)
  const neu = await speichere(tx, k, {
    entitaet: 'dokument',
    identitaet: {
      objektId,
      mietverhaeltnisId: null,
      ticketId,
      beleg: false,
      anhangId: alt.anhangId,
      dateiHash: alt.dateiHash,
      speicherSchluessel: alt.speicherSchluessel,
      dateiname: alt.dateiname,
      mime: alt.mime,
      groesseBytes: alt.groesseBytes,
    },
    daten: { ...daten, status: 'gueltig', ersetztDurch: null },
    gueltigAb: heuteBerlin(),
  })
  await speichere(tx, k, {
    entitaet: 'dokument',
    identId: dokumentId,
    daten: { ...daten, status: 'ersetzt', ersetztDurch: neu.identId },
    gueltigAb: heuteBerlin() > alt.gueltigAb ? heuteBerlin() : alt.gueltigAb,
    begruendung: 'Ans Ticket gehängt',
  })
}

/**
 * Ticket aus einer Datei (UX-8): Mängelmeldung oder Schreiben als PDF oder Foto hochladen, die
 * KI schlägt Titel, Beschreibung und Priorität vor, das Formular ist vorbelegt und wird bestätigt.
 * Die Datei liegt bis dahin als Dokument am Objekt.
 */
export async function ticketAusDatei(_: FormStatus, d: FormData): Promise<FormStatus> {
  let ziel: string
  try {
    await verlange({ stammdaten: ['schreiben'] })
    const datei = d.get('datei')
    if (!(datei instanceof File) || datei.size === 0)
      throw new Eingabefehler('Bitte eine Datei wählen.')
    if (datei.size > MAX_GROESSE) throw new Eingabefehler('Die Datei ist größer als 20 MB.')
    const upload = await uploadVorbereiten(datei, ERLAUBTE_TYPEN, DATEI_FEHLER)
    const ort = pflicht(d, 'ort', 'Immobilie')
    const [objektId] = ort.split('|')
    const id = await mitMandant(async (tx, k) => {
      if (!objektId || !(await letzteVersion(tx, 'objekt', objektId)))
        throw new Eingabefehler('Immobilie nicht gefunden.')
      const abgelegt = await objektSpeicher().ablegen(
        k.mandantId,
        'dokument',
        upload.inhalt,
        upload.mime,
      )
      const r = await speichere(tx, k, {
        entitaet: 'dokument',
        identitaet: {
          objektId,
          mietverhaeltnisId: null,
          ticketId: null,
          beleg: false,
          anhangId: null,
          dateiHash: abgelegt.sha256,
          speicherSchluessel: abgelegt.schluessel,
          dateiname: upload.dateiname,
          mime: upload.mime,
          groesseBytes: abgelegt.groesse,
        },
        daten: DokumentDaten.parse({
          typ: upload.mime.startsWith('image/') ? 'mangelfoto' : 'sonstiges',
          status: 'gueltig',
          titel: 'Meldung: ' + upload.dateiname,
        }),
        gueltigAb: heuteBerlin(),
      })
      return r.identId
    })
    const u = await kiUmgebung()
    if (u) {
      try {
        await erzeugeVorschlag(u, TICKET_EXTRAKTION, (tx) => fuerDokument(tx, id, objektSpeicher()))
      } catch (e) {
        console.warn('[ticket] Auslesen gescheitert: ' + (e instanceof Error ? e.message : e))
      }
    }
    ziel = `/tickets/neu?dokument=${id}&ort=${encodeURIComponent(ort)}`
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  redirect(ziel)
}

/** Obergrenze für Fotos im Handwerkerauftrag; größere Mails lehnen viele Server ab. */
const MAX_ANHANG_BYTES = 15 * 1024 * 1024

/**
 * Handwerkerauftrag aus dem Ticket per Mail (P8): gleicher Versandweg wie Antworten, Reply-To ist
 * das Vermietungs-Postfach, damit die Rückmeldung im Posteingang landet. Vermerk und, bei einem
 * nur gemeldeten Ticket, der Wechsel auf „beauftragt“ stehen vor dem Versand in derselben
 * Transaktion und fallen weg, wenn der Server ablehnt.
 */
export async function auftragSenden(_: FormStatus, d: FormData): Promise<FormStatus> {
  let id: string
  try {
    await verlange({ stammdaten: ['schreiben'] })
    id = pflicht(d, 'ticketId', 'Ticket')
    if (!mailEingerichtet())
      throw new Eingabefehler('Der Mailversand ist nicht eingerichtet (SMTP_HOST).')
    const an = pflicht(d, 'an', 'Empfänger').toLowerCase()
    if (!/^[^\s@]+@[^\s@]+$/.test(an)) throw new Eingabefehler('Empfänger: keine Mailadresse.')
    const betreff = pflicht(d, 'betreff', 'Betreff')
    const inhalt = pflicht(d, 'text', 'Text')
    const mitFotos = d.get('fotos') === 'ja'
    await mitMandant(async (tx, k) => {
      const t = await ladeTicket(tx, id)
      if (!t) throw new Eingabefehler('Ticket nicht gefunden.')
      const h = (await listeHandwerker(tx)).find((x) => x.id === t.auftragnehmerId)
      if (!h) throw new Eingabefehler('Bitte zuerst einen Handwerker am Ticket wählen.')

      const anhaenge: Array<{ dateiname: string; inhalt: Buffer; mime: string }> = []
      if (mitFotos) {
        const fotos = (await listeDokumente(tx, { ticketId: id })).filter(
          (x) => x.typ === 'mangelfoto' && x.status === 'gueltig',
        )
        let summe = 0
        for (const f of fotos) {
          const dok = await ladeDokument(tx, f.id)
          if (!dok) continue
          const bytes = await objektSpeicher().holen(dok.speicherSchluessel)
          if (sha256(bytes) !== dok.dateiHash)
            throw new Eingabefehler(`Prüfsumme von „${dok.dateiname}“ stimmt nicht.`)
          summe += bytes.length
          if (summe > MAX_ANHANG_BYTES)
            throw new Eingabefehler('Die Fotos sind zusammen größer als 15 MB; ohne Fotos senden.')
          anhaenge.push({ dateiname: dok.dateiname, inhalt: bytes, mime: dok.mime })
        }
      }

      const messageId = `<${randomUUID()}@${absenderAdresse().split('@')[1] ?? 'vermieteros'}>`
      await legeAntwortAn(tx, {
        mandantId: k.mandantId,
        nachrichtId: null,
        ticketId: id,
        handwerkerId: h.id,
        mietverhaeltnisId: null,
        an: [an],
        betreff,
        text: inhalt,
        messageId,
        akteur: { art: 'nutzer', id: k.nutzerId },
      })
      if (t.status === 'gemeldet') {
        const v = await letzteVersion(tx, 'ticket', id)
        if (!v) throw new Eingabefehler('Ticket nicht gefunden.')
        const heute = heuteBerlin()
        await speichere(tx, k, {
          entitaet: 'ticket',
          identId: id,
          daten: { ...fachdaten('ticket', v), status: 'beauftragt' },
          gueltigAb: heute > t.gueltigAb ? heute : t.gueltigAb,
          begruendung: `Auftrag per Mail an ${h.firma}`,
        })
      }
      const postfach = (await listePostfaecher(tx)).find(
        (x) => x.aktiv && x.zweck === 'post' && x.benutzer.includes('@'),
      )
      const ok = await sendeMail({
        art: 'handwerkerauftrag',
        an,
        betreff,
        text: inhalt,
        messageId,
        replyTo: postfach?.benutzer ?? null,
        ...(anhaenge.length ? { anhaenge } : {}),
      })
      if (!ok) throw new Eingabefehler('Der Mailserver hat den Auftrag abgelehnt.')
    })
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  revalidatePath('/', 'layout')
  redirect(`/tickets/${id}`)
}
