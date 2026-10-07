import { s3Speicher, speicherKonfigAusUmgebung, type Speicher } from '@vermieteros/post'

/**
 * Object Storage für Downloads und Uploads. Erst beim ersten Gebrauch konfiguriert. Den Bucket
 * legt sonst der Worker beim Start an; legt die App zuerst ab (frische Umgebung), stellt sie ihn
 * einmalig selbst sicher.
 */
let speicher: Speicher | undefined
let bereit: Promise<void> | undefined
export function objektSpeicher(): Speicher {
  if (!speicher) {
    const s3 = s3Speicher(speicherKonfigAusUmgebung())
    speicher = {
      holen: (schluessel) => s3.holen(schluessel),
      async ablegen(...args) {
        bereit ??= s3.bucketSicherstellen().catch((e: unknown) => {
          bereit = undefined
          throw e
        })
        await bereit
        return s3.ablegen(...args)
      },
    }
  }
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
