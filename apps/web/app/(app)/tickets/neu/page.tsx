import { juengsterKiVorschlag, ladeNachricht, ladeZuordnungsKandidaten } from '@vermieteros/db'
import type { Sortierung } from '@vermieteros/ki'
import { redirect } from 'next/navigation'
import { Auswahl, Feld } from '@/components/felder'
import { Formular } from '@/components/formular'
import { optionen, PRIORITAET_TEXT } from '@/lib/betrieb-text'
import { orte } from '@/lib/orte'
import { darf, mitMandant } from '@/lib/sitzung'
import { ticketAnlegen } from '../aktionen'

/** Neues Ticket, auf Wunsch vorbefüllt aus einer Mail (Zuordnung, Einschätzung der KI, Text). */
export default async function TicketNeu({
  searchParams,
}: {
  searchParams: Promise<{ nachricht?: string; objekt?: string }>
}) {
  if (!(await darf({ stammdaten: ['schreiben'] }))) redirect('/tickets')
  const sp = await searchParams
  const d = await mitMandant(async (tx) => {
    const liste = await orte(tx)
    if (!sp.nachricht) return { liste, vorlage: null }
    const n = await ladeNachricht(tx, sp.nachricht)
    if (!n) return { liste, vorlage: null }
    const mvId = n.zuordnungen.at(-1)?.mietverhaeltnisId ?? null
    const mv = mvId
      ? (await ladeZuordnungsKandidaten(tx)).find((k) => k.mietverhaeltnisId === mvId)
      : undefined
    const s = await juengsterKiVorschlag(tx, 'sortierung', { entitaet: 'nachricht', id: n.id })
    const sortierung = s && s.status !== 'verworfen' ? (s.ausgabe as Sortierung) : null
    return {
      liste,
      vorlage: {
        nachrichtId: n.id,
        mietverhaeltnisId: mv?.mietverhaeltnisId ?? null,
        ort: mv ? `${mv.objektId}|${mv.einheitId}` : undefined,
        titel: sortierung?.zusammenfassung ?? n.betreff,
        beschreibung: n.text.slice(0, 4000),
        prioritaet:
          sortierung?.dringlichkeit === 'notfall'
            ? 'notfall'
            : sortierung?.dringlichkeit === 'hoch'
              ? 'hoch'
              : 'normal',
      },
    }
  })
  const v = d.vorlage
  const ort = v?.ort ?? (sp.objekt ? `${sp.objekt}|` : undefined)
  return (
    <div className="karte">
      <h1>Ticket anlegen</h1>
      {d.liste.length === 0 ? (
        <p className="leise">Zuerst ein Objekt anlegen.</p>
      ) : (
        <Formular aktion={ticketAnlegen} knopf="Ticket anlegen" testId="ticket-anlegen">
          {v ? <input type="hidden" name="nachrichtId" value={v.nachrichtId} /> : null}
          {v?.mietverhaeltnisId ? (
            <input type="hidden" name="mietverhaeltnisId" value={v.mietverhaeltnisId} />
          ) : null}
          <Auswahl
            label="Wo"
            name="ort"
            optionen={d.liste.map((o) => [o.wert, o.text] as const)}
            defaultValue={ort}
          />
          <Feld label="Titel" name="titel" defaultValue={v?.titel ?? ''} required />
          <label>
            Beschreibung
            <textarea name="beschreibung" rows={6} defaultValue={v?.beschreibung ?? ''} />
          </label>
          <Auswahl
            label="Priorität"
            name="prioritaet"
            optionen={optionen(PRIORITAET_TEXT)}
            defaultValue={v?.prioritaet ?? 'normal'}
          />
        </Formular>
      )}
    </div>
  )
}
