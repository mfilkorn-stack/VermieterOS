import type {
  Bruch,
  DarlehenDaten,
  EigentuemerschaftArt,
  EinheitDaten,
  MietkonditionDaten,
  MietverhaeltnisDaten,
  ObjektDaten,
} from '@vermieteros/schema'
import { BUNDESLAND_NAME } from '@vermieteros/schema'
import { afaSatzVorschlag } from './anschaffung'
import { cent } from './geld'
import { grunderwerbsteuer, type ReferenzStatus } from './referenz'

/**
 * Datenqualitäts-Check pro Objekt (Architekturplan Modul 01, PLAN.md 3.5).
 * Reine Funktion: bekommt den aktuellen Stand, liefert Befunde und eine Ampel pro Modul.
 * Rot heißt: das Modul ist für dieses Objekt gesperrt, bis die Pflichtfelder da sind.
 */

export const MODULE = [
  'stammdaten',
  'nebenkosten',
  'steuerpaket',
  'mieterhoehung',
  'finanzen',
] as const
export type Modul = (typeof MODULE)[number]

export type Schwere = 'fehler' | 'warnung'
export type Ampel = 'gruen' | 'gelb' | 'rot'

export type Befund = {
  modul: Modul
  schwere: Schwere
  code: string
  text: string
  /** Betroffene Entität und ID, für den Sprung ins Formular */
  entitaet: 'mandant' | 'objekt' | 'einheit' | 'mietverhaeltnis' | 'mietkondition' | 'darlehen'
  id: string
}

export type MietverhaeltnisStand = {
  id: string
  daten: MietverhaeltnisDaten
  kondition: (MietkonditionDaten & { gueltigAb: string }) | null
}

export type EinheitStand = {
  id: string
  daten: EinheitDaten
  mietverhaeltnisse: MietverhaeltnisStand[]
}

export type EigentumStand = {
  mandantId: string
  art: EigentuemerschaftArt
  /** Aktuelle Eigentumsanteile der Personen des Mandanten */
  anteile: Bruch[]
}

export type ObjektStand = {
  id: string
  objekt: ObjektDaten
  einheiten: EinheitStand[]
  darlehen: Array<{ id: string; daten: DarlehenDaten }>
  /** Eigentümerschaft des Mandanten; ohne Angabe wird nicht geprüft. */
  eigentum?: EigentumStand
  /** Aufgelöste Referenzdaten zum Objekt; ohne Angabe wird nicht geprüft. */
  referenz?: ReferenzStand
}

export type ReferenzStand = {
  /** Grunderwerbsteuer für Bundesland und Datum des Kaufvertrags */
  grunderwerbsteuer?: { status: ReferenzStatus; satzPromille: number | null; quelle: string | null }
}

export type Datenqualitaet = {
  befunde: Befund[]
  ampel: Record<Modul, Ampel>
  /** true, wenn kein Modul rot ist */
  vollstaendig: boolean
}

/** Einheiten, für die eine Wohn- oder Nutzfläche Pflicht ist (Verteilerschlüssel Fläche). */
const MIT_FLAECHE = new Set(['wohnung', 'gewerbe'])

