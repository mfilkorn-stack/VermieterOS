'use server'

import { ladeTicket, letzteVersion, schema, type Tx } from '@vermieteros/db'
import { eq } from 'drizzle-orm'
import { TicketDaten, type TicketStatus } from '@vermieteros/schema'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { TICKET_STATUS_TEXT } from '@/lib/betrieb-text'
import { Eingabefehler, pflicht, text, zodText } from '@/lib/eingabe'
import { fehlertext, type FormStatus } from '@/lib/form-status'
import { mitMandant, verlange } from '@/lib/sitzung'
import { speichere } from '@/lib/speichern'
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
  if (!e || e.objektId !== objektId) throw new Eingabefehler('Die Einheit gehört nicht zum Objekt.')
}

export async function ticketAnlegen(_: FormStatus, d: FormData): Promise<FormStatus> {
  let id: string
  try {
    await verlange({ stammdaten: ['schreiben'] })
    const [objektId, einheitId] = pflicht(d, 'ort', 'Objekt').split('|')
    const p = TicketDaten.safeParse({
      titel: text(d, 'titel'),
      beschreibung: text(d, 'beschreibung'),
      status: 'gemeldet',
      prioritaet: text(d, 'prioritaet') ?? 'normal',
    })
    if (!p.success) throw new Eingabefehler(zodText(p.error, LABELS))
    id = await mitMandant(async (tx, k) => {
      if (!objektId || !(await letzteVersion(tx, 'objekt', objektId))) {
        throw new Eingabefehler('Objekt nicht gefunden.')
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
