import {
  juengsterKiVorschlag,
  ladeDokument,
  ladeNachricht,
  ladeZuordnungsKandidaten,
} from '@vermieteros/db'
import type { Sortierung, TicketAuszug } from '@vermieteros/ki'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Auswahl, Feld } from '@/components/felder'
import { Formular } from '@/components/formular'
import { optionen, PRIORITAET_TEXT } from '@/lib/betrieb-text'
import { orte } from '@/lib/orte'
import { darf, mitMandant } from '@/lib/sitzung'
import { DATEI_ACCEPT } from '@/lib/dokument-text'
import { kiEingerichtet } from '@/lib/ki'
import { KiHinweis } from '@/components/ki-hinweis'
import { ticketAnlegen, ticketAusDatei } from '../aktionen'

/** Neues Ticket, auf Wunsch vorbefüllt aus einer Mail (Zuordnung, Einschätzung der KI, Text). */
export default async function TicketNeu({
  searchParams,
}: {
  searchParams: Promise<{ nachricht?: string; objekt?: string; dokument?: string; ort?: string }>
}) {
  if (!(await darf({ stammdaten: ['schreiben'] }))) redirect('/tickets')
  const sp = await searchParams
  const d = await mitMandant(async (tx) => {
    const liste = await orte(tx)
    if (sp.dokument) {
      // Aus einer hochgeladenen Datei (UX-8): Vorschlag der KI vorbelegt, Mensch bestätigt
      const dok = await ladeDokument(tx, sp.dokument)
      if (!dok) return { liste, vorlage: null }
      const v = await juengsterKiVorschlag(tx, 'ticket_extraktion', {
        entitaet: 'dokument',
        id: dok.id,
      })
      const a =
        v && (v.status === 'offen' || v.status === 'bestaetigt')
          ? (v.ausgabe as TicketAuszug)
          : null
      return {
        liste,
        vorlage: {
          nachrichtId: null,
          mietverhaeltnisId: null,
          dokumentId: dok.id,
          vorschlagId: a ? v!.id : null,
          dateiname: dok.dateiname,
          ort: sp.ort ?? `${dok.objektId}|`,
          titel: a?.titel ?? '',
          beschreibung: a?.beschreibung ?? '',
          prioritaet: a?.prioritaet ?? 'normal',
          hinweise: a?.hinweise ?? [],
        },
      }
    }
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
        dokumentId: null,
        vorschlagId: null,
        dateiname: null,
        hinweise: [] as string[],
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
    <>
      <nav className="brotkrumen" aria-label="Pfad">
        <Link href={'/tickets'}>Tickets</Link>
        <span aria-hidden>/</span>
        <span>Ticket anlegen</span>
      </nav>
      <div className="karte">
        <h1>Ticket anlegen</h1>
        {d.liste.length === 0 ? (
          <p className="leise">
            Zuerst ein Objekt anlegen: <Link href="/objekte/neu">Objekt anlegen</Link>
          </p>
        ) : (
          // Nach dem Redirect aus „Aus Datei anlegen“ bleibt dieselbe Route; der key baut das
          // Formular neu auf, sonst behält das Priorität-Feld seinen alten Wert.
          <Formular
            key={v?.dokumentId ?? v?.nachrichtId ?? 'leer'}
            aktion={ticketAnlegen}
            knopf="Ticket anlegen"
            testId="ticket-anlegen"
          >
            {v?.dateiname ? (
              <p className="leise" data-testid="ticket-aus-datei-hinweis">
                {v.vorschlagId
                  ? `Aus „${v.dateiname}“ ausgelesen; bitte prüfen und anpassen.`
                  : `„${v.dateiname}“ ist abgelegt; die Angaben konnten nicht ausgelesen werden.`}
                {v.hinweise.length ? ' Hinweise: ' + v.hinweise.join(' ') : ''}
              </p>
            ) : null}
            {v?.dokumentId ? <input type="hidden" name="dokumentId" value={v.dokumentId} /> : null}
            {v?.vorschlagId ? (
              <input type="hidden" name="vorschlagId" value={v.vorschlagId} />
            ) : null}
            {v?.nachrichtId ? (
              <input type="hidden" name="nachrichtId" value={v.nachrichtId} />
            ) : null}
            {v?.mietverhaeltnisId ? (
              <input type="hidden" name="mietverhaeltnisId" value={v.mietverhaeltnisId} />
            ) : null}
            <Auswahl
              label="Objekt / Einheit"
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
      {d.liste.length > 0 && !v?.dokumentId ? (
        <div className="karte">
          <h2>Aus Datei anlegen</h2>
          <p className="leise">
            Mängelmeldung oder Schreiben als PDF oder Foto hochladen.{' '}
            {kiEingerichtet()
              ? 'Die KI schlägt Titel, Beschreibung und Priorität vor; du prüfst und legst an.'
              : 'Die Datei wird am Ticket abgelegt; die Angaben trägst du selbst ein.'}
          </p>
          <Formular
            aktion={ticketAusDatei}
            knopf={kiEingerichtet() ? 'Hochladen und auslesen' : 'Hochladen'}
            testId="ticket-aus-datei"
          >
            <Auswahl
              label="Objekt / Einheit"
              name="ort"
              optionen={d.liste.map((o) => [o.wert, o.text] as const)}
              defaultValue={ort}
            />
            <label>
              Datei (PDF, JPG, PNG, WebP; bis 20 MB)
              <input type="file" name="datei" accept={DATEI_ACCEPT} required />
            </label>
          </Formular>
          {kiEingerichtet() ? <KiHinweis was="Die hochgeladene Meldung" /> : null}
        </div>
      ) : null}
    </>
  )
}