export function pruefeDatenqualitaet(o: ObjektStand, heute: string = heuteIso()): Datenqualitaet {
  const b: Befund[] = []
  const objekt = (schwere: Schwere, modul: Modul, code: string, text: string) =>
    b.push({ modul, schwere, code, text, entitaet: 'objekt', id: o.id })
  const ob = o.objekt

  // --- Stammdaten -----------------------------------------------------------
  if (!ob.strasse || !ob.plz || !ob.ort) {
    objekt('fehler', 'stammdaten', 'OBJ_ADRESSE', 'Adresse unvollständig (Straße, PLZ, Ort)')
  }
  if (o.einheiten.length === 0) {
    objekt('fehler', 'stammdaten', 'OBJ_KEINE_EINHEITEN', 'Objekt hat keine Einheit')
  }
  if (ob.art === 'etw' && o.einheiten.filter((e) => e.daten.typ === 'wohnung').length > 1) {
    objekt(
      'warnung',
      'stammdaten',
      'ETW_MEHRERE_WOHNUNGEN',
      'Eigentumswohnung mit mehr als einer Wohnung, prüfen',
    )
  }
  if (!ob.grundbuch || ob.grundbuch.length === 0) {
    objekt(
      'warnung',
      'stammdaten',
      'OBJ_GRUNDBUCH',
      'Grundbuchdaten fehlen (Blatt, Flurstücke, Flächen)',
    )
  } else if (
    ob.art === 'etw' &&
    !ob.grundbuch.some((g) => g.art === 'wohnungsgrundbuch' && g.miteigentumsanteil)
  ) {
    objekt(
      'warnung',
      'stammdaten',
      'ETW_OHNE_WOHNUNGSGRUNDBUCH',
      'Eigentumswohnung ohne Wohnungsgrundbuch mit Miteigentumsanteil',
    )
  }
  if (!ob.bundesland) {
    objekt(
      'warnung',
      'stammdaten',
      'OBJ_BUNDESLAND',
      'Bundesland fehlt (Grunderwerbsteuer, Mietrecht)',
    )
  }
  if (o.eigentum) pruefeEigentum(o.eigentum, b)

  // --- Nebenkosten ----------------------------------------------------------
  for (const e of o.einheiten) {
    const typ = e.daten.typ ?? 'wohnung'
    if (MIT_FLAECHE.has(typ) && (!e.daten.wohnflaecheQm100 || e.daten.wohnflaecheQm100 <= 0)) {
      b.push({
        modul: 'nebenkosten',
        schwere: 'fehler',
        code: 'EINHEIT_WOHNFLAECHE',
        text: `${typ === 'gewerbe' ? 'Nutzfläche' : 'Wohnfläche'} fehlt (${e.daten.bezeichnung})`,
        entitaet: 'einheit',
        id: e.id,
      })
    }
    if (ob.art === 'etw' && typ === 'wohnung' && e.daten.miteigentumsanteilZaehler == null) {
      b.push({
        modul: 'nebenkosten',
        schwere: 'warnung',
        code: 'ETW_MEA',
        text: `Miteigentumsanteil fehlt (${e.daten.bezeichnung}), nötig zum Prüfen der Hausgeldabrechnung`,
        entitaet: 'einheit',
        id: e.id,
      })
    }
    for (const mv of e.mietverhaeltnisse) pruefeMietverhaeltnis(e, mv, heute, b)
  }
  // Beim eigenen Haus müssen sich die Anteile der Einheiten zu 1 summieren. Bei einer ETW
  // bezieht sich der MEA auf die ganze Wohnanlage, eine Summe ergibt dort keinen Sinn.
  if (ob.art === 'haus') {
    const mitMea = o.einheiten.filter(
      (e) => e.daten.miteigentumsanteilZaehler != null && e.daten.miteigentumsanteilNenner != null,
    )
    if (mitMea.length > 0 && mitMea.length < o.einheiten.length) {
      objekt(
        'fehler',
        'nebenkosten',
        'MEA_UNVOLLSTAENDIG',
        'Miteigentumsanteile nur bei einem Teil der Einheiten hinterlegt',
      )
    } else if (mitMea.length > 1) {
      const s = summeBrueche(
        mitMea.map((e) => [e.daten.miteigentumsanteilZaehler!, e.daten.miteigentumsanteilNenner!]),
      )
      if (s.zaehler !== s.nenner) {
        objekt(
          'fehler',
          'nebenkosten',
          'MEA_SUMME',
          `Summe der Miteigentumsanteile ist ${s.zaehler}/${s.nenner}, nicht 1`,
        )
      }
    }
  }

  // --- Steuerpaket ----------------------------------------------------------
  if (!ob.anschaffungsdatum || ob.kaufpreisCent == null) {
    objekt(
      'fehler',
      'steuerpaket',
      'OBJ_ANSCHAFFUNG',
      'Übergang von Nutzen und Lasten oder Kaufpreis fehlt',
    )
  }
  if (!ob.kaufvertragDatum) {
    objekt(
      'warnung',
      'steuerpaket',
      'OBJ_KAUFVERTRAG',
      'Datum des Kaufvertrags fehlt (Spekulationsfrist)',
    )
  } else if (ob.anschaffungsdatum && ob.anschaffungsdatum < ob.kaufvertragDatum) {
    objekt(
      'fehler',
      'steuerpaket',
      'OBJ_UEBERGANG_VOR_VERTRAG',
      'Übergang von Nutzen und Lasten liegt vor dem Kaufvertrag',
    )
  }
  const nk = ob.anschaffungsnebenkosten ?? []
  if (nk.length === 0) {
    objekt(
      'warnung',
      'steuerpaket',
      'OBJ_NEBENKOSTEN',
      'Kauf-Nebenkosten fehlen (Grunderwerbsteuer, Notar, Grundbuch)',
    )
  } else if (!nk.some((n) => n.art === 'grunderwerbsteuer')) {
    objekt('warnung', 'steuerpaket', 'OBJ_GREST', 'Keine Grunderwerbsteuer erfasst, prüfen')
  }
  pruefeGrunderwerbsteuer(o, objekt)
  if (ob.gebaeudeanteilPromille == null) {
    objekt(
      'fehler',
      'steuerpaket',
      'OBJ_GEBAEUDEANTEIL',
      'Gebäudeanteil am Kaufpreis fehlt (AfA-Bemessung)',
    )
  } else if (ob.gebaeudeanteilPromille < 500) {
    objekt(
      'warnung',
      'steuerpaket',
      'OBJ_GEBAEUDEANTEIL_NIEDRIG',
      'Gebäudeanteil unter 50 %, Kaufpreisaufteilung prüfen',
    )
  }
  if (ob.afaSatzPromille == null || !ob.afaBeginn) {
    objekt('fehler', 'steuerpaket', 'OBJ_AFA', 'AfA-Satz oder AfA-Beginn fehlt')
  } else {
    if (ob.anschaffungsdatum && ob.afaBeginn < ob.anschaffungsdatum) {
      objekt(
        'fehler',
        'steuerpaket',
        'OBJ_AFA_VOR_ANSCHAFFUNG',
        'AfA-Beginn liegt vor dem Übergang von Nutzen und Lasten',
      )
    }
    if (ob.baujahr) {
      const v = afaSatzVorschlag(ob.baujahr)
      if (v.satzPromille !== ob.afaSatzPromille) {
        objekt(
          'warnung',
          'steuerpaket',
          'OBJ_AFA_SATZ',
          `AfA-Satz ${promilleText(ob.afaSatzPromille)} weicht vom gesetzlichen Satz ab (${v.grundlage})`,
        )
      }
    }
  }
  if (!ob.baujahr) {
    objekt('warnung', 'steuerpaket', 'OBJ_BAUJAHR', 'Baujahr fehlt (Prüfung des AfA-Satzes)')
  }

  // --- Finanzen -------------------------------------------------------------
  for (const d of o.darlehen) {
    const darlehen = (schwere: Schwere, code: string, text: string) =>
      b.push({ modul: 'finanzen', schwere, code, text, entitaet: 'darlehen', id: d.id })
    if (!d.daten.zinsbindungBis)
      darlehen('warnung', 'DARLEHEN_ZINSBINDUNG', `Zinsbindungsende fehlt (${d.daten.bank})`)
    if (d.daten.rateCent <= 0) darlehen('fehler', 'DARLEHEN_RATE', `Rate fehlt (${d.daten.bank})`)
    if (d.daten.restschuldCent == null || !d.daten.restschuldStand) {
      darlehen(
        'warnung',
        'DARLEHEN_RESTSCHULD',
        `Kein Restschuld-Stand hinterlegt (${d.daten.bank})`,
      )
    }
  }

  const ampel = Object.fromEntries(MODULE.map((m) => [m, ampelFuer(b, m)])) as Record<Modul, Ampel>
  return { befunde: b, ampel, vollstaendig: MODULE.every((m) => ampel[m] !== 'rot') }
}

