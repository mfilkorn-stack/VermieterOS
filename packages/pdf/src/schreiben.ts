import { formatEuro, type Cent } from '@vermieteros/rechenkern'
import type { Block, Brief } from './brief'

/**
 * Standardschreiben (WP 1.9). Jede Vorlage ist eine reine Funktion: Daten rein, Brief raus.
 * Die Daten kommen aus den Stammdaten zum Stichtag; was dort fehlt, ergänzt der Vermieter im
 * Formular. Rechtliche Mindestinhalte stehen im Kommentar der jeweiligen Vorlage.
 */

export type Partei = { name: string; anschrift: string[] }
export type Wohnung = {
  /** Straße mit Hausnummer, PLZ und Ort */
  anschrift: string[]
  /** Lage im Haus, z. B. „Wohnung Nr. 1, 2. OG links“ */
  lage: string | null
}
type Gemeinsam = { vermieter: Partei; ort: string | null; ausgestellt: string }

const euro = (c: number) => formatEuro(c as Cent)
function datum(iso: string): string {
  const [j, m, t] = iso.split('-')
  return `${t}.${m}.${j}`
}
function wohnungText(w: Wohnung): string {
  return [w.lage, ...w.anschrift].filter(Boolean).join(', ')
}
function namen(l: string[]): string {
  return l.length <= 1 ? (l[0] ?? '') : `${l.slice(0, -1).join(', ')} und ${l.at(-1)}`
}
function unterschrift(g: Gemeinsam): Block {
  return {
    art: 'unterschrift',
    zeilen: [`${g.ort ? `${g.ort}, ` : ''}${datum(g.ausgestellt)}`, g.vermieter.name],
  }
}

export type WohnungsgeberDaten = Gemeinsam & {
  /** Eigentümer, falls der Wohnungsgeber (z. B. Verwalter) nicht selbst Eigentümer ist */
  eigentuemer: Partei | null
  vorgang: 'einzug' | 'auszug'
  /** Datum des Ein- oder Auszugs */
  datum: string
  wohnung: Wohnung
  /** Namen aller meldepflichtigen Personen */
  personen: string[]
}

/**
 * Wohnungsgeberbestätigung nach § 19 Bundesmeldegesetz. Pflichtinhalt (Abs. 3): Name und
 * Anschrift des Wohnungsgebers, bei Abweichung Name des Eigentümers, Art des Vorgangs mit Datum,
 * Anschrift der Wohnung, Namen der meldepflichtigen Personen.
 */
export function wohnungsgeberbestaetigung(d: WohnungsgeberDaten): Brief {
  const einzug = d.vorgang === 'einzug'
  return {
    titel: 'Wohnungsgeberbestätigung',
    absender: [d.vermieter.name, ...d.vermieter.anschrift],
    empfaenger: [],
    ort: d.ort,
    datum: d.ausgestellt,
    betreff: 'Wohnungsgeberbestätigung nach § 19 Bundesmeldegesetz (BMG)',
    bloecke: [
      {
        art: 'text',
        text: `Hiermit bestätige ich als Wohnungsgeber den ${einzug ? 'Einzug in' : 'Auszug aus'} die nachfolgend genannte Wohnung.`,
      },
      {
        art: 'felder',
        zeilen: [
          ['Wohnungsgeber', [d.vermieter.name, ...d.vermieter.anschrift].join(', ')],
          [
            'Eigentümer',
            d.eigentuemer
              ? d.eigentuemer.name
              : 'Der Wohnungsgeber ist zugleich Eigentümer der Wohnung.',
          ],
          ['Vorgang', einzug ? 'Einzug' : 'Auszug'],
          [einzug ? 'Einzugsdatum' : 'Auszugsdatum', datum(d.datum)],
          ['Anschrift der Wohnung', wohnungText(d.wohnung)],
          ['Meldepflichtige Personen', d.personen.join('\n')],
        ],
      },
      {
        art: 'text',
        text: einzug
          ? 'Ich bestätige mit meiner Unterschrift, dass die oben genannten Personen in die Wohnung tatsächlich eingezogen sind.'
          : 'Ich bestätige mit meiner Unterschrift, dass die oben genannten Personen aus der Wohnung tatsächlich ausgezogen sind.',
      },
      {
        art: 'hinweis',
        text: 'Hinweis: Es ist verboten, eine Wohnanschrift für eine Anmeldung einem Dritten anzubieten oder zur Verfügung zu stellen, obwohl ein tatsächlicher Bezug der Wohnung durch diesen weder stattfindet noch beabsichtigt ist (§ 19 Abs. 6 BMG). Ein Verstoß kann als Ordnungswidrigkeit mit einer Geldbuße bis zu 50.000 Euro geahndet werden (§ 54 BMG).',
      },
      unterschrift(d),
    ],
  }
}

