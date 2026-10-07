import { afaImJahr, grenzeAnschaffungsnaheHk } from './anschaffung'
import { anteil, cent, summe, verteile, type Cent } from './geld'
import { vorauszahlungSoll } from './nebenkosten'

/**
 * Einkünfte aus Vermietung und Verpachtung je Objekt und Jahr (WP 2.6), Vorbereitung der
 * Anlage V für den Steuerberater, keine Steuerberechnung. Festlegungen (ADR 0013):
 * - Mieten und Vorauszahlungen gelten laut Mietkonditionen als bezahlt (Soll = Ist), Ausfälle
 *   werden als Korrektur erfasst; Mieteingänge im Journal zählen daneben nicht.
 * - Ausgaben nach Zahlungstag (§ 11 EStG), Erhaltungsaufwand sofort oder nach § 82b EStDV verteilt.
 * - Hausgeld nach BFH: gezahlt abzüglich Zuführung zur Erhaltungsrücklage, zuzüglich
 *   Entnahmen aus der Rücklage für Erhaltung.
 * - AfA linear aus Gebäude-Anschaffungskosten; nachträgliche Herstellungskosten erhöhen die
 *   Bemessungsgrundlage ab dem Jahr der Zahlung mit vollem Jahresbetrag (R 7.4 Abs. 9 EStR).
 */

export type SteuerJournalEintrag = {
  id: string
  belegnummer: string
  zahlungsdatum: string
  steuerkategorie: string
  verteilungJahre: number | null
  /** Anteil des Objekts, brutto */
  betragCent: number
  /** darin enthaltene Umsatzsteuer, anteilig (für die 15-%-Grenze netto) */
  umsatzsteuerCent: number
}

export type SteuerMietzeit = {
  mietverhaeltnisId: string
  von: string
  bis: string
  /** Monatsbeträge ab Datum: Kaltmiete und Vorauszahlungen */
  stufen: ReadonlyArray<{ ab: string; kaltCent: number; vorauszahlungCent: number }>
}

export type SteuerKorrekturen = {
  /** Mietausfall im Jahr (mindert Einnahmen) */
  mietausfallCent?: number
  hausgeld?: { gezahltCent: number; zufuehrungCent: number; entnahmeCent: number } | null
  /** Zinsen laut Zinsbescheinigung; ersetzt die Schuldzinsen aus dem Journal */
  schuldzinsenCent?: number | null
  weitere?: ReadonlyArray<{ bezeichnung: string; betragCent: number }>
}

export type SteuerEingabe = {
  jahr: number
  mietzeiten: readonly SteuerMietzeit[]
  /** BK-Abrechnungen, deren Saldo im Jahr zu- oder abfloss (+ Nachzahlung, − Guthaben) */
  bkSalden: ReadonlyArray<{ mietverhaeltnisId: string; jahr: number; saldoCent: number }>
  /** Journal des Objekts, alle Jahre bis einschließlich `jahr` */
  journal: readonly SteuerJournalEintrag[]
  afa: { gebaeudeCent: number; satzPromille: number; beginn: string } | null
  /** Für den 15-%-Wächter */
  anschaffungsdatum: string | null
  korrekturen: SteuerKorrekturen
  eigentuemer: ReadonlyArray<{ personId: string; name: string; zaehler: number; nenner: number }>
}

export type SteuerBefund = {
  schwere: 'fehler' | 'warnung' | 'hinweis'
  code:
    | 'anschaffungsnah_ueberschritten'
    | 'anschaffungsnah_nahe'
    | 'afa_fehlt'
    | 'journal_mieten_ignoriert'
    | 'anschaffungskosten_im_journal'
    | 'eigentuemer_fehlen'
  text: string
}

export type SteuerZeile = { bezeichnung: string; betragCent: Cent }

export type SteuerErgebnis = {
  jahr: number
  einnahmen: SteuerZeile[]
  einnahmenCent: Cent
  werbungskosten: SteuerZeile[]
  werbungskostenCent: Cent
  ueberschussCent: Cent
  /** verteilter Erhaltungsaufwand: Herkunft und Jahresanteil */
  verteilt: Array<{ belegnummer: string; jahrDerZahlung: number; jahre: number; anteilCent: Cent }>
  anschaffungsnah: {
    bisDatum: string
    grenzeCent: Cent
    nettoCent: Cent
  } | null
  aufteilung: Array<{
    personId: string
    name: string
    einnahmenCent: Cent
    werbungskostenCent: Cent
    ueberschussCent: Cent
  }>
  befunde: SteuerBefund[]
}

const jahrVon = (iso: string) => Number(iso.slice(0, 4))
const euro = (c: number) => (c / 100).toLocaleString('de-DE', { minimumFractionDigits: 2 })

function plusJahre(iso: string, n: number): string {
  return `${jahrVon(iso) + n}${iso.slice(4)}`
}

