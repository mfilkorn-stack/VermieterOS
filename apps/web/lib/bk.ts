import 'server-only'
import {
  bkAbrechnungZuJahr,
  bkNutzungen,
  ladeBkAbrechnung,
  letzteVersion,
  type BkNutzung,
  type Tx,
} from '@vermieteros/db'
import { parseDezimal, parseEuro, rechneBkAbrechnung } from '@vermieteros/rechenkern'
import { BkAbrechnungDaten, type BkPosition } from '@vermieteros/schema'
import { sql } from 'drizzle-orm'
import { Eingabefehler, zodText } from './eingabe'
import { dezimalText, euroText } from './format'
import { heuteBerlin } from './zeit'

/**
 * Betriebskostenabrechnung in der Web-App (WP 2.4): Formulardaten (Texte, deutsche Zahlen)
 * hin und zurück, Laden mit Mietverhältnissen und Vorjahr, Rechnen mit dem Rechenkern.
 */

export const SCHLUESSEL_TEXT = {
  wohnflaeche: 'Wohnfläche',
  einheiten: 'Einheiten',
  mea: 'Miteigentumsanteile',
  personen: 'Personenmonate',
  direkt: 'direkt (Betrag der Einheit)',
  nutzer: 'je Mietverhältnis',
} as const

export const GROESSE_TEXT: Record<BkPosition['schluessel']['art'], string> = {
  wohnflaeche: 'Gesamtfläche m²',
  einheiten: 'Anzahl Einheiten',
  mea: 'MEA gesamt',
  personen: 'Personenmonate gesamt',
  direkt: 'Betrag Einheit €',
}

export type PositionRoh = {
  kostenart: BkPosition['kostenart']
  bezeichnung: string
  gesamt: string
  schluessel: BkPosition['schluessel']['art']
  groesse: string
}

export type MessdienstRoh = {
  aktiv: boolean
  gesamt: string
  einheit: string
  co2Kosten: string
  co2Kg: string
  co2Flaeche: string
  co2Tage: string
  heizWwEinheit: string
  heizWwGesamt: string
  vermieterLaut: string
  lohn35a: string
  jeNutzung: Record<string, string>
}

export type BkRoh = {
  zeitraumVon: string
  zeitraumBis: string
  positionen: PositionRoh[]
  messdienst: MessdienstRoh
  vorauszahlungen: Record<string, string>
  notizen: string
}

const LEER_MD: MessdienstRoh = {
  aktiv: false,
  gesamt: '',
  einheit: '',
  co2Kosten: '',
  co2Kg: '',
  co2Flaeche: '',
  co2Tage: '',
  heizWwEinheit: '',
  heizWwGesamt: '',
  vermieterLaut: '',
  lohn35a: '',
  jeNutzung: {},
}

const opt = (c: number | null | undefined) => (c == null ? '' : euroText(c))

export function zuRoh(d: BkAbrechnungDaten): BkRoh {
  const md = d.messdienst
  return {
    zeitraumVon: d.zeitraumVon,
    zeitraumBis: d.zeitraumBis,
    positionen: d.positionen.map((p) => {
      const s = p.schluessel
      return {
        kostenart: p.kostenart,
        bezeichnung: p.bezeichnung,
        gesamt: euroText(p.gesamtCent),
        schluessel: s.art,
        groesse:
          s.art === 'wohnflaeche'
            ? dezimalText(s.gesamtQm100, 2)
            : s.art === 'einheiten'
              ? String(s.anzahl)
              : s.art === 'mea'
                ? String(s.gesamt)
                : s.art === 'personen'
                  ? String(s.gesamtPersonenmonate).replace('.', ',')
                  : euroText(s.einheitCent),
      }
    }),
    messdienst: md
      ? {
          aktiv: true,
          gesamt: euroText(md.gesamtCent),
          einheit: euroText(md.einheitCent),
          co2Kosten: opt(md.co2?.kostenCent),
          co2Kg: md.co2 ? String(md.co2.kg).replace('.', ',') : '',
          co2Flaeche: md.co2 ? dezimalText(md.co2.flaecheQm100, 2) : '',
          co2Tage: md.co2 ? String(md.co2.tage) : '',
          heizWwEinheit: opt(md.co2?.heizWwEinheitCent),
          heizWwGesamt: opt(md.co2?.heizWwGesamtCent),
          vermieterLaut: opt(md.co2?.vermieterLautMessdienstCent),
          lohn35a: opt(md.lohnanteil35aCent),
          jeNutzung: Object.fromEntries(
            Object.entries(md.jeNutzung ?? {}).map(([k, v]) => [k, euroText(v)]),
          ),
        }
      : LEER_MD,
    vorauszahlungen: Object.fromEntries(
      Object.entries(d.vorauszahlungen ?? {}).map(([k, v]) => [k, euroText(v)]),
    ),
    notizen: d.notizen ?? '',
  }
}

