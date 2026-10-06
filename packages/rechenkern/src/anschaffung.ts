import type { GrundbuchEintrag, NebenkostenArt, NebenkostenPosition } from '@vermieteros/schema'
import { anteil, cent, summe, type Cent } from './geld'

/**
 * Anschaffungskosten, AfA und Fristen eines Objekts (Architekturplan Modul 07/08, Phase 0).
 * Reine Funktionen; die steuerliche Einordnung strittiger Fälle bleibt beim Berater.
 */

/** Nebenkostenarten, die zu den Anschaffungskosten zählen. Der Rest ist Finanzierung. */
const ANSCHAFFUNGSNAH: Record<NebenkostenArt, boolean> = {
  grunderwerbsteuer: true,
  notar_kaufvertrag: true,
  grundbuch_eigentum: true,
  makler: true,
  gutachten: true,
  sonstige_anschaffung: true,
  // Kosten der Grundschuld sind Finanzierungskosten: Werbungskosten im Jahr der Zahlung.
  notar_grundschuld: false,
  grundbuch_grundschuld: false,
  sonstige_finanzierung: false,
}

export function istAnschaffungskosten(art: NebenkostenArt): boolean {
  return ANSCHAFFUNGSNAH[art]
}

export type Anschaffungskosten = {
  kaufpreis: Cent
  nebenkostenAk: Cent
  /** Finanzierungskosten aus dem Kauf, sofort abziehbar, nicht Teil der AfA-Bemessung */
  finanzierungskosten: Cent
  gesamt: Cent
  /** Anteil Grund und Boden, nicht abschreibbar */
  grund: Cent
  /** AfA-Bemessungsgrundlage Gebäude */
  gebaeude: Cent
}

/**
 * Teilt Kaufpreis und anschaffungsnahe Nebenkosten im Verhältnis des Gebäudeanteils auf.
 * Der Gebäudeanteil kommt aus Kaufpreisaufteilung, Arbeitshilfe des BMF oder Gutachten.
 */
export function anschaffungskosten(
  kaufpreis: Cent,
  nebenkosten: readonly NebenkostenPosition[],
  gebaeudeanteilPromille: number,
): Anschaffungskosten {
  if (
    !Number.isInteger(gebaeudeanteilPromille) ||
    gebaeudeanteilPromille < 0 ||
    gebaeudeanteilPromille > 1000
  ) {
    throw new RangeError(`Gebäudeanteil muss 0 bis 1000 Promille sein: ${gebaeudeanteilPromille}`)
  }
  const nebenkostenAk = summe(
    nebenkosten.filter((n) => istAnschaffungskosten(n.art)).map((n) => cent(n.betragCent)),
  )
  const finanzierungskosten = summe(
    nebenkosten.filter((n) => !istAnschaffungskosten(n.art)).map((n) => cent(n.betragCent)),
  )
  const gesamt = cent(kaufpreis + nebenkostenAk)
  const gebaeude = anteil(gesamt, gebaeudeanteilPromille / 1000)
  return {
    kaufpreis,
    nebenkostenAk,
    finanzierungskosten,
    gesamt,
    gebaeude,
    grund: cent(gesamt - gebaeude),
  }
}

export type AfaVorschlag = { satzPromille: number; grundlage: string }

/**
 * Linearer AfA-Satz für Wohngebäude im Privatvermögen nach § 7 Abs. 4 Satz 1 Nr. 2 EStG,
 * abhängig vom Jahr der Fertigstellung. Kürzere tatsächliche Nutzungsdauer (§ 7 Abs. 4 Satz 2)
 * und Sonder-AfA sind Einzelfälle für den Berater.
 */
export function afaSatzVorschlag(fertigstellungsjahr: number): AfaVorschlag {
  if (
    !Number.isInteger(fertigstellungsjahr) ||
    fertigstellungsjahr < 1000 ||
    fertigstellungsjahr > 2200
  ) {
    throw new RangeError(`unplausibles Fertigstellungsjahr: ${fertigstellungsjahr}`)
  }
  if (fertigstellungsjahr < 1925) {
    return {
      satzPromille: 25,
      grundlage: '§ 7 Abs. 4 Satz 1 Nr. 2 Buchst. b EStG (fertiggestellt vor 1925): 2,5 %',
    }
  }
  if (fertigstellungsjahr < 2023) {
    return {
      satzPromille: 20,
      grundlage: '§ 7 Abs. 4 Satz 1 Nr. 2 Buchst. c EStG (fertiggestellt 1925 bis 2022): 2 %',
    }
  }
  return {
    satzPromille: 30,
    grundlage: '§ 7 Abs. 4 Satz 1 Nr. 2 Buchst. a EStG (fertiggestellt ab 2023): 3 %',
  }
}

