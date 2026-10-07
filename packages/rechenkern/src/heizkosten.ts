import { anteil, cent, verteile, type Cent } from './geld'
import type { Hinweis, Kostenposition } from './nebenkosten'

/**
 * Heizkosten aus der Abrechnung des Messdienstes übernehmen (WP 2.2, ADR 0011).
 * Ablesung und Verteilung nach HeizKV macht der Messdienst; hier wird nur übernommen, der
 * CO2-Kostenanteil des Vermieters abgezogen (CO2KostAufG) und nachgerechnet, ob die Angaben
 * des Messdienstes zum Stufenmodell passen.
 */

/** Anlage zum CO2KostAufG, Wohngebäude: Vermieteranteil je kg CO2 pro m² Wohnfläche und Jahr */
const CO2_STUFEN: ReadonlyArray<{ unter: number; vermieterProzent: number }> = [
  { unter: 12, vermieterProzent: 0 },
  { unter: 17, vermieterProzent: 10 },
  { unter: 22, vermieterProzent: 20 },
  { unter: 27, vermieterProzent: 30 },
  { unter: 32, vermieterProzent: 40 },
  { unter: 37, vermieterProzent: 50 },
  { unter: 42, vermieterProzent: 60 },
  { unter: 47, vermieterProzent: 70 },
  { unter: 52, vermieterProzent: 80 },
  { unter: Infinity, vermieterProzent: 95 },
]

export function co2Vermieterprozent(kgProQmJahr: number): number {
  if (!Number.isFinite(kgProQmJahr) || kgProQmJahr < 0)
    throw new RangeError(`CO2-Ausstoß ungültig: ${kgProQmJahr}`)
  return CO2_STUFEN.find((s) => kgProQmJahr < s.unter)!.vermieterProzent
}

export type Messdienstabrechnung = {
  /** auf alle Nutzer verteilte Gesamtkosten (zur Anzeige) */
  gesamtCent: Cent
  /** Gesamtbetrag der Einheit laut Messdienst, einschließlich CO2-Anteil des Vermieters */
  einheitCent: Cent
  /**
   * Bei Zwischenablesung: Betrag je Nutzung (Mietverhältnis). Was fehlt, ist Leerstand.
   * Ohne Angabe wird nach Monaten geteilt (mit Hinweis auf § 9b HeizKV).
   */
  jeNutzung?: Readonly<Record<string, Cent>>
  /** Angaben zur CO2-Aufteilung; fehlen sie, gibt es einen Hinweis */
  co2?: {
    /** CO2-Kosten des ganzen Gebäudes */
    kostenCent: Cent
    kg: number
    /** Wohnfläche des Gebäudes laut Messdienst */
    flaecheQm100: number
    /** Tage im Abrechnungszeitraum; unter einem Jahr wird hochgerechnet */
    tage: number
    /** Heiz- und Warmwasserkosten der Einheit und des Gebäudes, ergeben den Kostenanteil */
    heizWwEinheitCent: Cent
    heizWwGesamtCent: Cent
    /** zur Kontrolle: Vermieteranteil laut Messdienst */
    vermieterLautMessdienstCent?: Cent
  }
  /** Lohnanteil § 35a EStG der Einheit laut Messdienst */
  lohnanteil35aCent?: Cent
}

export type Co2Aufteilung = {
  kgProQmJahr: number
  vermieterProzent: number
  /** Anteil der Einheit an den Heiz- und Warmwasserkosten */
  anteilEinheit: number
  einheitCent: Cent
  vermieterCent: Cent
  mieterCent: Cent
}

export type Messdienstuebernahme = {
  positionen: Kostenposition[]
  co2: Co2Aufteilung | null
  /** umlagefähig: Betrag laut Messdienst abzüglich CO2-Anteil des Vermieters */
  umlageCent: Cent
  lohnanteil35aCent: Cent
  hinweise: Hinweis[]
}