function betrag(text: string, label: string): number {
  try {
    return parseEuro(text)
  } catch {
    throw new Eingabefehler(`${label}: „${text}“ ist kein Betrag (z. B. 1.234,56).`)
  }
}
function zahl(text: string, stellen: number, label: string): number {
  try {
    return parseDezimal(text, stellen)
  } catch {
    throw new Eingabefehler(`${label}: „${text}“ ist keine Zahl.`)
  }
}
const leer = (t: string | undefined) => !t || !t.trim()

export function ausRoh(r: BkRoh, status: BkAbrechnungDaten['status']): BkAbrechnungDaten {
  const positionen: BkPosition[] = r.positionen
    .filter((p) => p.bezeichnung.trim() || !leer(p.gesamt) || !leer(p.groesse))
    .map((p, i) => {
      const n = `Zeile ${i + 1} (${p.bezeichnung || 'ohne Bezeichnung'})`
      if (!p.bezeichnung.trim()) throw new Eingabefehler(`${n}: Bezeichnung fehlt.`)
      if (leer(p.groesse) && p.schluessel !== 'direkt')
        throw new Eingabefehler(`${n}: ${GROESSE_TEXT[p.schluessel]} fehlt.`)
      const gesamtCent = leer(p.gesamt) ? 0 : betrag(p.gesamt, n)
      const schluessel: BkPosition['schluessel'] =
        p.schluessel === 'wohnflaeche'
          ? { art: 'wohnflaeche', gesamtQm100: zahl(p.groesse, 2, n) }
          : p.schluessel === 'einheiten'
            ? { art: 'einheiten', anzahl: zahl(p.groesse, 0, n) }
            : p.schluessel === 'mea'
              ? { art: 'mea', gesamt: zahl(p.groesse, 0, n) }
              : p.schluessel === 'personen'
                ? { art: 'personen', gesamtPersonenmonate: zahl(p.groesse, 1, n) / 10 }
                : {
                    art: 'direkt',
                    einheitCent: leer(p.groesse) ? gesamtCent : betrag(p.groesse, n),
                  }
      return { kostenart: p.kostenart, bezeichnung: p.bezeichnung.trim(), gesamtCent, schluessel }
    })
  const m = r.messdienst
  let messdienst: BkAbrechnungDaten['messdienst'] = null
  if (m.aktiv) {
    const co2 = !leer(m.co2Kosten)
      ? {
          kostenCent: betrag(m.co2Kosten, 'CO2-Kosten'),
          kg: zahl(m.co2Kg, 1, 'CO2 in kg') / 10,
          flaecheQm100: zahl(m.co2Flaeche, 2, 'Wohnfläche laut Messdienst'),
          tage: zahl(m.co2Tage || '365', 0, 'Tage'),
          heizWwEinheitCent: betrag(m.heizWwEinheit, 'Heizung und Warmwasser der Einheit'),
          heizWwGesamtCent: betrag(m.heizWwGesamt, 'Heizung und Warmwasser gesamt'),
          vermieterLautMessdienstCent: leer(m.vermieterLaut)
            ? null
            : betrag(m.vermieterLaut, 'CO2-Anteil Vermieter laut Messdienst'),
        }
      : null
    const je = Object.entries(m.jeNutzung).filter(([, v]) => !leer(v))
    messdienst = {
      gesamtCent: leer(m.gesamt) ? 0 : betrag(m.gesamt, 'Messdienst gesamt'),
      einheitCent: betrag(m.einheit, 'Messdienst Betrag der Einheit'),
      jeNutzung: je.length
        ? Object.fromEntries(je.map(([k, v]) => [k, betrag(v, 'Betrag laut Zwischenablesung')]))
        : null,
      co2,
      lohnanteil35aCent: leer(m.lohn35a) ? null : betrag(m.lohn35a, 'Lohnanteil § 35a'),
    }
  }
  const vz = Object.entries(r.vorauszahlungen).filter(([, v]) => !leer(v))
  const p = BkAbrechnungDaten.safeParse({
    zeitraumVon: r.zeitraumVon,
    zeitraumBis: r.zeitraumBis,
    positionen,
    messdienst,
    vorauszahlungen: vz.length
      ? Object.fromEntries(vz.map(([k, v]) => [k, betrag(v, 'Vorauszahlungen')]))
      : null,
    status,
    notizen: r.notizen.trim() || null,
  })
  if (!p.success) throw new Eingabefehler(zodText(p.error, { zeitraumBis: 'Zeitraum' }))
  return p.data
}

