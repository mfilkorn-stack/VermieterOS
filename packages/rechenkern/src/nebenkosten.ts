import type { BetrkvKostenart } from '@vermieteros/schema'
import { anteil, cent, rundeKaufmaennisch, summe, type Cent } from './geld'

/**
 * Betriebskostenabrechnung einer Einheit (WP 2.1), reine Rechnung ohne Datenbank.
 *
 * Regeln (festgelegt mit den Vermietern, Sollwert: Abrechnung 2022 eines Musterobjekts):
 * - Zeitanteil nach Monaten. Ein angebrochener Monat zählt mit seinem Tagesanteil, ein Mietbeginn
 *   zum Monatsersten ergibt also volle Monate.
 * - Jede Zeile wird genau einmal kaufmännisch gerundet; die Summe ist die Summe der Zeilen.
 * - Leerstand trägt der Vermieter: je Kostenart der Jahresanteil der Einheit abzüglich der
 *   Mieteranteile, so geht die Rechnung auf den Cent auf.
 * - Vorauszahlungen gehören zum selben Zeitraum wie die Kosten (`vorauszahlungSoll`).
 */

export type Zeitraum = { von: string; bis: string }

/** Wie die Gesamtkosten einer Kostenart auf die Einheit kommen. */
export type Verteilerschluessel =
  /** Wohnfläche der Einheit / Wohnfläche gesamt (Hundertstel-m², § 556a Abs. 1 BGB) */
  | { art: 'wohnflaeche'; gesamtQm100: number }
  /** gleiche Teile je Einheit */
  | { art: 'einheiten'; anzahl: number }
  /** Miteigentumsanteile, nur wenn im Mietvertrag vereinbart */
  | { art: 'mea'; gesamt: number }
  /** Personenmonate des Mieters / Personenmonate im Haus im Abrechnungszeitraum */
  | { art: 'personen'; gesamtPersonenmonate: number }
  /** Betrag gilt schon für die Einheit (Grundsteuerbescheid, Abrechnung des Messdienstes) */
  | { art: 'direkt'; einheitCent: Cent }
  /**
   * Betrag je Nutzung schon bekannt (Zwischenablesung des Messdienstes bei Nutzerwechsel);
   * was `jeNutzung` nicht abdeckt, ist Leerstand.
   */
  | { art: 'nutzer'; einheitCent: Cent; jeNutzung: Readonly<Record<string, Cent>> }

export type Kostenposition = {
  kostenart: BetrkvKostenart
  bezeichnung: string
  /** Gesamtkosten der Abrechnungseinheit (Haus oder WEG); bei `direkt` nur zur Anzeige */
  gesamtCent: Cent
  schluessel: Verteilerschluessel
}

export type Einheit = { wohnflaecheQm100: number; mea?: number }

export type Nutzung = {
  id: string
  zeitraum: Zeitraum
  /** Personen im Haushalt, für den Schlüssel `personen` */
  personen: number
  /** angerechnete Vorauszahlungen für Betriebs- und Heizkosten im Zeitraum */
  vorauszahlungenCent: Cent
}

export type Zeile = {
  kostenart: BetrkvKostenart
  bezeichnung: string
  schluessel: Verteilerschluessel['art']
  gesamtCent: Cent
  anteilCent: Cent
}

export type Hinweis = {
  code:
    | 'heizkosten_zeitanteilig'
    | 'kabel_nebenkostenprivileg'
    | 'ohne_kosten'
    | 'co2_fehlt'
    | 'co2_abweichung'
  text: string
}

export type Einzelabrechnung = {
  id: string
  zeitraum: Zeitraum
  monate: number
  zeilen: Zeile[]
  kostenCent: Cent
  vorauszahlungenCent: Cent
  /** positiv: Nachzahlung des Mieters, negativ: Guthaben */
  saldoCent: Cent
  /** Lohnanteil haushaltsnaher Dienstleistungen (§ 35a EStG) für die Steuererklärung des Mieters */
  lohnanteil35aCent: Cent
  hinweise: Hinweis[]
}

export type Abrechnung = {
  zeitraum: Zeitraum
  /** Anteil der Einheit am ganzen Zeitraum je Kostenart */
  jahresanteil: Zeile[]
  mieter: Einzelabrechnung[]
  /** trägt der Vermieter (Leerstand); Summe aus Jahresanteil minus Mieteranteile */
  leerstand: Zeile[]
  leerstandCent: Cent
}

const HEIZKOSTEN: ReadonlySet<BetrkvKostenart> = new Set([
  'heizung',
  'warmwasser',
  'verbundene_anlagen',
])

/** Letzter Tag, bis zu dem Kabel-TV-Gebühren umlagefähig waren (TKG-Novelle 2021, Übergangsfrist) */
const KABEL_STICHTAG = '2024-06-30'

