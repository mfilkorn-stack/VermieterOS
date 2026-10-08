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

export function starteAdresseAttrappe(port: number): Promise<Server> {
  const server = createServer((req, res) => {
    const q = new URL(req.url ?? '/', 'http://x').searchParams.get('q') ?? ''
    const treffer = /muster/i.test(q) ? MUSTER : []
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