/** Daten einer Version als `BkAbrechnungDaten` (die Datenbank liefert `null` statt fehlender Felder). */
export function datenAusVersion(v: {
  zeitraumVon: string
  zeitraumBis: string
  positionen: BkPosition[]
  messdienst: BkAbrechnungDaten['messdienst'] | null
  vorauszahlungen: Record<string, number> | null
  status: BkAbrechnungDaten['status']
  notizen: string | null
  ergebnis?: BkAbrechnungDaten['ergebnis'] | null
}): BkAbrechnungDaten {
  return {
    zeitraumVon: v.zeitraumVon,
    zeitraumBis: v.zeitraumBis,
    positionen: v.positionen,
    messdienst: v.messdienst,
    vorauszahlungen: v.vorauszahlungen,
    status: v.status,
    notizen: v.notizen,
    ergebnis: v.ergebnis ?? null,
  }
}

export type BkSeite = Awaited<ReturnType<typeof ladeBkSeite>>

/** Alles für die Seite einer Abrechnung: Daten, Einheit, Mietverhältnisse, Ergebnis, Prüfung. */
export async function ladeBkSeite(tx: Tx, id: string) {
  const a = await ladeBkAbrechnung(tx, id)
  if (!a) return null
  const daten = datenAusVersion(a.version)
  const einheit = await letzteVersion(tx, 'einheit', a.einheitId)
  const [ort] = await tx.execute<{ objekt_id: string; objekt: string }>(sql`
    SELECT e.objekt_id, o.bezeichnung AS objekt FROM einheiten e
    JOIN objekte_aktuell o ON o.objekt_id = e.objekt_id WHERE e.id = ${a.einheitId}`)
  const nutzungen: BkNutzung[] = await bkNutzungen(
    tx,
    a.einheitId,
    daten.zeitraumVon,
    daten.zeitraumBis,
  )
  const vorjahrId = await bkAbrechnungZuJahr(tx, a.einheitId, a.jahr - 1)
  const vorjahr = vorjahrId ? await ladeBkAbrechnung(tx, vorjahrId) : null
  const fehler: string[] = []
  if (!einheit?.wohnflaecheQm100) fehler.push('Für die Einheit ist keine Wohnfläche erfasst.')
  let ergebnis: ReturnType<typeof rechneBkAbrechnung> | null = null
  try {
    ergebnis = rechneBkAbrechnung({
      daten,
      einheit: {
        wohnflaecheQm100: einheit?.wohnflaecheQm100 ?? 0,
        ...(einheit?.miteigentumsanteilZaehler && einheit.miteigentumsanteilNenner
          ? { mea: einheit.miteigentumsanteilZaehler }
          : {}),
      },
      mietzeiten: nutzungen.map((n) => ({
        mietverhaeltnisId: n.mietverhaeltnisId,
        von: n.von,
        bis: n.bis,
        personen: n.personen,
        vorauszahlungen: n.vorauszahlungen,
      })),
      vorjahr: vorjahr ? datenAusVersion(vorjahr.version) : null,
      heute: heuteBerlin(),
    })
  } catch (e) {
    fehler.push(e instanceof Error ? e.message : String(e))
  }
  return {
    id,
    jahr: a.jahr,
    einheitId: a.einheitId,
    einheit: einheit?.bezeichnung ?? 'Einheit',
    wohnflaecheQm100: einheit?.wohnflaecheQm100 ?? null,
    objektId: ort!.objekt_id,
    objekt: ort!.objekt,
    versionId: a.version.id,
    daten,
    nutzungen,
    ergebnis,
    fehler,
  }
}
