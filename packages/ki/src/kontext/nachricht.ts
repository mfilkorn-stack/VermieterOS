import {
  ladeNachricht,
  ladeNotfallkarte,
  ladeZuordnungsKandidaten,
  listeWissen,
  schema,
  type Tx,
} from '@vermieteros/db'
import type { NotfallArt } from '@vermieteros/schema'
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
  /** Wissensbasis des Objekts (Hausordnung, Anleitungen, häufige Fragen), gekürzt */
  wissen: Array<{ titel: string; kategorie: string; inhalt: string }>
}

/** Längere Mails werden gekürzt; Zitate alter Verläufe stehen meist am Ende. */
const MAX_TEXT = 12_000
/** Wissensbasis: je Artikel und insgesamt begrenzt, damit der Kontext bezahlbar bleibt. */
const MAX_ARTIKEL = 2_000
const MAX_WISSEN = 8_000

const NOTFALL_BESCHREIBUNG: Record<NotfallArt, string> = {
  heizung: 'Heizung',
  wasser: 'Wasser',
  strom: 'Strom',
  gas: 'Gas',
  schluessel: 'Schlüsseldienst',
  hausverwaltung: 'Hausverwaltung',
  sonstiges: 'sonstige Notfälle',
}

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
  const notfall = mv ? await ladeNotfallkarte(tx, mv.objektId) : null
  // Je Art nur die erste Zeile: ein Platzhalter, ein Kontakt.
  const notfallZeilen = new Map((notfall?.zeilen ?? []).toReversed().map((z) => [z.art, z]))
  return { n, mv, notfall, notfallZeilen }
}

function gekuerzt(t: string, max: number): string {
  return t.length > max ? `${t.slice(0, max)} [… gekürzt]` : t
}

/** Kontext für Sortierung und Antwortvorschlag zu einer Mail (WP 1.5). */
export async function fuerNachricht(tx: Tx, nachrichtId: string): Promise<Kontext<NachrichtDaten>> {
  const { n, mv, notfall, notfallZeilen } = await lade(tx, nachrichtId)
  const refs = new Referenzen().merke('nachricht', n.id)
  const wissen: NachrichtDaten['wissen'] = []
  const katalog: PlatzhalterKatalog = { ...KATALOG_IMMER }
  if (mv) {
    refs
      .merke('mietverhaeltnis', mv.mietverhaeltnisId)
      .merke('einheit', mv.einheitId)
      .merke('objekt', mv.objektId)
      .merke('notfallkarte', notfall?.id)
    Object.assign(katalog, KATALOG_ZUGEORDNET)
    for (const art of notfallZeilen.keys()) {
      katalog[`notfall.${art}.name`] = `Notfallkontakt ${NOTFALL_BESCHREIBUNG[art]}: Name`
      katalog[`notfall.${art}.telefon`] =
        `Notfallkontakt ${NOTFALL_BESCHREIBUNG[art]}: Telefonnummer`
    }
    let rest = MAX_WISSEN
    for (const w of await listeWissen(tx, mv.objektId)) {
      if (rest <= 0) break
      const inhalt = gekuerzt(w.inhalt, Math.min(MAX_ARTIKEL, rest))
      rest -= inhalt.length
      wissen.push({ titel: w.titel, kategorie: w.kategorie, inhalt })
      refs.merke('wissensartikel', w.id)
    }
  }
  return {
    bezug: { entitaet: 'nachricht', id: n.id },
    daten: {
      betreff: n.betreff,
      text: gekuerzt(n.text, MAX_TEXT),
      absender: n.vonName || 'unbekannt',
      eingegangen: n.gesendetAm ?? n.empfangenAm,
      anhaenge: n.anhaenge.map((a) => a.dateiname),
      zuordnung: mv ? { einheit: mv.einheit, objekt: mv.objekt } : null,
      wissen,
    },
    platzhalter: katalog,
    referenzen: refs.liste(),
    dokumentIds: [],
  }
}

/** Werte zu den Platzhaltern von `fuerNachricht`, gelesen zum Zeitpunkt des Renderns. */
export async function nachrichtFakten(tx: Tx, nachrichtId: string): Promise<Fakten> {
  const { n, mv, notfallZeilen } = await lade(tx, nachrichtId)
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
    for (const [art, z] of notfallZeilen) {
      fakten[`notfall.${art}.name`] = z.name
      fakten[`notfall.${art}.telefon`] = z.telefon
    }
  }
  return fakten
}