export type MietschuldenfreiheitDaten = Gemeinsam & {
  mieter: string[]
  wohnung: Wohnung
  mietbeginn: string
  /** Ende des Mietverhältnisses, falls schon bekannt */
  mietende: string | null
  /** Bis zu diesem Tag sind alle fälligen Zahlungen geleistet */
  stichtag: string
  /** Auch Nachzahlungen aus Betriebskostenabrechnungen sind beglichen */
  mitBetriebskosten: boolean
}

/**
 * Mietschuldenfreiheitsbescheinigung. Kein gesetzlicher Anspruch, übliche Bitte beim
 * Wohnungswechsel; bestätigt wird nur, was der Vermieter geprüft hat (der Bank-Abgleich kommt
 * mit Modul 07, bis dahin bestätigt der Vermieter den Zahlungsstand selbst).
 */
export function mietschuldenfreiheit(d: MietschuldenfreiheitDaten): Brief {
  return {
    titel: 'Mietschuldenfreiheitsbescheinigung',
    absender: [d.vermieter.name, ...d.vermieter.anschrift],
    empfaenger: [],
    ort: d.ort,
    datum: d.ausgestellt,
    betreff: 'Mietschuldenfreiheitsbescheinigung',
    bloecke: [
      {
        art: 'felder',
        zeilen: [
          ['Mieter', d.mieter.join('\n')],
          ['Wohnung', wohnungText(d.wohnung)],
          [
            'Mietverhältnis',
            d.mietende
              ? `vom ${datum(d.mietbeginn)} bis ${datum(d.mietende)}`
              : `seit ${datum(d.mietbeginn)}`,
          ],
        ],
      },
      {
        art: 'text',
        text: `Hiermit bestätige ich, dass ${namen(d.mieter)} für die oben genannte Wohnung bis einschließlich ${datum(d.stichtag)} alle fälligen Mietzahlungen vollständig geleistet ${d.mieter.length > 1 ? 'haben' : 'hat'}. Mietrückstände bestehen nicht.${
          d.mitBetriebskosten
            ? ' Nachzahlungen aus den bisher erstellten Betriebskostenabrechnungen sind ebenfalls beglichen.'
            : ''
        }`,
      },
      {
        art: 'hinweis',
        text: 'Diese Bescheinigung wird auf Wunsch der Mieter zur Vorlage bei einem neuen Vermieter ausgestellt.',
      },
      unterschrift(d),
    ],
  }
}

export type VermieterbescheinigungDaten = Gemeinsam & {
  mieter: string[]
  wohnung: Wohnung
  mietbeginn: string
  /** Wohnfläche in m² als Text, z. B. „68,50“ */
  wohnflaeche: string | null
  zimmer: string | null
  personenzahl: number | null
  stichtag: string
  kaltmieteCent: number
  vorauszahlungBkCent: number
  vorauszahlungHkCent: number
  /** Zweck, z. B. „zur Vorlage beim Jobcenter“ */
  zweck: string | null
}

/**
 * Vermieterbescheinigung (Mietbescheinigung) für Jobcenter, Wohngeldstelle oder Sozialamt:
 * Miete und Vorauszahlungen zum Stichtag, Wohnfläche, Personen. Behörden haben oft eigene
 * Vordrucke; diese Bescheinigung enthält die üblichen Angaben und ersetzt sie dort, wo sie
 * angenommen wird.
 */
export function vermieterbescheinigung(d: VermieterbescheinigungDaten): Brief {
  const gesamt = d.kaltmieteCent + d.vorauszahlungBkCent + d.vorauszahlungHkCent
  return {
    titel: 'Vermieterbescheinigung',
    absender: [d.vermieter.name, ...d.vermieter.anschrift],
    empfaenger: [],
    ort: d.ort,
    datum: d.ausgestellt,
    betreff: `Vermieterbescheinigung${d.zweck ? ` ${d.zweck}` : ''}`,
    bloecke: [
      {
        art: 'text',
        text: `Hiermit bestätige ich die folgenden Angaben zum Mietverhältnis, Stand ${datum(d.stichtag)}.`,
      },
      {
        art: 'felder',
        zeilen: [
          ['Mieter', d.mieter.join('\n')],
          ['Wohnung', wohnungText(d.wohnung)],
          ['Mietbeginn', datum(d.mietbeginn)],
          ['Wohnfläche', d.wohnflaeche ? `${d.wohnflaeche} m²` : 'nicht angegeben'],
          ...(d.zimmer ? ([['Zimmer', d.zimmer]] as const) : []),
          [
            'Personen im Haushalt',
            d.personenzahl != null ? String(d.personenzahl) : 'nicht angegeben',
          ],
        ],
      },
      {
        art: 'felder',
        zeilen: [
          ['Nettokaltmiete', euro(d.kaltmieteCent)],
          ['Vorauszahlung Betriebskosten', euro(d.vorauszahlungBkCent)],
          ['Vorauszahlung Heizkosten', euro(d.vorauszahlungHkCent)],
          ['Gesamtmiete monatlich', euro(gesamt)],
        ],
      },
      unterschrift(d),
    ],
  }
}
