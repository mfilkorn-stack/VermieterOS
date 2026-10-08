import type { Gewerk } from '@vermieteros/schema'
import { adresseAusPhoton, type Adresse } from './adresse'

/**
 * Firmensuche für das Handwerkerverzeichnis. Vorschläge kommen wie bei der Adresssuche von
 * Photon (OpenStreetMap-Einträge mit Namen), Telefon, E-Mail und Webseite erst nach der
 * Auswahl einer Firma von Nominatim (ein Abruf je Auswahl, wie es dessen Nutzungsregeln
 * verlangen). Es geht nur der Suchtext bzw. die Kennung des Eintrags raus.
 *   FIRMENSUCHE=aus                 abschalten
 *   ADRESSSUCHE_URL                 eigener Photon-Server (gemeinsam mit der Adresssuche)
 *   FIRMENSUCHE_DETAILS_URL         eigener Nominatim-Server
 */
export type Firma = {
  /** OpenStreetMap-Kennung, z. B. „N123“, für den Abruf der Kontaktdaten */
  osm: string
  name: string
  adresse: Adresse | null
  gewerk: Gewerk | null
  /** z. B. „craft=electrician“, für die Anzeige */
  art: string
}

export type Kontakt = { telefon: string | null; email: string | null; webseite: string | null }

type Photon = {
  osm_type?: string
  osm_id?: number
  osm_key?: string
  osm_value?: string
  name?: string
  countrycode?: string
} & Parameters<typeof adresseAusPhoton>[0]

/** OSM-Merkmal → Gewerk im Verzeichnis; nur eindeutige Fälle, sonst bleibt die Wahl offen. */
const GEWERK_AUS_OSM: Record<string, Gewerk> = {
  'craft=electrician': 'elektro',
  'craft=plumber': 'heizung_sanitaer',
  'craft=hvac': 'heizung_sanitaer',
  'craft=heating_engineer': 'heizung_sanitaer',
  'craft=locksmith': 'schluesseldienst',
  'shop=locksmith': 'schluesseldienst',
  'craft=key_cutter': 'schluesseldienst',
  'craft=roofer': 'dach_fassade',
  'craft=window_construction': 'fenster_tueren',
  'craft=glaziery': 'fenster_tueren',
  'craft=painter': 'maler_boden',
  'craft=floorer': 'maler_boden',
  'craft=tiler': 'maler_boden',
  'craft=parquet_layer': 'maler_boden',
  'craft=gardener': 'garten',
  'craft=landscape_gardener': 'garten',
  'craft=cleaning': 'reinigung',
  'office=cleaning': 'reinigung',
  'craft=caretaker': 'hausmeister',
}

/** Was keine Firma ist: Straßen, Orte, Grenzen, Gebäude ohne Nutzung. */
const KEINE_FIRMA = new Set(['place', 'highway', 'boundary', 'building', 'landuse', 'natural'])

export function firmaAusPhoton(p: Photon): Firma | null {
  if (p.countrycode?.toUpperCase() !== 'DE') return null
  if (!p.name || !p.osm_type || !p.osm_id || !p.osm_key || KEINE_FIRMA.has(p.osm_key)) return null
  const art = p.osm_key + '=' + (p.osm_value ?? '')
  // Die Anschrift einer Firma steht in street/housenumber, nicht im Namen.
  const adresse = adresseAusPhoton({ ...p, type: 'house' })
  return {
    osm: p.osm_type.toUpperCase().slice(0, 1) + p.osm_id,
    name: p.name,
    adresse,
    gewerk: GEWERK_AUS_OSM[art] ?? null,
    art,
  }
}

/** Handwerksbetriebe und Läden zuerst, dann Büros, dann der Rest. */
function rang(f: Firma): number {
  if (f.art.startsWith('craft=')) return 0
  if (f.art.startsWith('shop=') || f.art.startsWith('office=')) return 1
  return 2
}

export function sortiereFirmen(liste: Firma[]): Firma[] {
  const gesehen = new Set<string>()
  return liste
    .filter((f) => (gesehen.has(f.osm) ? false : (gesehen.add(f.osm), true)))
    .sort((a, b) => rang(a) - rang(b))
}

/** Kontaktdaten aus den OSM-Merkmalen (phone, contact:phone, …). Nur http(s)-Webseiten. */
export function kontaktAusTags(t: Record<string, string> | undefined): Kontakt {
  const wert = (...k: string[]) =>
    k
      .map((x) => t?.[x])
      .find((v) => v)
      // mehrere Nummern sind in OSM mit „;“ getrennt: die erste nehmen
      ?.split(';')[0]
      ?.trim() || null
  const web = wert('website', 'contact:website', 'url')
  return {
    telefon: wert('phone', 'contact:phone', 'contact:mobile'),
    email: wert('email', 'contact:email'),
    webseite: web && /^https?:\/\//i.test(web) ? web : web ? 'https://' + web : null,
  }
}

export function firmensucheAn(): boolean {
  return process.env['FIRMENSUCHE'] !== 'aus'
}

const KENNUNG = 'Vermieter.OS (Handwerkerverzeichnis)'

export async function sucheFirmen(text: string): Promise<Firma[]> {
  const url = new URL('/api/', process.env['ADRESSSUCHE_URL'] || 'https://photon.komoot.io')
  url.searchParams.set('q', text)
  url.searchParams.set('lang', 'de')
  url.searchParams.set('limit', '15')
  url.searchParams.set('bbox', '5.8,47.2,15.1,55.1')
  const r = await fetch(url, {
    headers: { 'user-agent': KENNUNG },
    signal: AbortSignal.timeout(4000),
    cache: 'no-store',
  })
  if (!r.ok) throw new Error('Firmensuche: HTTP ' + r.status)
  const j = (await r.json()) as { features?: Array<{ properties?: Photon }> }
  const liste = (j.features ?? [])
    .map((f) => firmaAusPhoton(f.properties ?? {}))
    .filter((f): f is Firma => f !== null)
  return sortiereFirmen(liste).slice(0, 6)
}

export async function kontaktZuFirma(osm: string): Promise<Kontakt> {
  if (!/^[NWR]\d{1,15}$/.test(osm)) throw new Error('Ungültige Kennung')
  const url = new URL(
    '/lookup',
    process.env['FIRMENSUCHE_DETAILS_URL'] || 'https://nominatim.openstreetmap.org',
  )
  url.searchParams.set('osm_ids', osm)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('extratags', '1')
  const r = await fetch(url, {
    headers: { 'user-agent': KENNUNG, 'accept-language': 'de' },
    signal: AbortSignal.timeout(4000),
    cache: 'no-store',
  })
  if (!r.ok) throw new Error('Firmendetails: HTTP ' + r.status)
  const j = (await r.json()) as Array<{ extratags?: Record<string, string> }>
  return kontaktAusTags(j[0]?.extratags)
}
