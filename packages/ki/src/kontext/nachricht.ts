import { ladeNachricht, ladeZuordnungsKandidaten, schema, type Tx } from '@vermieteros/db'
import type { Fakten, PlatzhalterKatalog } from '../platzhalter'
import { Referenzen, type Kontext } from './kontext'

/** Inhalt, den das Modell zu einer eingegangenen Mail sieht. Keine Mailadressen, keine IDs. */
export type NachrichtDaten = {
  betreff: string
  text: string
  absender: string
  eingegangen: string
  anhaenge: string[]
  /** Wozu die Mail gehört, falls zugeordnet */
  zuordnung: { einheit: string; objekt: string } | null
}

/** Längere Mails werden gekürzt; Zitate alter Verläufe stehen meist am Ende. */
const MAX_TEXT = 12_000

const KATALOG_IMMER: PlatzhalterKatalog = {
  'absender.name': 'Name, mit dem die Mail unterschrieben bzw. versendet wurde',
  'vermieter.name': 'Name der Eigentümerschaft (Vermieterseite)',
}
const KATALOG_ZUGEORDNET: PlatzhalterKatalog = {
  'mieter.name': 'Name der Mieterin oder des Mieters laut Mietverhältnis',
  'einheit.bezeichnung': 'Bezeichnung der Wohnung oder Einheit',
  'objekt.bezeichnung': 'Bezeichnung des Objekts',
  'objekt.adresse': 'Straße und Hausnummer des Objekts',
}

async function lade(tx: Tx, nachrichtId: string) {
  const n = await ladeNachricht(tx, nachrichtId)
  if (!n) throw new Error(`Nachricht ${nachrichtId} nicht gefunden`)
  const mvId = n.zuordnungen.at(-1)?.mietverhaeltnisId ?? null
  const mv = mvId
    ? (await ladeZuordnungsKandidaten(tx)).find((k) => k.mietverhaeltnisId === mvId)
    : undefined
  return { n, mv }
}

/** Kontext für Sortierung und Antwortvorschlag zu einer Mail (WP 1.5). */
export async function fuerNachricht(tx: Tx, nachrichtId: string): Promise<Kontext<NachrichtDaten>> {
  const { n, mv } = await lade(tx, nachrichtId)
  const refs = new Referenzen().merke('nachricht', n.id)
  if (mv) {
    refs
      .merke('mietverhaeltnis', mv.mietverhaeltnisId)
      .merke('einheit', mv.einheitId)
      .merke('objekt', mv.objektId)
  }
  return {
    bezug: { entitaet: 'nachricht', id: n.id },
    daten: {
      betreff: n.betreff,
      text: n.text.length > MAX_TEXT ? `${n.text.slice(0, MAX_TEXT)}\n[… gekürzt]` : n.text,
      absender: n.vonName || 'unbekannt',
      eingegangen: n.gesendetAm ?? n.empfangenAm,
      anhaenge: n.anhaenge.map((a) => a.dateiname),
      zuordnung: mv ? { einheit: mv.einheit, objekt: mv.objekt } : null,
    },
    platzhalter: mv ? { ...KATALOG_IMMER, ...KATALOG_ZUGEORDNET } : KATALOG_IMMER,
    referenzen: refs.liste(),
    dokumentIds: [],
  }
}

/** Werte zu den Platzhaltern von `fuerNachricht`, gelesen zum Zeitpunkt des Renderns. */
export async function nachrichtFakten(tx: Tx, nachrichtId: string): Promise<Fakten> {
  const { n, mv } = await lade(tx, nachrichtId)
  const [m] = await tx.select({ name: schema.mandanten.name }).from(schema.mandanten)
  const fakten: Fakten = {
    'absender.name': n.vonName || n.vonAdresse,
    'vermieter.name': m?.name ?? null,
  }
  if (mv) {
    fakten['mieter.name'] = mv.mieterNamen.join(', ') || null
    fakten['einheit.bezeichnung'] = mv.einheit
    fakten['objekt.bezeichnung'] = mv.objekt
    fakten['objekt.adresse'] = [mv.strasse, mv.hausnummer].filter(Boolean).join(' ') || null
  }
  return fakten
}