function teile(iso: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) throw new RangeError(`kein ISO-Datum: ${iso}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

const tageImMonat = (j: number, m: number) => new Date(Date.UTC(j, m, 0)).getUTCDate()

/**
 * Monate im Zeitraum [von, bis], beide inklusive. Volle Kalendermonate zählen 1, angebrochene
 * mit ihrem Tagesanteil: 01.02.–31.12. = 11, 16.01.–31.01. = 16/31.
 */
export function monate(z: Zeitraum): number {
  if (z.bis < z.von) throw new RangeError(`bis (${z.bis}) liegt vor von (${z.von})`)
  const [vj, vm, vt] = teile(z.von)
  const [bj, bm, bt] = teile(z.bis)
  let summeMonate = 0
  for (let j = vj, m = vm; j < bj || (j === bj && m <= bm); m === 12 ? (j++, (m = 1)) : m++) {
    const n = tageImMonat(j, m)
    const erster = j === vj && m === vm ? vt : 1
    const letzter = j === bj && m === bm ? bt : n
    summeMonate += (letzter - erster + 1) / n
  }
  return summeMonate
}

/**
 * Soll-Vorauszahlungen im Zeitraum aus den Monatsbeträgen (Betriebs- plus Heizkosten),
 * je Monat mit seinem Anteil. `stufen` sortiert nach `ab`, jede gilt bis zur nächsten.
 */
export function vorauszahlungSoll(
  stufen: ReadonlyArray<{ ab: string; monatCent: Cent }>,
  z: Zeitraum,
): Cent {
  let gesamt = 0
  stufen.forEach((s, i) => {
    const naechste = stufen[i + 1]?.ab
    const von = s.ab > z.von ? s.ab : z.von
    const bisStufe = naechste ? vorTag(naechste) : z.bis
    const bis = bisStufe < z.bis ? bisStufe : z.bis
    if (bis >= von) gesamt += s.monatCent * monate({ von, bis })
  })
  return cent(rundeKaufmaennisch(gesamt))
}

function vorTag(iso: string): string {
  const [j, m, t] = teile(iso)
  return new Date(Date.UTC(j, m - 1, t - 1)).toISOString().slice(0, 10)
}

/** Anteil der Einheit an einer Kostenart als Faktor (ohne Zeit); `personen` hat keinen. */
function einheitsfaktor(p: Kostenposition, e: Einheit): number {
  const s = p.schluessel
  switch (s.art) {
    case 'wohnflaeche':
      if (s.gesamtQm100 <= 0 || e.wohnflaecheQm100 > s.gesamtQm100)
        throw new RangeError(`${p.bezeichnung}: Wohnfläche passt nicht zur Gesamtfläche`)
      return e.wohnflaecheQm100 / s.gesamtQm100
    case 'einheiten':
      if (!Number.isInteger(s.anzahl) || s.anzahl < 1)
        throw new RangeError(`${p.bezeichnung}: Anzahl Einheiten fehlt`)
      return 1 / s.anzahl
    case 'mea':
      if (e.mea == null || s.gesamt <= 0 || e.mea > s.gesamt)
        throw new RangeError(`${p.bezeichnung}: Miteigentumsanteil fehlt`)
      return e.mea / s.gesamt
    case 'direkt':
    case 'nutzer':
    case 'personen':
      throw new Error('kein Flächen- oder Einheitenfaktor')
  }
}

function jahresanteil(p: Kostenposition, e: Einheit): Cent | null {
  if (p.schluessel.art === 'direkt' || p.schluessel.art === 'nutzer')
    return p.schluessel.einheitCent
  if (p.schluessel.art === 'personen') return null
  return anteil(p.gesamtCent, einheitsfaktor(p, e))
}

function mieteranteil(
  p: Kostenposition,
  e: Einheit,
  n: Nutzung,
  zeitAnteil: number,
  monateN: number,
): Cent {
  const s = p.schluessel
  if (s.art === 'direkt') return anteil(s.einheitCent, zeitAnteil)
  if (s.art === 'nutzer') {
    const b = s.jeNutzung[n.id]
    if (b == null) throw new RangeError(`${p.bezeichnung}: kein Betrag für Nutzung ${n.id}`)
    return b
  }
  if (s.art === 'personen') {
    if (s.gesamtPersonenmonate <= 0)
      throw new RangeError(`${p.bezeichnung}: Personenmonate im Haus fehlen`)
    return anteil(p.gesamtCent, (n.personen * monateN) / s.gesamtPersonenmonate)
  }
  return anteil(p.gesamtCent, einheitsfaktor(p, e) * zeitAnteil)
}

function pruefeNutzungen(z: Zeitraum, nutzungen: readonly Nutzung[]): Nutzung[] {
  const sortiert = [...nutzungen].sort((a, b) => a.zeitraum.von.localeCompare(b.zeitraum.von))
  sortiert.forEach((n, i) => {
    if (n.zeitraum.von < z.von || n.zeitraum.bis > z.bis)
      throw new RangeError(`Nutzung ${n.id} liegt außerhalb des Abrechnungszeitraums`)
    if (n.zeitraum.bis < n.zeitraum.von) throw new RangeError(`Nutzung ${n.id}: bis vor von`)
    const vorher = sortiert[i - 1]
    if (vorher && n.zeitraum.von <= vorher.zeitraum.bis)
      throw new RangeError(`Nutzungen ${vorher.id} und ${n.id} überschneiden sich`)
  })
  return sortiert
}

/**
 * Rechnet die Betriebskosten einer Einheit für einen Abrechnungszeitraum (höchstens zwölf
 * Monate, § 556 Abs. 3 BGB) auf ihre Mietverhältnisse und den Leerstand um.
 */
export function betriebskostenabrechnung(eingabe: {
  zeitraum: Zeitraum
  einheit: Einheit
  positionen: readonly Kostenposition[]
  nutzungen: readonly Nutzung[]
  /** Lohnanteil § 35a EStG der Einheit im Zeitraum, z. B. laut Messdienst */
  lohnanteil35aCent?: Cent
}): Abrechnung {
  const { zeitraum, einheit, positionen } = eingabe
  const gesamtMonate = monate(zeitraum)
  if (gesamtMonate > 12 + 1e-9) throw new RangeError('Abrechnungszeitraum länger als zwölf Monate')
  const nutzungen = pruefeNutzungen(zeitraum, eingabe.nutzungen)

  const zeile = (p: Kostenposition, anteilCent: Cent): Zeile => ({
    kostenart: p.kostenart,
    bezeichnung: p.bezeichnung,
    schluessel: p.schluessel.art,
    gesamtCent: p.gesamtCent,
    anteilCent,
  })

  const jahr = positionen.map((p) => ({ p, betrag: jahresanteil(p, einheit) }))

  const mieter = nutzungen.map((n): Einzelabrechnung => {
    const m = monate(n.zeitraum)
    const zeitAnteil = m / gesamtMonate
    const zeilen = positionen.map((p) => zeile(p, mieteranteil(p, einheit, n, zeitAnteil, m)))
    const kostenCent = summe(zeilen.map((z) => z.anteilCent))
    const hinweise: Hinweis[] = []
    const heizNachZeit = positionen.some(
      (p) => HEIZKOSTEN.has(p.kostenart) && p.schluessel.art !== 'nutzer',
    )
    if (zeitAnteil < 1 && heizNachZeit) {
      hinweise.push({
        code: 'heizkosten_zeitanteilig',
        text: 'Heizkosten bei Nutzerwechsel: Zwischenablesung oder Aufteilung nach Gradtagzahlen (§ 9b HeizKV), nicht nur nach Monaten.',
      })
    }
    if (
      n.zeitraum.bis > KABEL_STICHTAG &&
      positionen.some((p) => p.kostenart === 'antenne_kabel' && p.gesamtCent > 0)
    ) {
      hinweise.push({
        code: 'kabel_nebenkostenprivileg',
        text: 'Kabel-TV-Anschluss ist seit 01.07.2024 nicht mehr umlagefähig (Ende des Nebenkostenprivilegs); umlegen nur noch Betriebskosten einer Gemeinschaftsantenne oder Kosten bis 30.06.2024.',
      })
    }
    if (positionen.length === 0)
      hinweise.push({ code: 'ohne_kosten', text: 'Keine Kostenpositionen erfasst.' })
    return {
      id: n.id,
      zeitraum: n.zeitraum,
      monate: m,
      zeilen,
      kostenCent,
      vorauszahlungenCent: n.vorauszahlungenCent,
      saldoCent: cent(kostenCent - n.vorauszahlungenCent),
      lohnanteil35aCent: eingabe.lohnanteil35aCent
        ? anteil(eingabe.lohnanteil35aCent, zeitAnteil)
        : cent(0),
      hinweise,
    }
  })

  // Leerstand: Jahresanteil minus Mieteranteile; Personenschlüssel kennt keinen Leerstand.
  const leerstand = jahr.map(({ p, betrag }, i) =>
    zeile(
      p,
      betrag == null ? cent(0) : cent(betrag - summe(mieter.map((x) => x.zeilen[i]!.anteilCent))),
    ),
  )

  return {
    zeitraum,
    jahresanteil: jahr.map(({ p, betrag }) => zeile(p, betrag ?? cent(0))),
    mieter,
    leerstand,
    leerstandCent: summe(leerstand.map((z) => z.anteilCent)),
  }
}
