import type { BkAbrechnungDaten, BkPosition } from '@vermieteros/schema'
import { cent, type Cent } from './geld'
import { messdienstUebernehmen, type Messdienstuebernahme } from './heizkosten'
import {
  betriebskostenabrechnung,
  vorauszahlungSoll,
  type Abrechnung,
  type Einheit,
  type Hinweis,
  type Kostenposition,
} from './nebenkosten'

/**
 * Eine gespeicherte Betriebskostenabrechnung (WP 2.4) rechnen und prüfen: Eingaben aus
 * `BkAbrechnungDaten`, Mietverhältnisse mit Vorauszahlungsstufen aus den Stammdaten.
 */

export type BkMietzeit = {
  mietverhaeltnisId: string
  von: string
  bis: string
  personen: number
  vorauszahlungen: ReadonlyArray<{ ab: string; monatCent: number }>
}

export type BkBefund = {
  schwere: 'fehler' | 'warnung' | 'hinweis'
  code:
    | 'frist_abgelaufen'
    | 'frist_naht'
    | 'grundsteuer_fehlt'
    | 'heizkosten_fehlen'
    | 'betrag_null'
    | 'abweichung_vorjahr'
    | 'fehlt_ggue_vorjahr'
    | 'gesamtflaeche_geaendert'
    | 'keine_mieter'
  text: string
}

export type BkErgebnis = {
  abrechnung: Abrechnung
  messdienst: Messdienstuebernahme | null
  /** Vorauszahlungen je Mietverhältnis: Soll aus den Konditionen, Ist wenn erfasst */
  vorauszahlungen: Record<string, { sollCent: Cent; angerechnetCent: Cent }>
  hinweise: Hinweis[]
  befunde: BkBefund[]
  fristBis: string
}

function positionen(p: readonly BkPosition[]): Kostenposition[] {
  return p.map((x) => ({
    kostenart: x.kostenart,
    bezeichnung: x.bezeichnung,
    gesamtCent: cent(x.gesamtCent),
    schluessel:
      x.schluessel.art === 'direkt'
        ? { art: 'direkt', einheitCent: cent(x.schluessel.einheitCent) }
        : x.schluessel,
  }))
}

