import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib'

/**
 * Geschäftsbrief nach DIN 5008, Form B, als PDF. Bewusst schlicht: Standardschrift Helvetica
 * (WinAnsi, deckt Umlaute, ß, €, § und deutsche Anführungszeichen ab), keine Bilder.
 * Die Ausgabe ist für dieselben Daten byte-gleich: Metadaten-Daten kommen aus dem Brief,
 * nicht aus der Uhr. So lässt sich ein ausgestelltes Schreiben später über die Prüfsumme belegen.
 */

export type Block =
  | { art: 'text'; text: string; fett?: boolean }
  | { art: 'felder'; zeilen: Array<readonly [string, string]> }
  | { art: 'hinweis'; text: string }
  | { art: 'abstand' }
  | { art: 'unterschrift'; zeilen: string[] }

export type Brief = {
  /** Absender: erste Zeile Name, dann Anschrift */
  absender: string[]
  /** Empfänger; leer bei Bescheinigungen „zur Vorlage“ */
  empfaenger: string[]
  ort: string | null
  /** ISO-Datum des Schreibens */
  datum: string
  betreff: string
  bloecke: Block[]
  /** Titel in den PDF-Metadaten */
  titel: string
}

const MM = 72 / 25.4
const BREITE = 210 * MM
const HOEHE = 297 * MM
const LINKS = 25 * MM
const RECHTS = 20 * MM
const UNTEN = 25 * MM
const SATZBREITE = BREITE - LINKS - RECHTS
const GROESSE = 10.5
const ZEILE = 14.5
const GRAU = rgb(0.35, 0.37, 0.4)

function datumDeutsch(iso: string): string {
  const [j, m, t] = iso.split('-')
  return `${t}.${m}.${j}`
}

/** Ersetzt Zeichen, die die Standardschrift nicht kodieren kann, statt abzubrechen. */
function sicher(font: PDFFont, text: string): string {
  const vorhanden = new Set(font.getCharacterSet())
  return Array.from(text.replace(/\t/g, ' '), (z) =>
    vorhanden.has(z.codePointAt(0)!) ? z : '?',
  ).join('')
}

/** Bricht Text an Wortgrenzen um; harte Zeilenumbrüche bleiben. */
export function umbrechen(font: PDFFont, text: string, groesse: number, breite: number): string[] {
  const zeilen: string[] = []
  for (const absatz of text.split('\n')) {
    let zeile = ''
    for (const wort of absatz.split(/ +/)) {
      const versuch = zeile ? `${zeile} ${wort}` : wort
      if (font.widthOfTextAtSize(versuch, groesse) <= breite || !zeile) {
        zeile = versuch
      } else {
        zeilen.push(zeile)
        zeile = wort
      }
    }
    zeilen.push(zeile)
  }
  return zeilen
}

export async function briefPdf(b: Brief): Promise<Uint8Array> {
  const doc = await PDFDocument.create({ updateMetadata: false })
  const zeitpunkt = new Date(`${b.datum}T12:00:00Z`)
  doc.setTitle(b.titel)
  doc.setProducer('Vermieter.OS')
  doc.setCreator('Vermieter.OS')
  doc.setCreationDate(zeitpunkt)
  doc.setModificationDate(zeitpunkt)
  doc.setLanguage('de-DE')
  const normal = await doc.embedFont(StandardFonts.Helvetica)
  const fett = await doc.embedFont(StandardFonts.HelveticaBold)

  let seite: PDFPage = doc.addPage([BREITE, HOEHE])
  /** y von oben in mm → PDF-Koordinate */
  const oben = (mm: number) => HOEHE - mm * MM
  const schreibe = (
    p: PDFPage,
    text: string,
    x: number,
    y: number,
    o: { font?: PDFFont; groesse?: number; grau?: boolean } = {},
  ) => {
    const font = o.font ?? normal
    p.drawText(sicher(font, text), {
      x,
      y,
      size: o.groesse ?? GROESSE,
      font,
      color: o.grau ? GRAU : rgb(0, 0, 0),
    })
  }

  // Rücksendeangabe und Anschriftfeld (45 mm von oben, 85 mm breit)
  const ruecksende = b.absender.join(' · ')
  if (b.empfaenger.length > 0) {
    schreibe(seite, ruecksende, LINKS, oben(50), { groesse: 7, grau: true })
    b.empfaenger.forEach((z, i) => schreibe(seite, z, LINKS, oben(62.7) - i * ZEILE))
  }
  // Informationsblock rechts: Absender, Ort und Datum
  const infoX = 125 * MM
  b.absender.forEach((z, i) =>
    schreibe(seite, z, infoX, oben(50) - i * 12, { groesse: 9, font: i === 0 ? fett : normal }),
  )
  const datumZeile = [b.ort, datumDeutsch(b.datum)].filter(Boolean).join(', ')
  schreibe(seite, datumZeile, infoX, oben(50) - (b.absender.length + 1) * 12, { groesse: 9 })

  // Betreff und Text
  let y = oben(98.5)
  for (const z of umbrechen(fett, b.betreff, 12, SATZBREITE)) {
    schreibe(seite, z, LINKS, y, { font: fett, groesse: 12 })
    y -= 16
  }
  y -= ZEILE

  const platz = (hoehe: number) => {
    if (y - hoehe < UNTEN) {
      seite = doc.addPage([BREITE, HOEHE])
      y = oben(25)
    }
  }

  for (const block of b.bloecke) {
    if (block.art === 'abstand') {
      y -= ZEILE
      continue
    }
    if (block.art === 'text' || block.art === 'hinweis') {
      const font = block.art === 'text' && block.fett ? fett : normal
      const groesse = block.art === 'hinweis' ? 8.5 : GROESSE
      const zeile = block.art === 'hinweis' ? 11.5 : ZEILE
      for (const z of umbrechen(font, block.text, groesse, SATZBREITE)) {
        platz(zeile)
        schreibe(seite, z, LINKS, y, { font, groesse, grau: block.art === 'hinweis' })
        y -= zeile
      }
      y -= zeile * 0.6
      continue
    }
    if (block.art === 'felder') {
      const spalte = 62 * MM
      for (const [label, wert] of block.zeilen) {
        const werte = umbrechen(normal, wert || '–', GROESSE, SATZBREITE - spalte)
        platz(werte.length * ZEILE)
        schreibe(seite, label, LINKS, y, { grau: true })
        werte.forEach((w, i) => schreibe(seite, w, LINKS + spalte, y - i * ZEILE))
        y -= werte.length * ZEILE + 3
      }
      y -= ZEILE * 0.6
      continue
    }
    // Unterschrift: Platz, Linie, Name darunter
    platz(ZEILE * (3 + block.zeilen.length))
    y -= ZEILE * 2.5
    seite.drawLine({
      start: { x: LINKS, y },
      end: { x: LINKS + 80 * MM, y },
      thickness: 0.6,
      color: GRAU,
    })
    y -= ZEILE
    for (const z of block.zeilen) {
      schreibe(seite, z, LINKS, y, { groesse: 9 })
      y -= 12
    }
  }

  // Seitenzahlen ab zwei Seiten
  const seiten = doc.getPages()
  if (seiten.length > 1) {
    seiten.forEach((p, i) =>
      schreibe(p, `Seite ${i + 1} von ${seiten.length}`, BREITE - RECHTS - 60, 12 * MM, {
        groesse: 8,
        grau: true,
      }),
    )
  }
  return doc.save()
}