/** Sollmiete und Vorauszahlungen eines Mietverhältnisses im Jahr (Monate laut ADR 0011). */
export function sollImJahr(m: SteuerMietzeit, jahr: number): { kaltCent: Cent; umlagenCent: Cent } {
  const von = m.von > `${jahr}-01-01` ? m.von : `${jahr}-01-01`
  const bis = m.bis < `${jahr}-12-31` ? m.bis : `${jahr}-12-31`
  if (bis < von) return { kaltCent: cent(0), umlagenCent: cent(0) }
  const z = { von, bis }
  return {
    kaltCent: vorauszahlungSoll(
      m.stufen.map((s) => ({ ab: s.ab, monatCent: cent(s.kaltCent) })),
      z,
    ),
    umlagenCent: vorauszahlungSoll(
      m.stufen.map((s) => ({ ab: s.ab, monatCent: cent(s.vorauszahlungCent) })),
      z,
    ),
  }
}

export function anlageV(e: SteuerEingabe): SteuerErgebnis {
  const befunde: SteuerBefund[] = []
  const imJahr = e.journal.filter((j) => jahrVon(j.zahlungsdatum) === e.jahr)
  const summeKat = (k: string) =>
    cent(imJahr.filter((j) => j.steuerkategorie === k).reduce((s, j) => s + j.betragCent, 0))

  // Einnahmen
  let kalt = 0
  let umlagen = 0
  for (const m of e.mietzeiten) {
    const s = sollImJahr(m, e.jahr)
    kalt += s.kaltCent
    umlagen += s.umlagenCent
  }
  const bk = e.bkSalden.filter((b) => b.jahr === e.jahr).reduce((s, b) => s + b.saldoCent, 0)
  const ausfall = e.korrekturen.mietausfallCent ?? 0
  const einnahmen: SteuerZeile[] = [
    { bezeichnung: 'Mieteinnahmen (Kaltmiete laut Mietvertrag)', betragCent: cent(kalt) },
    {
      bezeichnung: 'Umlagen (Vorauszahlungen Betriebs- und Heizkosten)',
      betragCent: cent(umlagen),
    },
    {
      bezeichnung: 'Nachzahlungen und Erstattungen aus Betriebskostenabrechnungen',
      betragCent: cent(bk),
    },
    { bezeichnung: 'Sonstige Einnahmen', betragCent: summeKat('sonstige_einnahmen') },
    { bezeichnung: 'abzüglich Mietausfall', betragCent: cent(-ausfall) },
  ].filter((z) => z.betragCent !== 0 || z.bezeichnung.startsWith('Mieteinnahmen'))
  const journalMieten = imJahr.filter(
    (j) => j.steuerkategorie === 'mieteinnahmen' || j.steuerkategorie === 'umlagen',
  )
  if (journalMieten.length)
    befunde.push({
      schwere: 'hinweis',
      code: 'journal_mieten_ignoriert',
      text: `${journalMieten.length} Mieteingänge im Journal zählen nicht; es gilt die Sollmiete laut Mietvertrag. Ausfälle als Korrektur erfassen.`,
    })

  // AfA
  let afaCent = 0
  if (e.afa) {
    afaCent = afaImJahr(cent(e.afa.gebaeudeCent), e.afa.satzPromille, e.afa.beginn, e.jahr)
    const hk = e.journal.filter(
      (j) => j.steuerkategorie === 'herstellungskosten' && jahrVon(j.zahlungsdatum) <= e.jahr,
    )
    const hkSumme = hk.reduce((s, j) => s + j.betragCent, 0)
    if (hkSumme) afaCent += anteil(cent(hkSumme), e.afa.satzPromille / 1000)
  } else {
    befunde.push({
      schwere: 'warnung',
      code: 'afa_fehlt',
      text: 'Keine AfA: Kaufpreis, Gebäudeanteil, AfA-Satz und AfA-Beginn in den Stammdaten ergänzen.',
    })
  }
  if (imJahr.some((j) => j.steuerkategorie === 'anschaffungskosten'))
    befunde.push({
      schwere: 'hinweis',
      code: 'anschaffungskosten_im_journal',
      text: 'Im Journal stehen Anschaffungskosten; sie gehören in die Stammdaten (Kauf) und laufen über die AfA.',
    })

  // Verteilter Erhaltungsaufwand (§ 82b EStDV): gleiche Teile über n Jahre ab Zahlungsjahr
  const verteilt: SteuerErgebnis['verteilt'] = []
  for (const j of e.journal) {
    if (j.steuerkategorie !== 'erhaltungsaufwand' || !j.verteilungJahre) continue
    const start = jahrVon(j.zahlungsdatum)
    const idx = e.jahr - start
    if (idx < 0 || idx >= j.verteilungJahre) continue
    const teile = verteile(cent(j.betragCent), Array(j.verteilungJahre).fill(1))
    verteilt.push({
      belegnummer: j.belegnummer,
      jahrDerZahlung: start,
      jahre: j.verteilungJahre,
      anteilCent: teile[idx]!,
    })
  }
  const sofort = cent(
    imJahr
      .filter((j) => j.steuerkategorie === 'erhaltungsaufwand' && !j.verteilungJahre)
      .reduce((s, j) => s + j.betragCent, 0),
  )

  const hg = e.korrekturen.hausgeld
  const hausgeld = hg ? hg.gezahltCent - hg.zufuehrungCent + hg.entnahmeCent : 0
  const zinsen = e.korrekturen.schuldzinsenCent ?? summeKat('schuldzinsen')
  const werbungskosten: SteuerZeile[] = [
    { bezeichnung: 'Absetzung für Abnutzung (AfA)', betragCent: cent(afaCent) },
    { bezeichnung: 'Schuldzinsen', betragCent: cent(zinsen) },
    { bezeichnung: 'Geldbeschaffungskosten', betragCent: summeKat('geldbeschaffungskosten') },
    { bezeichnung: 'Erhaltungsaufwand, sofort abziehbar', betragCent: sofort },
    {
      bezeichnung: 'Erhaltungsaufwand, verteilt (§ 82b EStDV)',
      betragCent: summe(verteilt.map((v) => v.anteilCent)),
    },
    {
      bezeichnung: 'Hausgeld (ohne Zuführung zur Erhaltungsrücklage)',
      betragCent: cent(hausgeld),
    },
    {
      bezeichnung: 'Betriebskosten (Grundsteuer, Versicherung u. a.)',
      betragCent: summeKat('betriebskosten'),
    },
    { bezeichnung: 'Verwaltungskosten', betragCent: summeKat('verwaltungskosten') },
    { bezeichnung: 'Sonstige Werbungskosten', betragCent: summeKat('sonstige_werbungskosten') },
    ...(e.korrekturen.weitere ?? []).map((w) => ({
      bezeichnung: w.bezeichnung,
      betragCent: cent(w.betragCent),
    })),
  ].filter((z) => z.betragCent !== 0)

  // 15-%-Grenze für anschaffungsnahe Herstellungskosten (§ 6 Abs. 1 Nr. 1a EStG), netto
  let anschaffungsnah: SteuerErgebnis['anschaffungsnah'] = null
  if (e.anschaffungsdatum && e.afa) {
    const bisDatum = plusJahre(e.anschaffungsdatum, 3)
    if (`${e.jahr}-01-01` <= bisDatum) {
      const nettoCent = cent(
        e.journal
          .filter(
            (j) =>
              j.steuerkategorie === 'erhaltungsaufwand' &&
              j.zahlungsdatum >= e.anschaffungsdatum! &&
              j.zahlungsdatum <= bisDatum,
          )
          .reduce((s, j) => s + j.betragCent - j.umsatzsteuerCent, 0),
      )
      const grenzeCent = grenzeAnschaffungsnaheHk(cent(e.afa.gebaeudeCent))
      anschaffungsnah = { bisDatum, grenzeCent, nettoCent }
      if (nettoCent > grenzeCent)
        befunde.push({
          schwere: 'fehler',
          code: 'anschaffungsnah_ueberschritten',
          text: `Erhaltungsaufwand in den ersten drei Jahren (${euro(nettoCent)} € netto) übersteigt 15 % der Gebäude-Anschaffungskosten (${euro(grenzeCent)} €): Er ist als anschaffungsnahe Herstellungskosten über die AfA abzuschreiben. Mit dem Steuerberater klären.`,
        })
      else if (nettoCent > grenzeCent * 0.8)
        befunde.push({
          schwere: 'warnung',
          code: 'anschaffungsnah_nahe',
          text: `Erhaltungsaufwand seit Anschaffung: ${euro(nettoCent)} € von ${euro(grenzeCent)} € (15 %-Grenze bis ${bisDatum.split('-').reverse().join('.')}). Weitere Arbeiten möglichst nach diesem Datum.`,
        })
    }
  }

  const einnahmenCent = summe(einnahmen.map((z) => z.betragCent))
  const werbungskostenCent = summe(werbungskosten.map((z) => z.betragCent))
  const ueberschussCent = cent(einnahmenCent - werbungskostenCent)

  // Aufteilung nach Miteigentum
  const gewichte = e.eigentuemer.map((p) => p.zaehler / p.nenner)
  let aufteilung: SteuerErgebnis['aufteilung'] = []
  if (e.eigentuemer.length && gewichte.some((g) => g > 0)) {
    const ein = verteile(einnahmenCent, gewichte)
    const wk = verteile(werbungskostenCent, gewichte)
    aufteilung = e.eigentuemer.map((p, i) => ({
      personId: p.personId,
      name: p.name,
      einnahmenCent: ein[i]!,
      werbungskostenCent: wk[i]!,
      ueberschussCent: cent(ein[i]! - wk[i]!),
    }))
  } else {
    befunde.push({
      schwere: 'hinweis',
      code: 'eigentuemer_fehlen',
      text: 'Keine Eigentumsanteile erfasst; ohne sie gibt es keine Aufteilung auf die Eigentümer.',
    })
  }

  return {
    jahr: e.jahr,
    einnahmen,
    einnahmenCent,
    werbungskosten,
    werbungskostenCent,
    ueberschussCent,
    verteilt,
    anschaffungsnah,
    aufteilung,
    befunde,
  }
}
