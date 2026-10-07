import { createHash } from 'node:crypto'
import { extractText, getDocumentProxy } from 'unpdf'
import { describe, expect, it } from 'vitest'
import {
  briefPdf,
  mietschuldenfreiheit,
  vermieterbescheinigung,
  wohnungsgeberbestaetigung,
} from '../src'

const VERMIETER = { name: 'Erika Mustermann', anschrift: ['Musterweg 1', '99999 Musterstadt'] }
const WOHNUNG = {
  anschrift: ['Beispielstraße 7', '99999 Musterstadt'],
  lage: 'Wohnung Nr. 1, EG links',
}

async function text(pdf: Uint8Array): Promise<string> {
  const { text } = await extractText(await getDocumentProxy(new Uint8Array(pdf)), {
    mergePages: true,
  })
  return text.replace(/\s+/g, ' ')
}

describe('Standardschreiben', () => {
  it('Wohnungsgeberbestätigung enthält die Pflichtangaben nach § 19 Abs. 3 BMG', async () => {
    const t = await text(
      await briefPdf(
        wohnungsgeberbestaetigung({
          vermieter: VERMIETER,
          eigentuemer: null,
          vorgang: 'einzug',
          datum: '2026-11-01',
          wohnung: WOHNUNG,
          personen: ['Max Beispiel', 'Mia Beispiel'],
          ort: 'Musterstadt',
          ausgestellt: '2026-10-07',
        }),
      ),
    )
    expect(t).toContain('§ 19 Bundesmeldegesetz')
    expect(t).toContain('Erika Mustermann, Musterweg 1, 99999 Musterstadt')
    expect(t).toContain('zugleich Eigentümer')
    expect(t).toContain('Einzugsdatum 01.11.2026')
    expect(t).toContain('Wohnung Nr. 1, EG links, Beispielstraße 7, 99999 Musterstadt')
    expect(t).toContain('Max Beispiel')
    expect(t).toContain('Mia Beispiel')
    expect(t).toContain('50.000 Euro')
  })

  it('Mietschuldenfreiheit: Singular und Plural, optional mit Betriebskosten', async () => {
    const basis = {
      vermieter: VERMIETER,
      wohnung: WOHNUNG,
      mietbeginn: '2021-09-01',
      mietende: '2026-12-31',
      stichtag: '2026-10-07',
      ort: null,
      ausgestellt: '2026-10-07',
    }
    const eins = await text(
      await briefPdf(
        mietschuldenfreiheit({ ...basis, mieter: ['Max Beispiel'], mitBetriebskosten: false }),
      ),
    )
    expect(eins).toContain('Max Beispiel für die oben genannte Wohnung')
    expect(eins).toContain('geleistet hat')
    expect(eins).not.toContain('Betriebskostenabrechnungen')
    expect(eins).toContain('vom 01.09.2021 bis 31.12.2026')
    const zwei = await text(
      await briefPdf(
        mietschuldenfreiheit({
          ...basis,
          mieter: ['Max Beispiel', 'Mia Beispiel'],
          mitBetriebskosten: true,
        }),
      ),
    )
    expect(zwei).toContain('Max Beispiel und Mia Beispiel')
    expect(zwei).toContain('geleistet haben')
    expect(zwei).toContain('Betriebskostenabrechnungen')
  })

  it('Vermieterbescheinigung rechnet die Gesamtmiete', async () => {
    const t = await text(
      await briefPdf(
        vermieterbescheinigung({
          vermieter: VERMIETER,
          mieter: ['Max Beispiel'],
          wohnung: WOHNUNG,
          mietbeginn: '2021-09-01',
          wohnflaeche: '68,50',
          zimmer: '3',
          personenzahl: 2,
          stichtag: '2026-10-07',
          kaltmieteCent: 65_000,
          vorauszahlungBkCent: 12_000,
          vorauszahlungHkCent: 8_000,
          zweck: 'zur Vorlage beim Jobcenter',
          ort: 'Musterstadt',
          ausgestellt: '2026-10-07',
        }),
      ),
    )
    expect(t).toContain('Vermieterbescheinigung zur Vorlage beim Jobcenter')
    expect(t).toContain('68,50 m²')
    expect(t).toContain('Gesamtmiete monatlich 850,00 €')
  })

  it('gleiche Daten, gleiche Datei: die Prüfsumme belegt das ausgestellte Schreiben', async () => {
    const brief = mietschuldenfreiheit({
      vermieter: VERMIETER,
      mieter: ['Max Beispiel'],
      wohnung: WOHNUNG,
      mietbeginn: '2021-09-01',
      mietende: null,
      stichtag: '2026-10-07',
      mitBetriebskosten: false,
      ort: null,
      ausgestellt: '2026-10-07',
    })
    const h = async () =>
      createHash('sha256')
        .update(await briefPdf(brief))
        .digest('hex')
    expect(await h()).toBe(await h())
  })

  it('langer Text bricht um und erzeugt Folgeseiten mit Seitenzahl', async () => {
    const pdf = await briefPdf({
      titel: 'Test',
      absender: ['A'],
      empfaenger: ['B', 'Straße 1', '99999 Ort'],
      ort: null,
      datum: '2026-10-07',
      betreff: 'Lang',
      bloecke: Array.from({ length: 60 }, () => ({
        art: 'text' as const,
        text: 'Ein Absatz mit genug Wörtern, damit er sicher über mehr als eine Zeile läuft und umbricht.',
      })),
    })
    const dok = await getDocumentProxy(new Uint8Array(pdf))
    expect(dok.numPages).toBeGreaterThan(1)
    expect(await text(pdf)).toContain(`Seite 1 von ${dok.numPages}`)
  })
})
