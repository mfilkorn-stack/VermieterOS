import { extractText, getDocumentProxy } from 'unpdf'

/** Text je Seite eines PDFs (Seite 1 = Index 0). Leere Seiten sind Scans ohne Textebene. */
export async function seitenTexte(pdf: Uint8Array): Promise<string[]> {
  // pdf.js übernimmt den Puffer; eine Kopie schützt den Aufrufer.
  const dok = await getDocumentProxy(new Uint8Array(pdf))
  const { text } = await extractText(dok, { mergePages: false })
  return Array.isArray(text) ? text : [text]
}

/** Vergleichsform: ohne Leerraum, Silbentrennung und typografische Varianten. */
export function vergleichsform(t: string): string {
  return t
    .toLowerCase()
    .replace(/­/g, '')
    .replace(/[„“”"]/g, '"')
    .replace(/[‚‘’']/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/-\s+/g, '')
    .replace(/\s+/g, '')
}