/** Letzter Tag, an dem die Abrechnung dem Mieter zugehen muss (§ 556 Abs. 3 Satz 2 BGB). */
export function abrechnungsfrist(zeitraumBis: string): string {
  const [j, m, t] = zeitraumBis.split('-').map(Number) as [number, number, number]
  // Tag nach dem Ende, zwölf Monate weiter, einen Tag zurück
  const d = new Date(Date.UTC(j + 1, m - 1, t + 1))
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

function tageZwischen(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

const deutsch = (iso: string) => iso.split('-').reverse().join('.')
const betragVon = (p: BkPosition) =>
  p.schluessel.art === 'direkt' ? p.schluessel.einheitCent : p.gesamtCent
const euro = (c: number) => (c / 100).toLocaleString('de-DE', { minimumFractionDigits: 2 })

/** Regelbasierte Prüfung: Frist, Vollständigkeit, Vergleich mit dem Vorjahr. */
export function pruefeBkAbrechnung(p: {
  daten: BkAbrechnungDaten
  vorjahr?: BkAbrechnungDaten | null
  heute: string
  mieter: number
}): { befunde: BkBefund[]; fristBis: string } {
  const { daten, vorjahr, heute } = p
  const befunde: BkBefund[] = []
  const fristBis = abrechnungsfrist(daten.zeitraumBis)
  if (daten.status !== 'festgeschrieben') {
    if (heute > fristBis) {
      befunde.push({
        schwere: 'fehler',
        code: 'frist_abgelaufen',
        text: `Abrechnungsfrist am ${deutsch(fristBis)} abgelaufen: Nachforderungen sind ausgeschlossen (§ 556 Abs. 3 Satz 3 BGB), Guthaben müssen trotzdem ausgezahlt werden.`,
      })
    } else if (tageZwischen(heute, fristBis) <= 60) {
      befunde.push({
        schwere: 'warnung',
        code: 'frist_naht',
        text: `Die Abrechnung muss dem Mieter bis ${deutsch(fristBis)} zugehen.`,
      })
    }
  }
  if (p.mieter === 0)
    befunde.push({
      schwere: 'hinweis',
      code: 'keine_mieter',
      text: 'Im Zeitraum war die Einheit nicht vermietet; alle Kosten trägt der Vermieter.',
    })
  if (!daten.positionen.some((x) => x.kostenart === 'grundsteuer'))
    befunde.push({
      schwere: 'hinweis',
      code: 'grundsteuer_fehlt',
      text: 'Keine Grundsteuer erfasst. Sie steht nicht in der WEG-Abrechnung, sondern im Bescheid der Gemeinde.',
    })
  if (!daten.messdienst && !daten.positionen.some((x) => x.kostenart === 'heizung'))
    befunde.push({
      schwere: 'hinweis',
      code: 'heizkosten_fehlen',
      text: 'Keine Heizkosten erfasst. Abrechnung des Messdienstes eintragen.',
    })
  for (const x of daten.positionen) {
    if (betragVon(x) === 0)
      befunde.push({
        schwere: 'warnung',
        code: 'betrag_null',
        text: `${x.bezeichnung}: Betrag ist 0.`,
      })
  }
  if (vorjahr) {
    const schluessel = (x: BkPosition) => `${x.kostenart}|${x.bezeichnung.toLowerCase()}`
    const jetzt = new Map(daten.positionen.map((x) => [schluessel(x), x]))
    for (const alt of vorjahr.positionen) {
      const neu = jetzt.get(schluessel(alt))
      if (!neu) {
        befunde.push({
          schwere: 'hinweis',
          code: 'fehlt_ggue_vorjahr',
          text: `${alt.bezeichnung} war im Vorjahr abgerechnet (${euro(betragVon(alt))} €), fehlt jetzt.`,
        })
        continue
      }
      const a = betragVon(alt)
      const b = betragVon(neu)
      if (a > 0 && b > 0 && Math.abs(b - a) >= 5_000 && Math.abs(b - a) / a > 0.25) {
        const prozent = Math.round(((b - a) / a) * 100)
        befunde.push({
          schwere: 'warnung',
          code: 'abweichung_vorjahr',
          text: `${neu.bezeichnung}: ${prozent > 0 ? '+' : ''}${prozent} % gegenüber Vorjahr (${euro(a)} € → ${euro(b)} €). Beleg prüfen.`,
        })
      }
      if (
        alt.schluessel.art === 'wohnflaeche' &&
        neu.schluessel.art === 'wohnflaeche' &&
        alt.schluessel.gesamtQm100 !== neu.schluessel.gesamtQm100
      )
        befunde.push({
          schwere: 'warnung',
          code: 'gesamtflaeche_geaendert',
          text: `${neu.bezeichnung}: Gesamtfläche geändert (${alt.schluessel.gesamtQm100 / 100} → ${neu.schluessel.gesamtQm100 / 100} m²).`,
        })
    }
  }
  return { befunde, fristBis }
}

export function rechneBkAbrechnung(p: {
  daten: BkAbrechnungDaten
  einheit: Einheit
  mietzeiten: readonly BkMietzeit[]
  vorjahr?: BkAbrechnungDaten | null
  heute: string
}): BkErgebnis {
  const { daten } = p
  const zeitraum = { von: daten.zeitraumVon, bis: daten.zeitraumBis }
  const md = daten.messdienst
  const messdienst = md
    ? messdienstUebernehmen({
        gesamtCent: cent(md.gesamtCent),
        einheitCent: cent(md.einheitCent),
        ...(md.jeNutzung
          ? {
              jeNutzung: Object.fromEntries(
                Object.entries(md.jeNutzung).map(([k, v]) => [k, cent(v)]),
              ),
            }
          : {}),
        ...(md.co2
          ? {
              co2: {
                kostenCent: cent(md.co2.kostenCent),
                kg: md.co2.kg,
                flaecheQm100: md.co2.flaecheQm100,
                tage: md.co2.tage,
                heizWwEinheitCent: cent(md.co2.heizWwEinheitCent),
                heizWwGesamtCent: cent(md.co2.heizWwGesamtCent),
                ...(md.co2.vermieterLautMessdienstCent != null
                  ? { vermieterLautMessdienstCent: cent(md.co2.vermieterLautMessdienstCent) }
                  : {}),
              },
            }
          : {}),
        ...(md.lohnanteil35aCent != null ? { lohnanteil35aCent: cent(md.lohnanteil35aCent) } : {}),
      })
    : null

  const vorauszahlungen: BkErgebnis['vorauszahlungen'] = {}
  const nutzungen = p.mietzeiten.map((m) => {
    const sollCent = vorauszahlungSoll(
      m.vorauszahlungen.map((s) => ({ ab: s.ab, monatCent: cent(s.monatCent) })),
      { von: m.von, bis: m.bis },
    )
    const ist = daten.vorauszahlungen?.[m.mietverhaeltnisId]
    const angerechnetCent = ist != null ? cent(ist) : sollCent
    vorauszahlungen[m.mietverhaeltnisId] = { sollCent, angerechnetCent }
    return {
      id: m.mietverhaeltnisId,
      zeitraum: { von: m.von, bis: m.bis },
      personen: m.personen,
      vorauszahlungenCent: angerechnetCent,
    }
  })

  const abrechnung = betriebskostenabrechnung({
    zeitraum,
    einheit: p.einheit,
    positionen: [...(messdienst?.positionen ?? []), ...positionen(daten.positionen)],
    nutzungen,
    ...(messdienst?.lohnanteil35aCent ? { lohnanteil35aCent: messdienst.lohnanteil35aCent } : {}),
  })
  const { befunde, fristBis } = pruefeBkAbrechnung({
    daten,
    vorjahr: p.vorjahr ?? null,
    heute: p.heute,
    mieter: nutzungen.length,
  })
  return {
    abrechnung,
    messdienst,
    vorauszahlungen,
    hinweise: messdienst?.hinweise ?? [],
    befunde,
    fristBis,
  }
}
