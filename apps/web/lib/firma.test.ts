import { describe, expect, it } from 'vitest'
import { firmaAusPhoton, kontaktAusTags, sortiereFirmen } from './firma'

const elektro = {
  countrycode: 'DE',
  osm_type: 'N',
  osm_id: 101,
  osm_key: 'craft',
  osm_value: 'electrician',
  name: 'Elektro Muster GmbH',
  street: 'Musterstraße',
  housenumber: '5',
  postcode: '99999',
  city: 'Musterstadt',
  state: 'Nordrhein-Westfalen',
}

describe('firmaAusPhoton', () => {
  it('Handwerksbetrieb mit Anschrift und Gewerk', () => {
    expect(firmaAusPhoton(elektro)).toEqual({
      osm: 'N101',
      name: 'Elektro Muster GmbH',
      adresse: {
        strasse: 'Musterstraße',
        hausnummer: '5',
        plz: '99999',
        ort: 'Musterstadt',
        bundesland: 'NW',
      },
      gewerk: 'elektro',
      art: 'craft=electrician',
    })
  })

  it('verwirft Straßen, Orte, Ausland und Einträge ohne Namen', () => {
    expect(firmaAusPhoton({ ...elektro, osm_key: 'highway' })).toBeNull()
    expect(firmaAusPhoton({ ...elektro, osm_key: 'place' })).toBeNull()
    expect(firmaAusPhoton({ ...elektro, countrycode: 'AT' })).toBeNull()
    const { name: _n, ...ohneName } = elektro
    expect(firmaAusPhoton(ohneName)).toBeNull()
  })

  it('unbekannte Art: kein Gewerk geraten, Anschrift fehlt ohne Straße', () => {
    const { street: _s, ...ohneStrasse } = elektro
    const f = firmaAusPhoton({ ...ohneStrasse, osm_key: 'office', osm_value: 'company' })
    expect(f).toMatchObject({ gewerk: null, adresse: null })
  })
})

it('sortiereFirmen: Handwerk zuerst, Doppelte raus', () => {
  const a = firmaAusPhoton({ ...elektro, osm_key: 'office', osm_value: 'company', osm_id: 2 })!
  const b = firmaAusPhoton(elektro)!
  expect(sortiereFirmen([a, b, b]).map((f) => f.osm)).toEqual(['N101', 'N2'])
})

describe('kontaktAusTags', () => {
  it('erste von mehreren Nummern, Webseite mit https', () => {
    expect(
      kontaktAusTags({
        phone: '+49 999 123456;+49 999 654321',
        'contact:email': 'info@elektro-muster.example',
        website: 'elektro-muster.example',
      }),
    ).toEqual({
      telefon: '+49 999 123456',
      email: 'info@elektro-muster.example',
      webseite: 'https://elektro-muster.example',
    })
  })

  it('ohne Merkmale alles leer', () => {
    expect(kontaktAusTags(undefined)).toEqual({ telefon: null, email: null, webseite: null })
  })
})
