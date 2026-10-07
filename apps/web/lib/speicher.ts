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

/** Eingebettet angezeigt werden nur PDFs und Rasterbilder (Belegvorschau), nie HTML oder SVG. */
const ANSICHT = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])

/**
 * Antwort für einen Download aus dem Object Storage. Standard: als Anhang, nie eingebettet,
 * eine HTML- oder SVG-Datei aus einer Mail darf nicht im Kontext der App laufen. Mit `ansicht`
 * werden PDFs und Bilder eingebettet (Vorschau im Belegeingang); PDFs ohne Sandbox, weil der
 * PDF-Betrachter des Browsers sonst nicht lädt, aber weiterhin ohne eigene Inhalte.
 */
export function downloadAntwort(
  inhalt: Buffer,
  dateiname: string,
  mimeTyp: string,
  ansicht = false,
): Response {
  const typ = SICHER.has(mimeTyp.toLowerCase()) ? mimeTyp : 'application/octet-stream'
  const ascii = dateiname.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  const eingebettet = ansicht && ANSICHT.has(typ)
  return new Response(new Uint8Array(inhalt), {
    headers: {
      'Content-Type': typ,
      'Content-Length': String(inhalt.length),
      'Content-Disposition': `${eingebettet ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(dateiname)}`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy':
        eingebettet && typ === 'application/pdf'
          ? "default-src 'none'; frame-ancestors 'self'"
          : eingebettet
            ? "sandbox; default-src 'none'; frame-ancestors 'self'"
            : "sandbox; default-src 'none'",
      'Cache-Control': 'private, no-store',
    },
  })
}
