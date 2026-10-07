import { formatEuro, type Cent } from '@vermieteros/rechenkern'
import type { Block, Brief } from './brief'
import type { Partei, Wohnung } from './schreiben'

/**
 * Betriebskostenabrechnung an den Mieter (WP 2.4): Anschreiben und Abrechnung in einem PDF,
 * nach der Vorlage der Vermieter (Tabelle Kostenart, Schlüssel, Gesamtkosten, Anteil; Anschreiben
 * mit Ergebnis und Anpassung der Vorauszahlung). Formelle Mindestangaben nach BGH: Zusammen-
 * stellung der Gesamtkosten, Verteilerschlüssel mit Erläuterung, Anteil des Mieters, Abzug der
 * Vorauszahlungen.
 */
export type BkBriefDaten = {
  vermieter: Partei
  ort: string | null
  /** ISO-Datum des Schreibens */
  ausgestellt: string
  empfaenger: Partei
  /** „Sehr geehrte Frau …,“ */
  anrede: string
  wohnung: Wohnung
  jahr: number
  zeitraum: { von: string; bis: string }
  nutzung: { von: string; bis: string; monate: number }
  zeilen: Array<{ bezeichnung: string; schluessel: string; gesamtCent: number; anteilCent: number }>
  kostenCent: number
  vorauszahlungenCent: number
  /** positiv: Nachzahlung */
  saldoCent: number
  lohnanteil35aCent: number
  /** Erläuterung der Schlüssel und der CO2-Aufteilung */
  erlaeuterungen: string[]
  /** neue monatliche Vorauszahlung (§ 560 Abs. 4 BGB) */
  anpassung: { bisherCent: number; neuCent: number; ab: string; kaltmieteCent: number } | null
}

const euro = (c: number) => formatEuro(c as Cent)
function datum(iso: string): string {
  const [j, m, t] = iso.split('-')
  return `${t}.${m}.${j}`
}
const monate = (m: number) =>
  Number.isInteger(m) ? String(m) : m.toLocaleString('de-DE', { maximumFractionDigits: 2 })

export function betriebskostenabrechnungBrief(d: BkBriefDaten): Brief {
  const ganz = d.nutzung.von === d.zeitraum.von && d.nutzung.bis === d.zeitraum.bis
  const nach = d.saldoCent > 0
  const bloecke: Block[] = [
    { art: 'text', text: d.anrede },
    {
      art: 'text',
      text: `in der Anlage erhalten Sie die Heiz- und Betriebskostenabrechnung für den Zeitraum ${datum(d.zeitraum.von)} bis ${datum(d.zeitraum.bis)}${ganz ? '' : `, für Sie anteilig vom ${datum(d.nutzung.von)} bis ${datum(d.nutzung.bis)}`}. Die Belege können Sie nach vorheriger Terminabstimmung einsehen.`,
    },
    {
      art: 'text',
      fett: true,
      text:
        d.saldoCent === 0
          ? 'Die Abrechnung ist ausgeglichen.'
          : nach
            ? `Die Abrechnung endet für Sie mit einer Nachzahlung von ${euro(d.saldoCent)}.`
            : `Die Abrechnung endet für Sie mit einem Guthaben von ${euro(-d.saldoCent)}.`,
    },
    {
      art: 'text',
      text: nach
        ? 'Bitte überweisen Sie den Betrag innerhalb von 30 Tagen auf das bekannte Konto.'
        : d.saldoCent < 0
          ? 'Wir überweisen Ihnen den Betrag in den nächsten Tagen.'
          : '',
    },
  ]
  if (d.anpassung) {
    const a = d.anpassung
    const diff = a.neuCent - a.bisherCent
    bloecke.push(
      {
        art: 'text',
        text: `Auf Grundlage dieser Abrechnung ${diff >= 0 ? 'erhöhen' : 'senken'} wir Ihre monatliche Vorauszahlung von bisher ${euro(a.bisherCent)} um ${euro(Math.abs(diff))} auf ${euro(a.neuCent)}, mit Wirkung ab ${datum(a.ab)} (§ 560 Abs. 4 BGB). Ihre monatliche Zahlung ab diesem Datum:`,
      },
      {
        art: 'felder',
        zeilen: [
          ['Kaltmiete (wie bisher)', euro(a.kaltmieteCent)],
          ['Vorauszahlung neu', euro(a.neuCent)],
          ['Gesamt', euro(a.kaltmieteCent + a.neuCent)],
        ],
      },
      { art: 'text', text: 'Bitte ändern Sie Ihren Dauerauftrag entsprechend.' },
    )
  }
  if (d.lohnanteil35aCent > 0) {
    bloecke.push({
      art: 'hinweis',
      text: `Haushaltsnahe Dienstleistungen nach § 35a EStG: Ihr Lohnkostenanteil beträgt ${euro(d.lohnanteil35aCent)}.`,
    })
  }
  bloecke.push(
    { art: 'text', text: 'Für Rückfragen stehen wir gern zur Verfügung.' },
    { art: 'text', text: 'Mit freundlichen Grüßen' },
    { art: 'unterschrift', zeilen: [d.vermieter.name] },
    { art: 'seitenumbruch' },
    { art: 'text', fett: true, text: `Betriebskostenabrechnung ${d.jahr}` },
    {
      art: 'felder',
      zeilen: [
        ['Wohnung', [d.wohnung.lage, ...d.wohnung.anschrift].filter(Boolean).join(', ')],
        ['Mieter', d.empfaenger.name],
        ['Abrechnungszeitraum', `${datum(d.zeitraum.von)} bis ${datum(d.zeitraum.bis)}`],
        [
          'Ihr Zeitraum',
          `${datum(d.nutzung.von)} bis ${datum(d.nutzung.bis)} (${monate(d.nutzung.monate)} Monate)`,
        ],
      ],
    },
    {
      art: 'tabelle',
      spalten: [
        { titel: 'Kostenart' },
        { titel: 'Verteilerschlüssel', breiteMm: 38 },
        { titel: 'Gesamtkosten', breiteMm: 30, rechts: true },
        { titel: 'Ihr Anteil', breiteMm: 26, rechts: true },
      ],
      zeilen: [
        ...d.zeilen.map((z) => ({
          zellen: [z.bezeichnung, z.schluessel, euro(z.gesamtCent), euro(z.anteilCent)],
        })),
        { zellen: ['Summe Betriebskosten', '', '', euro(d.kostenCent)], fett: true },
        { zellen: ['abzüglich Ihrer Vorauszahlungen', '', '', euro(-d.vorauszahlungenCent)] },
        {
          zellen: [
            d.saldoCent > 0 ? 'Nachzahlung' : d.saldoCent < 0 ? 'Guthaben' : 'Ergebnis',
            '',
            '',
            euro(Math.abs(d.saldoCent)),
          ],
          fett: true,
        },
      ],
    },
    { art: 'text', fett: true, text: 'Erläuterung der Verteilerschlüssel' },
    ...d.erlaeuterungen.map((t): Block => ({ art: 'hinweis', text: t })),
  )
  return {
    titel: `Betriebskostenabrechnung ${d.jahr}`,
    absender: [d.vermieter.name, ...d.vermieter.anschrift],
    empfaenger: [d.empfaenger.name, ...d.empfaenger.anschrift],
    ort: d.ort,
    datum: d.ausgestellt,
    betreff: `Betriebskostenabrechnung ${d.jahr}\n${[d.wohnung.lage, ...d.wohnung.anschrift].filter(Boolean).join(', ')}`,
    bloecke: bloecke.filter((b) => b.art !== 'text' || b.text !== ''),
  }
}