/** Volle Jahres-AfA. */
export function afaJahresbetrag(gebaeude: Cent, satzPromille: number): Cent {
  return anteil(gebaeude, satzPromille / 1000)
}

/**
 * AfA eines Kalenderjahres. Im Jahr der Anschaffung zeitanteilig: der Monat der Anschaffung
 * zählt voll (§ 7 Abs. 1 Satz 4 EStG). Endet, wenn die Bemessungsgrundlage verbraucht ist.
 */
export function afaImJahr(
  gebaeude: Cent,
  satzPromille: number,
  afaBeginn: string,
  jahr: number,
): Cent {
  const [startJahr, startMonat] = isoJahrMonat(afaBeginn)
  if (jahr < startJahr) return cent(0)
  const voll = afaJahresbetrag(gebaeude, satzPromille)
  const ersteJahr = anteil(voll, (13 - startMonat) / 12)
  if (jahr === startJahr) return cent(Math.min(ersteJahr, gebaeude))
  const bisher = ersteJahr + voll * (jahr - startJahr - 1)
  const rest = gebaeude - bisher
  return cent(Math.max(0, Math.min(voll, rest)))
}

/**
 * Grundstücksfläche, die dem Objekt zuzurechnen ist, in Hundertstel-m².
 * Wohnungsgrundbuch: Miteigentumsanteil × Fläche aller Flurstücke; Alleineigentum: volle Fläche.
 */
export function anteiligeGrundstuecksflaeche(grundbuch: readonly GrundbuchEintrag[]): number {
  let summeQm100 = 0
  for (const g of grundbuch) {
    const flaeche = g.flurstuecke.reduce((a, f) => a + f.flaecheQm, 0) * 100
    summeQm100 += g.miteigentumsanteil
      ? Math.round((flaeche * g.miteigentumsanteil.zaehler) / g.miteigentumsanteil.nenner)
      : flaeche
  }
  return summeQm100
}

/** Fristende nach §§ 187 Abs. 1, 188 Abs. 2 BGB: Ablauf des Tages mit derselben Zahl. */
export type Fristen = {
  /** Ende der Spekulationsfrist (§ 23 Abs. 1 Nr. 1 EStG): zehn Jahre ab Kaufvertrag */
  spekulationsfristEnde: string | null
  /** Ende des Dreijahreszeitraums für anschaffungsnahe Herstellungskosten (§ 6 Abs. 1 Nr. 1a EStG) */
  anschaffungsnaheHkEnde: string | null
}

export function fristen(
  kaufvertragDatum: string | null | undefined,
  anschaffungsdatum: string | null | undefined,
): Fristen {
  return {
    spekulationsfristEnde: kaufvertragDatum ? plusJahre(kaufvertragDatum, 10) : null,
    anschaffungsnaheHkEnde: anschaffungsdatum ? plusJahre(anschaffungsdatum, 3) : null,
  }
}

/** 15 % der Gebäude-Anschaffungskosten, netto (§ 6 Abs. 1 Nr. 1a EStG). */
export function grenzeAnschaffungsnaheHk(gebaeude: Cent): Cent {
  return anteil(gebaeude, 0.15)
}

function isoJahrMonat(iso: string): [number, number] {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(iso)
  if (!m) throw new RangeError(`kein ISO-Datum: ${iso}`)
  return [Number(m[1]), Number(m[2])]
}

function plusJahre(iso: string, jahre: number): string {
  const [j, m, t] = iso.split('-').map(Number) as [number, number, number]
  // 29.02. → 28.02. im Zieljahr, falls kein Schaltjahr
  const d = new Date(Date.UTC(j + jahre, m - 1, t))
  if (d.getUTCMonth() !== m - 1) d.setUTCDate(0)
  return d.toISOString().slice(0, 10)
}
