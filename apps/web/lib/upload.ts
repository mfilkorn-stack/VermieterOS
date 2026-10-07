import { ERLAUBTE_TYPEN } from './dokument-text'
import { Eingabefehler } from './eingabe'

/**
 * Hochgeladene Datei vor der Ablage vereinheitlichen. iPhone-Fotos kommen als HEIC; das zeigen
 * Browser außer Safari nicht an und die KI liest es nicht. Deshalb wird HEIC beim Hochladen zu
 * JPEG umgewandelt, alles danach (Vorschau, Belegprüfung, KI) sieht nur noch JPEG.
 */
export type Upload = { inhalt: Buffer; mime: string; dateiname: string }

/** Varianten, die Browser und Mailprogramme für JPEG und HEIC melden. */
const MIME_ALIAS: Record<string, string> = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/heif': 'image/heic',
  'image/heic-sequence': 'image/heic',
  'image/heif-sequence': 'image/heic',
}

const ENDUNG_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heic',
}

/** HEIF-Container: Bytes 4 bis 11 sind „ftyp“ und eine HEIC/HEIF-Marke. */
const HEIF_MARKEN = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'])

export function istHeic(inhalt: Uint8Array): boolean {
  if (inhalt.length < 12) return false
  const ascii = (von: number, bis: number) => String.fromCharCode(...inhalt.subarray(von, bis))
  return ascii(4, 8) === 'ftyp' && HEIF_MARKEN.has(ascii(8, 12))
}

/**
 * Inhaltstyp aus Angabe des Browsers, Dateiendung und Dateianfang. Windows-Browser melden HEIC
 * oft leer oder als `application/octet-stream`; der Dateianfang entscheidet dann.
 */
export function mimeErmitteln(gemeldet: string, dateiname: string, inhalt: Uint8Array): string {
  if (istHeic(inhalt)) return 'image/heic'
  const typ = gemeldet.trim().toLowerCase()
  if (typ && typ !== 'application/octet-stream') return MIME_ALIAS[typ] ?? typ
  const endung = dateiname.toLowerCase().split('.').pop() ?? ''
  return ENDUNG_MIME[endung] ?? (typ || 'application/octet-stream')
}

/** Dateiname mit neuer Endung: „IMG_0815.HEIC“ → „IMG_0815.jpg“. */
export function mitEndung(dateiname: string, endung: string): string {
  const punkt = dateiname.lastIndexOf('.')
  return `${punkt > 0 ? dateiname.slice(0, punkt) : dateiname}.${endung}`
}

export async function heicZuJpeg(inhalt: Uint8Array): Promise<Buffer> {
  // Erst bei Bedarf laden: der Decoder bringt WebAssembly mit.
  const { default: convert } = await import('heic-convert')
  try {
    return Buffer.from(await convert({ buffer: inhalt, format: 'JPEG', quality: 0.9 }))
  } catch {
    throw new Eingabefehler('Das HEIC-Foto ließ sich nicht lesen. Bitte als JPG exportieren.')
  }
}

/**
 * Datei lesen, Typ ermitteln, HEIC umwandeln und gegen die erlaubten Typen prüfen.
 * `erlaubt` enthält nur Zieltypen; HEIC ist immer zulässig, weil es zu JPEG wird.
 */
export async function uploadVorbereiten(
  datei: File,
  erlaubt: ReadonlySet<string>,
  fehlertext: string,
): Promise<Upload> {
  const roh = new Uint8Array(await datei.arrayBuffer())
  const mime = mimeErmitteln(datei.type, datei.name, roh)
  if (mime === 'image/heic' && erlaubt.has('image/jpeg')) {
    return {
      inhalt: await heicZuJpeg(roh),
      mime: 'image/jpeg',
      dateiname: mitEndung(datei.name, 'jpg'),
    }
  }
  if (!erlaubt.has(mime)) throw new Eingabefehler(fehlertext)
  return { inhalt: Buffer.from(roh), mime, dateiname: datei.name }
}

/** Kann ein Mail-Anhang als Dokument abgelegt werden? HEIC ja, es wird dabei zu JPEG. */
export function ablegbar(mime: string, dateiname: string): boolean {
  const typ = mimeErmitteln(mime, dateiname, new Uint8Array())
  return typ === 'image/heic' || ERLAUBTE_TYPEN.has(typ)
}
