import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { neueVersion } from '../src/ledger'
import { withMandant } from '../src/mandant'
import { datenqualitaet } from '../src/qualitaet'
import { NUTZER, neuerMandant, verbindungen } from './helfer'

const v = verbindungen()
afterAll(() => v.close())

let mandant: string
let objektId: string
let einheitId: string

beforeAll(async () => {
  mandant = await neuerMandant(v.app, 'Qualität')
  await withMandant(v.app, mandant, async (tx) => {
    const o = await neueVersion(tx, {
      entitaet: 'objekt',
      mandantId: mandant,
      akteur: NUTZER,
      gueltigAb: '2020-01-01',
      identitaet: {},
      daten: { bezeichnung: 'Lückenhaft', art: 'haus', strasse: 'Weg', plz: '50667', ort: 'Köln' },
    })
    objektId = o.identId
    const e = await neueVersion(tx, {
      entitaet: 'einheit',
      mandantId: mandant,
      akteur: NUTZER,
      gueltigAb: '2020-01-01',
      identitaet: { objektId },
      daten: { bezeichnung: 'EG' },
    })
    einheitId = e.identId
  })
})

describe('datenqualitaet (DB-Loader)', () => {
  it('liefert null für unbekannte Objekte', async () => {
    const r = await withMandant(v.app, mandant, (tx) =>
      datenqualitaet(tx, '00000000-0000-7000-8000-000000000000'),
    )
    expect(r).toBeNull()
  })

  it('erkennt fehlende Wohnfläche und fehlende Steuerdaten, Finanzen bleiben grün', async () => {
    const r = await withMandant(v.app, mandant, (tx) => datenqualitaet(tx, objektId))
    expect(r?.ampel).toMatchObject({ nebenkosten: 'rot', steuerpaket: 'rot', finanzen: 'gruen' })
    expect(r?.befunde.map((b) => b.code)).toContain('EINHEIT_WOHNFLAECHE')
    expect(r?.befunde.find((b) => b.code === 'EINHEIT_WOHNFLAECHE')?.id).toBe(einheitId)
  })

  it('wird grün, sobald die Daten als neue Versionen nachgetragen sind', async () => {
    await withMandant(v.app, mandant, async (tx) => {
      await neueVersion(tx, {
        entitaet: 'objekt',
        mandantId: mandant,
        akteur: NUTZER,
        gueltigAb: '2020-01-01',
        identId: objektId,
        begruendung: 'Kaufvertrag nachgetragen',
        daten: {
          bezeichnung: 'Lückenhaft',
          art: 'haus',
          strasse: 'Weg',
          plz: '50667',
          ort: 'Köln',
          baujahr: 1980,
          grundbuch: [
            {
              art: 'grundbuch',
              amtsgericht: 'Köln',
              blatt: '1',
              flurstuecke: [{ nummer: 'Flst. 1', flaecheQm: 500 }],
            },
          ],
          bundesland: 'NW',
          kaufvertragDatum: '2019-11-15',
          anschaffungsdatum: '2020-01-01',
          kaufpreisCent: 30_000_000,
          anschaffungsnebenkosten: [{ art: 'grunderwerbsteuer', betragCent: 1_950_000 }],
          gebaeudeanteilPromille: 700,
          afaSatzPromille: 20,
          afaBeginn: '2020-01-01',
        },
      })
      await neueVersion(tx, {
        entitaet: 'einheit',
        mandantId: mandant,
        akteur: NUTZER,
        gueltigAb: '2020-01-01',
        identId: einheitId,
        begruendung: 'Wohnfläche aus Grundriss',
        daten: { bezeichnung: 'EG', wohnflaecheQm100: 6500 },
      })
    })
    const r = await withMandant(v.app, mandant, (tx) => datenqualitaet(tx, objektId))
    expect(r?.befunde).toEqual([])
    expect(r?.vollstaendig).toBe(true)
  })

  it('prüft die Eigentumsanteile des Mandanten mit', async () => {
    // Mandant aus dem Helfer ist „allein“; zwei Anteile ergeben eine Warnung.
    await withMandant(v.app, mandant, async (tx) => {
      for (const nachname of ['Eins', 'Zwei']) {
        const p = await neueVersion(tx, {
          entitaet: 'person',
          mandantId: mandant,
          akteur: NUTZER,
          gueltigAb: '2020-01-01',
          identitaet: {},
          daten: { rolle: 'miteigentuemer', nachname },
        })
        await neueVersion(tx, {
          entitaet: 'eigentumsanteil',
          mandantId: mandant,
          akteur: NUTZER,
          gueltigAb: '2020-01-01',
          identitaet: { personId: p.identId },
          daten: { zaehler: 1, nenner: 2 },
        })
      }
    })
    const r = await withMandant(v.app, mandant, (tx) => datenqualitaet(tx, objektId))
    expect(r?.befunde.map((b) => b.code)).toEqual(['EIGENTUM_ALLEIN_MEHRERE'])
  })
})
