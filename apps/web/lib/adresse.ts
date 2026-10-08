import { BUNDESLAND_NAME, type Bundesland } from '@vermieteros/schema'

/**
 * Adresssuche über Photon (OpenStreetMap, https://photon.komoot.io). Abgefragt wird nur der
 * eingegebene Suchtext, vom Server aus: Der Dienst sieht weder Nutzer noch IP des Browsers.
 *   ADRESSSUCHE_URL  eigener Photon-Server statt der öffentlichen Instanz
 *   ADRESSSUCHE=aus  Suche abschalten, die Felder bleiben normal ausfüllbar
 */
export type Adresse = {
  strasse: string
  hausnummer: string | null
  plz: string
  ort: string
  bundesland: Bundesland | null
}

type PhotonEigenschaften = {
  countrycode?: string
  type?: string
  name?: string
  street?: string
  housenumber?: string
  postcode?: string
  city?: string
  town?: string
  village?: string
  district?: string
  state?: string
}

const NACH_NAME = new Map(
  Object.entries(BUNDESLAND_NAME).map(([kuerzel, name]) => [name, kuerzel as Bundesland]),
)

/**
 * Ein Treffer von Photon als Adresse; null, wenn er keine vollständige deutsche Anschrift ist
 * (Straße, fünfstellige PLZ, Ort). Straßen ohne Hausnummer zählen, die Nummer ergänzt man selbst.
 */
export function adresseAusPhoton(p: PhotonEigenschaften): Adresse | null {
  if (p.countrycode?.toUpperCase() !== 'DE') return null
  const strasse = p.type === 'street' ? p.name : p.street
  const ort = p.city ?? p.town ?? p.village
  if (!strasse || !ort || !p.postcode || !/^\d{5}$/.test(p.postcode)) return null
  return {
    strasse,
    hausnummer: p.type === 'house' ? (p.housenumber ?? null) : null,
    plz: p.postcode,
    ort,
    bundesland: (p.state && NACH_NAME.get(p.state)) || null,
  }
}

/** Gleiche Anschrift nur einmal (Photon liefert Gebäude und Eingänge oft doppelt). */
export function eindeutig(liste: Adresse[]): Adresse[] {
  const gesehen = new Set<string>()
  return liste.filter((a) => {
    const k = [a.strasse, a.hausnummer ?? '', a.plz, a.ort].join('|')
    if (gesehen.has(k)) return false
    gesehen.add(k)
    return true
  })
}

export function adresssucheAn(): boolean {
  return process.env['ADRESSSUCHE'] !== 'aus'
}

export async function sucheAdressen(text: string): Promise<Adresse[]> {
  const basis = process.env['ADRESSSUCHE_URL'] || 'https://photon.komoot.io'
  const url = new URL('/api/', basis)
  url.searchParams.set('q', text)
  url.searchParams.set('lang', 'de')
  url.searchParams.set('limit', '10')
  url.searchParams.append('layer', 'house')
  url.searchParams.append('layer', 'street')
  // Deutschland grob, damit Treffer im Ausland die Liste nicht füllen
  url.searchParams.set('bbox', '5.8,47.2,15.1,55.1')
  const antwort = await fetch(url, {
    headers: { 'user-agent': 'Vermieter.OS (Adresssuche)' },
    signal: AbortSignal.timeout(4000),
    cache: 'no-store',
  })
  if (!antwort.ok) throw new Error(`Adresssuche: HTTP ${antwort.status}`)
  const json = (await antwort.json()) as { features?: Array<{ properties?: PhotonEigenschaften }> }
  const treffer = (json.features ?? [])
    .map((f) => adresseAusPhoton(f.properties ?? {}))
    .filter((a): a is Adresse => a != null)
  return eindeutig(treffer).slice(0, 6)
}