export function co2Aufteilung(c: NonNullable<Messdienstabrechnung['co2']>): Co2Aufteilung {
  if (c.flaecheQm100 <= 0 || c.tage <= 0 || c.heizWwGesamtCent <= 0)
    throw new RangeError('CO2-Angaben unvollständig (Fläche, Tage, Heizkosten gesamt)')
  const jahr = c.tage >= 365 ? 1 : 365 / c.tage
  const kgProQmJahr = (c.kg / (c.flaecheQm100 / 100)) * jahr
  const vermieterProzent = co2Vermieterprozent(kgProQmJahr)
  const anteilEinheit = c.heizWwEinheitCent / c.heizWwGesamtCent
  const einheitCent = anteil(c.kostenCent, anteilEinheit)
  const vermieterCent = anteil(c.kostenCent, (anteilEinheit * vermieterProzent) / 100)
  return {
    kgProQmJahr,
    vermieterProzent,
    anteilEinheit,
    einheitCent,
    vermieterCent,
    mieterCent: cent(einheitCent - vermieterCent),
  }
}

export function messdienstUebernehmen(m: Messdienstabrechnung): Messdienstuebernahme {
  const hinweise: Hinweis[] = []
  const co2 = m.co2 ? co2Aufteilung(m.co2) : null
  if (!co2) {
    hinweise.push({
      code: 'co2_fehlt',
      text: 'Bei Heizung mit Gas, Öl oder fossiler Fernwärme trägt der Vermieter einen Teil der CO2-Kosten (CO2KostAufG). Angaben aus der Messdienstabrechnung erfassen, sonst kann der Mieter seinen Heizkostenanteil um 3 % kürzen.',
    })
  } else if (
    m.co2?.vermieterLautMessdienstCent != null &&
    Math.abs(m.co2.vermieterLautMessdienstCent - co2.vermieterCent) > 1
  ) {
    hinweise.push({
      code: 'co2_abweichung',
      text: `CO2-Anteil des Vermieters laut Messdienst weicht ab: nachgerechnet ${co2.vermieterCent} Cent (Stufe ${co2.vermieterProzent} %).`,
    })
  }

  const abzug = co2 ? cent(-co2.vermieterCent) : cent(0)
  let haupt: Kostenposition['schluessel'] = { art: 'direkt', einheitCent: m.einheitCent }
  let co2Schluessel: Kostenposition['schluessel'] = { art: 'direkt', einheitCent: abzug }
  if (m.jeNutzung) {
    const ids = Object.keys(m.jeNutzung)
    const betraege = ids.map((id) => m.jeNutzung![id]!)
    const genutzt = betraege.reduce((a, b) => a + b, 0)
    if (genutzt > m.einheitCent)
      throw new RangeError('Beträge je Nutzung übersteigen den Betrag der Einheit')
    // CO2-Abzug im Verhältnis der Beträge; der Rest gehört zum Leerstand.
    const teile = verteile(abzug, [...betraege, m.einheitCent - genutzt])
    haupt = { art: 'nutzer', einheitCent: m.einheitCent, jeNutzung: m.jeNutzung }
    co2Schluessel = {
      art: 'nutzer',
      einheitCent: abzug,
      jeNutzung: Object.fromEntries(ids.map((id, i) => [id, teile[i]!])),
    }
  }

  const positionen: Kostenposition[] = [
    {
      kostenart: 'heizung',
      bezeichnung: 'Heiz- und Wasserkosten laut Messdienst',
      gesamtCent: m.gesamtCent,
      schluessel: haupt,
    },
  ]
  if (co2 && co2.vermieterCent !== 0) {
    positionen.push({
      kostenart: 'heizung',
      bezeichnung: `abzüglich CO2-Kostenanteil Vermieter (${co2.vermieterProzent} %, CO2KostAufG)`,
      gesamtCent: m.co2!.kostenCent,
      schluessel: co2Schluessel,
    })
  }
  return {
    positionen,
    co2,
    umlageCent: cent(m.einheitCent + abzug),
    lohnanteil35aCent: m.lohnanteil35aCent ?? cent(0),
    hinweise,
  }
}