function pruefeMietverhaeltnis(
  e: EinheitStand,
  mv: MietverhaeltnisStand,
  heute: string,
  b: Befund[],
): void {
  const laufend = !mv.daten.ende || mv.daten.ende >= heute
  if (!mv.kondition) {
    b.push({
      modul: 'nebenkosten',
      schwere: 'fehler',
      code: 'MV_OHNE_KONDITION',
      text: `Mietverhältnis ohne Mietkondition (${e.daten.bezeichnung}, ab ${mv.daten.beginn})`,
      entitaet: 'mietverhaeltnis',
      id: mv.id,
    })
    b.push({
      modul: 'mieterhoehung',
      schwere: 'fehler',
      code: 'MV_OHNE_MIETHISTORIE',
      text: `Keine Sollmiete hinterlegt (${e.daten.bezeichnung})`,
      entitaet: 'mietverhaeltnis',
      id: mv.id,
    })
    return
  }
  if (laufend && mv.kondition.personenzahl === 0) {
    b.push({
      modul: 'nebenkosten',
      schwere: 'warnung',
      code: 'KONDITION_PERSONENZAHL',
      text: `Personenzahl 0 bei laufendem Mietverhältnis (${e.daten.bezeichnung})`,
      entitaet: 'mietkondition',
      id: mv.id,
    })
  }
  if (mv.kondition.gueltigAb > mv.daten.beginn && laufend) {
    b.push({
      modul: 'mieterhoehung',
      schwere: 'warnung',
      code: 'MIETHISTORIE_LUECKE',
      text: `Erste Mietkondition gilt erst ab ${mv.kondition.gueltigAb}, Mietbeginn ${mv.daten.beginn}`,
      entitaet: 'mietkondition',
      id: mv.id,
    })
  }
}

