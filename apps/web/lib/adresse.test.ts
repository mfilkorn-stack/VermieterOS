import { describe, expect, it } from 'vitest'
import { adresseAusPhoton, eindeutig } from './adresse'

const haus = {
  countrycode: 'DE',
  type: 'house',
  street: 'Musterstraße',
  housenumber: '1',
  postcode: '99999',
  city: 'Musterstadt',
  state: 'Nordrhein-Westfalen',
}

describe('adresseAusPhoton', () => {
  it('Hausadresse mit Bundesland-Kürzel', () => {
    expect(adresseAusPhoton(haus)).toEqual({
      strasse: 'Musterstraße',
      hausnummer: '1',
      plz: '99999',
      ort: 'Musterstadt',
      bundesland: 'NW',
    })
  })

  it('Straße ohne Hausnummer: Name ist die Straße', () => {
    expect(
      adresseAusPhoton({
        countrycode: 'DE',
        type: 'street',
        name: 'Musterweg',
        postcode: '99998',
        town: 'Beispielstadt',
        state: 'Bayern',
      }),
    ).toEqual({
      strasse: 'Musterweg',
      hausnummer: null,
      plz: '99998',
      ort: 'Beispielstadt',
      bundesland: 'BY',
    })
  })

  it('verwirft Ausland, fehlende oder ungültige PLZ und fehlenden Ort', () => {
    expect(adresseAusPhoton({ ...haus, countrycode: 'AT', postcode: '9999' })).toBeNull()
    const { postcode: _p, ...ohnePlz } = haus
    expect(adresseAusPhoton(ohnePlz)).toBeNull()
    expect(adresseAusPhoton({ ...haus, postcode: '9999' })).toBeNull()
    const { city: _c, ...ohneOrt } = haus
    expect(adresseAusPhoton(ohneOrt)).toBeNull()
  })

  it('unbekanntes Bundesland bleibt leer statt geraten', () => {
    expect(adresseAusPhoton({ ...haus, state: 'Unbekannt' })?.bundesland).toBeNull()
  })
})

it('eindeutig entfernt doppelte Anschriften', () => {
  const a = adresseAusPhoton(haus)!
  expect(eindeutig([a, { ...a }, { ...a, hausnummer: '2' }])).toHaveLength(2)
})
