import type {
  DarlehenDaten,
  EinheitDaten,
  MietkonditionDaten,
  MietverhaeltnisDaten,
  ObjektDaten,
} from '@vermieteros/schema'

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
  entitaet: 'objekt' | 'einheit' | 'mietverhaeltnis' | 'mietkondition' | 'darlehen'
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

export type ObjektStand = {
  id: string
  objekt: ObjektDaten
  einheiten: EinheitStand[]
  darlehen: Array<{ id: string; daten: DarlehenDaten }>
}

export type Datenqualitaet = {
  befunde: Befund[]
  ampel: Record<Modul, Ampel>
  /** true, wenn kein Modul rot ist */
  vollstaendig: boolean
}

export function pruefeDatenqualitaet(o: ObjektStand, heute: string = heuteIso()): Datenqualitaet {
  const b: Befund[] = []
  const objekt = (schwere: Schwere, modul: Modul, code: string, text: string) =>
    b.push({ modul, schwere, code, text, entitaet: 'objekt', id: o.id })

  // --- Stammdaten -----------------------------------------------------------
  if (!o.objekt.strasse || !o.objekt.plz || !o.objekt.ort) {
    objekt('fehler', 'stammdaten', 'OBJ_ADRESSE', 'Adresse unvollständig (Straße, PLZ, Ort)')
  }
  if (o.einheiten.length === 0) {
    objekt('fehler', 'stammdaten', 'OBJ_KEINE_EINHEITEN', 'Objekt hat keine Einheit')
  }
  if (o.objekt.art === 'etw' && o.einheiten.length > 1) {
    objekt(
      'warnung',
      'stammdaten',
      'ETW_MEHRERE_EINHEITEN',
      'Eigentumswohnung mit mehr als einer Einheit, prüfen',
    )
  }

  // --- Nebenkosten ----------------------------------------------------------
  const mitMea = o.einheiten.filter(
    (e) => e.daten.miteigentumsanteilZaehler != null && e.daten.miteigentumsanteilNenner != null,
  )
  for (const e of o.einheiten) {
    if (!e.daten.wohnflaecheQm100 || e.daten.wohnflaecheQm100 <= 0) {
      b.push({
        modul: 'nebenkosten',
        schwere: 'fehler',
        code: 'EINHEIT_WOHNFLAECHE',
        text: `Wohnfläche fehlt (${e.daten.bezeichnung})`,
        entitaet: 'einheit',
        id: e.id,
      })
    }
    for (const mv of e.mietverhaeltnisse) {
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
      } else if (laufend && mv.kondition.personenzahl === 0) {
        b.push({
          modul: 'nebenkosten',
          schwere: 'warnung',
          code: 'KONDITION_PERSONENZAHL',
          text: `Personenzahl 0 bei laufendem Mietverhältnis (${e.daten.bezeichnung})`,
          entitaet: 'mietkondition',
          id: mv.id,
        })
      }
      if (mv.kondition && mv.kondition.gueltigAb > mv.daten.beginn && laufend) {
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
  }
  if (mitMea.length > 0 && mitMea.length < o.einheiten.length) {
    objekt(
      'fehler',
      'nebenkosten',
      'MEA_UNVOLLSTAENDIG',
      'Miteigentumsanteile nur bei einem Teil der Einheiten hinterlegt',
    )
  } else if (mitMea.length > 1) {
    const summe = summeBrueche(
      mitMea.map((e) => [e.daten.miteigentumsanteilZaehler!, e.daten.miteigentumsanteilNenner!]),
    )
    if (summe.zaehler !== summe.nenner) {
      objekt(
        'fehler',
        'nebenkosten',
        'MEA_SUMME',
        `Summe der Miteigentumsanteile ist ${summe.zaehler}/${summe.nenner}, nicht 1`,
      )
    }
  }

  // --- Steuerpaket ----------------------------------------------------------
  if (!o.objekt.anschaffungsdatum || o.objekt.kaufpreisCent == null) {
    objekt('fehler', 'steuerpaket', 'OBJ_ANSCHAFFUNG', 'Anschaffungsdatum oder Kaufpreis fehlt')
  }
  if (o.objekt.gebaeudeanteilPromille == null) {
    objekt(
      'fehler',
      'steuerpaket',
      'OBJ_GEBAEUDEANTEIL',
      'Gebäudeanteil am Kaufpreis fehlt (AfA-Bemessung)',
    )
  } else if (o.objekt.gebaeudeanteilPromille < 500) {
    objekt(
      'warnung',
      'steuerpaket',
      'OBJ_GEBAEUDEANTEIL_NIEDRIG',
      'Gebäudeanteil unter 50 %, Kaufpreisaufteilung prüfen',
    )
  }
  if (o.objekt.afaSatzPromille == null || !o.objekt.afaBeginn) {
    objekt('fehler', 'steuerpaket', 'OBJ_AFA', 'AfA-Satz oder AfA-Beginn fehlt')
  } else if (o.objekt.anschaffungsdatum && o.objekt.afaBeginn < o.objekt.anschaffungsdatum) {
    objekt(
      'fehler',
      'steuerpaket',
      'OBJ_AFA_VOR_ANSCHAFFUNG',
      'AfA-Beginn liegt vor dem Anschaffungsdatum',
    )
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

function heuteIso(): string {
  return new Date().toISOString().slice(0, 10)
}
