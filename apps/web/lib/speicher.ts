import { s3Speicher, speicherKonfigAusUmgebung, type Speicher } from '@vermieteros/post'

/** Object Storage für Downloads (Mails, Anhänge). Erst beim ersten Gebrauch konfiguriert. */
let speicher: Speicher | undefined
export function objektSpeicher(): Speicher {
  speicher ??= s3Speicher(speicherKonfigAusUmgebung())
  return speicher
}

/** Inhaltstypen, die der Browser gefahrlos anzeigen darf; alles andere als Binärdatei. */
const SICHER = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'text/plain',
  'message/rfc822',
])

/**
 * Antwort für einen Download aus dem Object Storage. Immer als Anhang, nie eingebettet:
 * eine HTML- oder SVG-Datei aus einer Mail darf nicht im Kontext der App laufen.
 */
export function downloadAntwort(inhalt: Buffer, dateiname: string, mimeTyp: string): Response {
  const typ = SICHER.has(mimeTyp.toLowerCase()) ? mimeTyp : 'application/octet-stream'
  const ascii = dateiname.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return new Response(new Uint8Array(inhalt), {
    headers: {
      'Content-Type': typ,
      'Content-Length': String(inhalt.length),
      'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(dateiname)}`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "sandbox; default-src 'none'",
      'Cache-Control': 'private, no-store',
    },
  })
}
