import { createServer, type Server } from 'node:http'

/**
 * Ersatz für Photon (Adresssuche) in E2E-Tests und Vorschau: feste Musteradressen, dazu ein
 * Doppelter und ein Treffer im Ausland, die die App herausfiltern muss.
 */
const MUSTER = [
  {
    countrycode: 'DE',
    type: 'house',
    street: 'Musterstraße',
    housenumber: '1',
    postcode: '99999',
    city: 'Musterstadt',
    state: 'Nordrhein-Westfalen',
  },
  {
    countrycode: 'DE',
    type: 'house',
    street: 'Musterstraße',
    housenumber: '1',
    postcode: '99999',
    city: 'Musterstadt',
    state: 'Nordrhein-Westfalen',
  },
  {
    countrycode: 'DE',
    type: 'street',
    name: 'Musterweg',
    postcode: '99998',
    city: 'Beispielstadt',
    state: 'Bayern',
  },
  {
    countrycode: 'AT',
    type: 'house',
    street: 'Mustergasse',
    housenumber: '2',
    postcode: '9999',
    city: 'Musterdorf',
  },
]

/** Handwerksbetriebe (Photon) und ihre Kontaktdaten (Nominatim /lookup), synthetisch. */
const FIRMEN = [
  {
    countrycode: 'DE',
    type: 'house',
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
  },
  // keine Firma: muss herausgefiltert werden
  {
    countrycode: 'DE',
    type: 'street',
    osm_type: 'W',
    osm_id: 7,
    osm_key: 'highway',
    osm_value: 'residential',
    name: 'Elektrostraße',
    postcode: '99999',
    city: 'Musterstadt',
  },
]
const KONTAKT: Record<string, Record<string, string>> = {
  N101: {
    phone: '+49 999 123456;+49 999 654321',
    email: 'info@elektro-muster.example',
    website: 'elektro-muster.example',
  },
}

export function starteAdresseAttrappe(port: number): Promise<Server> {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x')
    if (url.pathname === '/lookup') {
      const id = url.searchParams.get('osm_ids') ?? ''
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(KONTAKT[id] ? [{ extratags: KONTAKT[id] }] : []))
      return
    }
    const q = url.searchParams.get('q') ?? ''
    const treffer = /elektro/i.test(q) ? FIRMEN : /muster/i.test(q) ? MUSTER : []
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(
      JSON.stringify({
        type: 'FeatureCollection',
        features: treffer.map((properties) => ({ type: 'Feature', properties })),
      }),
    )
  })
  return new Promise((r) => server.listen(port, '127.0.0.1', () => r(server)))
}