function pruefeGrunderwerbsteuer(
  o: ObjektStand,
  objekt: (schwere: Schwere, modul: Modul, code: string, text: string) => void,
): void {
  const ref = o.referenz?.grunderwerbsteuer
  const ob = o.objekt
  if (!ref || !ob.bundesland || !(ob.kaufvertragDatum ?? ob.anschaffungsdatum)) return
  const datum = datumText(ob.kaufvertragDatum ?? ob.anschaffungsdatum!)
  const land = BUNDESLAND_NAME[ob.bundesland]
  if (ref.status === 'fehlt') {
    objekt(
      'warnung',
      'steuerpaket',
      'REF_GREST_FEHLT',
      `Kein Grunderwerbsteuersatz für ${land} am ${datum} hinterlegt`,
    )
    return
  }
  if (ref.status === 'abgelaufen') {
    objekt(
      'warnung',
      'steuerpaket',
      'REF_GREST_ABGELAUFEN',
      `Grunderwerbsteuersatz für ${land} am ${datum} ist ausgelaufen`,
    )
    return
  }
  if (ref.status === 'ungeprueft') {
    objekt(
      'warnung',
      'steuerpaket',
      'REF_GREST_UNGEPRUEFT',
      `Grunderwerbsteuersatz für ${land} ist nicht mehr geprüft (Referenzdaten aktualisieren)`,
    )
  }
  const positionen = (ob.anschaffungsnebenkosten ?? []).filter((n) => n.art === 'grunderwerbsteuer')
  if (ref.satzPromille == null || ob.kaufpreisCent == null || positionen.length === 0) return
  const erwartet = grunderwerbsteuer(cent(ob.kaufpreisCent), ref.satzPromille)
  const erfasst = positionen.reduce((s, n) => s + n.betragCent, 0)
  if (erfasst !== erwartet) {
    objekt(
      'warnung',
      'steuerpaket',
      'OBJ_GREST_ABWEICHUNG',
      `Grunderwerbsteuer ${euro(erfasst)} weicht von ${(ref.satzPromille / 10).toLocaleString('de-DE')} % des Kaufpreises (${euro(erwartet)}) ab; Bescheid prüfen, z. B. mitverkauftes Inventar`,
    )
  }
}

function datumText(iso: string): string {
  const [j, m, t] = iso.split('-')
  return `${t}.${m}.${j}`
}

function euro(c: number): string {
  return `${(c / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

function pruefeEigentum(e: EigentumStand, b: Befund[]): void {
  const mandant = (schwere: Schwere, modul: Modul, code: string, text: string) =>
    b.push({ modul, schwere, code, text, entitaet: 'mandant', id: e.mandantId })
  if (e.art === 'allein') {
    if (e.anteile.length > 1) {
      mandant(
        'warnung',
        'stammdaten',
        'EIGENTUM_ALLEIN_MEHRERE',
        'Alleineigentum, aber mehrere Eigentumsanteile erfasst',
      )
    }
    return
  }
  if (e.anteile.length < 2) {
    mandant(
      'fehler',
      'steuerpaket',
      'EIGENTUM_ANTEILE',
      'Miteigentum ohne vollständige Eigentumsanteile (Aufteilung der Einkünfte)',
    )
    return
  }
  const s = summeBrueche(e.anteile.map((a) => [a.zaehler, a.nenner]))
  if (s.zaehler !== s.nenner) {
    mandant(
      'fehler',
      'steuerpaket',
      'EIGENTUM_SUMME',
      `Eigentumsanteile summieren sich zu ${s.zaehler}/${s.nenner}, nicht 1`,
    )
  }
}

function ampelFuer(befunde: Befund[], modul: Modul): Ampel {
  const eigene = befunde.filter((x) => x.modul === modul)
  if (eigene.some((x) => x.schwere === 'fehler')) return 'rot'
  if (eigene.length > 0) return 'gelb'
  return 'gruen'
}

/** Summiert Brüche exakt (gemeinsamer Nenner, gekürzt). */
export function summeBrueche(brueche: Array<[number, number]>): {
  zaehler: number
  nenner: number
} {
  let z = 0
  let n = 1
  for (const [bz, bn] of brueche) {
    if (bn <= 0) throw new RangeError('Nenner muss positiv sein')
    z = z * bn + bz * n
    n = n * bn
    const g = ggt(z, n)
    z /= g
    n /= g
  }
  return { zaehler: z, nenner: n }
}

function ggt(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) [a, b] = [b, a % b]
  return a || 1
}

function promilleText(p: number): string {
  return `${(p / 10).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`
}

function heuteIso(): string {
  return new Date().toISOString().slice(0, 10)
}
