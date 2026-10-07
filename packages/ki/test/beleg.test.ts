import {
  createDb,
  geltendeKiVorschlaege,
  legeMandantAn,
  neueVersion,
  withMandant,
  type Akteur,
} from '@vermieteros/db'
import { v7 as uuidv7 } from 'uuid'
import { afterAll, beforeAll, describe, expect, it, inject } from 'vitest'
import { BELEG_EXTRAKTION, werteBelegAus, type BelegAuszug } from '../src/aufgaben/beleg'
import { belegeAuslesen } from '../src/beleglauf'
import { FakeKiClient } from '../src/fake'
import type { BelegKontextDaten } from '../src/kontext/beleg'
import { seitenTexte } from '../src/pdf'
import { musterRechnung } from '../src/testpdf'

const AUSZUG: BelegAuszug = {
  lieferant: {
    wert: 'Stadtwerke Musterstadt GmbH',
    seite: 1,
    zitat: 'Stadtwerke Musterstadt GmbH',
  },
  rechnungsnummer: { wert: 'W-2026-0815', seite: 1, zitat: 'Trinkwasser Nr. W-2026-0815' },
  rechnungsdatum: { wert: '05.01.2026', seite: 1, zitat: 'Rechnungsdatum: 05.01.2026' },
  betrag_brutto: { wert: '481,50 €', seite: 1, zitat: 'Rechnungsbetrag: 481,50 €' },
  umsatzsteuer: { wert: '31,50 €', seite: 1, zitat: 'Umsatzsteuer 7 %: 31,50 €' },
  leistung_von: { wert: '01.01.2025', seite: 1, zitat: 'Abrechnungszeitraum: 01.01.2025' },
  leistung_bis: { wert: '31.12.2025', seite: 1, zitat: 'bis 31.12.2025' },
  // erfunden: steht so nicht auf dem Beleg
  zahlungsdatum: { wert: '16.01.2026', seite: 1, zitat: 'abgebucht am 16.01.2026' },
  einordnung: {
    objekt_id: null,
    steuerkategorie: 'betriebskosten',
    kostenart: 'wasserversorgung',
    umlagefaehig: true,
    begruendung: 'Trinkwasser für das Haus, umlegbar nach § 2 Nr. 2 BetrKV',
  },
  hinweise: [],
}

describe('Beleg: Fundstellen und Einordnung', () => {
  it('prüft Zitate am PDF-Text und normiert Beträge und Daten', async () => {
    const seiten = await seitenTexte(musterRechnung())
    const a = Object.fromEntries(werteBelegAus(AUSZUG, seiten).map((x) => [x.feld, x]))
    expect(a['betrag_brutto']).toMatchObject({ pruefung: 'belegt', normiert: 48_150 })
    expect(a['umsatzsteuer']).toMatchObject({ pruefung: 'belegt', normiert: 3_150 })
    expect(a['leistung_von']).toMatchObject({ pruefung: 'belegt', normiert: '2025-01-01' })
    expect(a['leistung_bis']).toMatchObject({ pruefung: 'belegt', normiert: '2025-12-31' })
    expect(a['lieferant']).toMatchObject({
      pruefung: 'belegt',
      normiert: 'Stadtwerke Musterstadt GmbH',
    })
    expect(a['zahlungsdatum']?.pruefung).toBe('nicht_belegt')
  })

  it('Foto ohne Textebene: nicht prüfbar', () => {
    expect(werteBelegAus(AUSZUG, [])[0]?.pruefung).toBe('scan')
  })

  it('lehnt Objekte außerhalb der Liste und widersprüchliche Einordnung ab', () => {
    const daten = { objekte: [{ id: 'o1', bezeichnung: 'Haus', anschrift: null, einheiten: [] }] }
    const pruefe = (e: Partial<BelegAuszug['einordnung']>) =>
      BELEG_EXTRAKTION.pruefe!(
        { ...AUSZUG, einordnung: { ...AUSZUG.einordnung, ...e } },
        daten as unknown as BelegKontextDaten,
      )
    expect(pruefe({ objekt_id: 'o1' })).toEqual([])
    expect(pruefe({ objekt_id: 'erfunden' })).toEqual([
      'Objekt erfunden steht nicht in der Objektliste',
    ])
    expect(pruefe({ steuerkategorie: 'erhaltungsaufwand' })).toEqual([
      'Kostenart ohne Betriebskosten',
      'Umlagefähig nur für Betriebskosten mit Kostenart',
    ])
  })
})

const NUTZER: Akteur = { art: 'nutzer', id: 'test-nutzer' }
const app = createDb(inject('appUrl'), { max: 2 })
const worker = createDb(inject('workerUrl'), { max: 2 })
afterAll(async () => {
  await app.close()
  await worker.close()
})

let mandant: string
let objekt: string
let beleg: string
const PDF = Buffer.from(musterRechnung())

beforeAll(async () => {
  mandant = uuidv7()
  await withMandant(app.db, mandant, async (tx) => {
    await legeMandantAn(tx, { id: mandant, name: 'Belege', art: 'allein', akteur: NUTZER })
    objekt = (
      await neueVersion(tx, {
        entitaet: 'objekt',
        mandantId: mandant,
        akteur: NUTZER,
        gueltigAb: '2024-01-01',
        identitaet: {},
        daten: { bezeichnung: 'Musterweg 1', art: 'haus', strasse: 'Musterweg', hausnummer: '1' },
      })
    ).identId
    beleg = (
      await neueVersion(tx, {
        entitaet: 'dokument',
        mandantId: mandant,
        akteur: NUTZER,
        gueltigAb: '2026-01-10',
        identitaet: {
          beleg: true,
          dateiHash: 'd'.repeat(64),
          speicherSchluessel: 'beleg/rechnung.pdf',
          dateiname: 'rechnung.pdf',
          mime: 'application/pdf',
          groesseBytes: PDF.length,
        },
        daten: { typ: 'beleg', status: 'gueltig', titel: 'Rechnung' },
      })
    ).identId
  })
})

describe('Beleglauf im Worker', () => {
  it('liest neue Belege mit der Worker-Rolle aus; die KI sieht PDF und Objektliste', async () => {
    const client = new FakeKiClient({
      ...AUSZUG,
      einordnung: { ...AUSZUG.einordnung, objekt_id: objekt },
    })
    const lauf = (c: FakeKiClient) =>
      belegeAuslesen({
        db: worker.db,
        client: c,
        quelle: { holen: async () => PDF },
        mandantIds: [mandant],
        limit: 5,
        log: () => {},
      })
    expect(await lauf(client)).toEqual({ gelesen: 1, fehler: 0 })
    const anfrage = client.anfragen[0]!
    expect(anfrage.dateien?.[0]?.mime).toBe('application/pdf')
    expect(anfrage.nachricht).toContain('Musterweg 1')
    expect(await lauf(new FakeKiClient())).toEqual({ gelesen: 0, fehler: 0 })
    const v = await withMandant(app.db, mandant, (tx) =>
      geltendeKiVorschlaege(tx, 'beleg_extraktion', [beleg]),
    )
    expect(v.get(beleg)?.ausgabe).toMatchObject({ einordnung: { objekt_id: objekt } })
  })
})
