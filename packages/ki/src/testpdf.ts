/**
 * Erzeugt ein kleines PDF mit Textebene, für Tests und die Vorschau (keine echten Verträge im
 * Repository). Eine Seite je Eintrag, eine Zeile je String; Helvetica mit WinAnsi-Kodierung.
 */
export function musterPdf(seiten: string[][]): Uint8Array {
  const winAnsi = (t: string) =>
    Array.from(t, (z) => (z === '€' ? '\x80' : z))
      .join('')
      .replace(/[\\()]/g, (z) => `\\${z}`)
  const objekte: string[] = []
  const seitenIds: number[] = []
  // 1: Katalog, 2: Seitenbaum, 3: Schrift; danach je Seite Inhalt und Seite
  objekte[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
  let n = 4
  for (const zeilen of seiten) {
    const text = zeilen
      .map((z, i) => `BT /F1 11 Tf 56 ${780 - i * 16} Td (${winAnsi(z)}) Tj ET`)
      .join('\n')
    objekte[n] = `<< /Length ${Buffer.byteLength(text, 'latin1')} >>\nstream\n${text}\nendstream`
    objekte[n + 1] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${n} 0 R >>`
    seitenIds.push(n + 1)
    n += 2
  }
  objekte[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objekte[2] = `<< /Type /Pages /Kids [${seitenIds.map((i) => `${i} 0 R`).join(' ')}] /Count ${seitenIds.length} >>`
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  for (let i = 1; i < objekte.length; i++) {
    offsets[i] = Buffer.byteLength(pdf, 'latin1')
    pdf += `${i} 0 obj\n${objekte[i]}\nendobj\n`
  }
  const xref = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 ${objekte.length}\n0000000000 65535 f \n`
  for (let i = 1; i < objekte.length; i++)
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objekte.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new Uint8Array(Buffer.from(pdf, 'latin1'))
}

/** Muster-Mietvertrag ohne echte Daten: zwei Seiten, Eckdaten auf Seite 2. */
export function musterMietvertrag(): Uint8Array {
  return musterPdf([
    [
      'Wohnraummietvertrag (Muster)',
      'Zwischen Vermieter Muster und Mieterin Erika Beispiel',
      'wird folgender Mietvertrag geschlossen.',
    ],
    [
      '§ 2 Mietzeit: Das Mietverhältnis beginnt am 01.09.2021.',
      '§ 3 Miete: Die Nettokaltmiete beträgt 650,00 € monatlich.',
      'Vorauszahlung Betriebskosten: 120,00 € monatlich.',
      'Vorauszahlung Heizkosten: 80,00 € monatlich.',
      '§ 5 Kaution: Die Mieterin leistet eine Kaution von 1.950,00 €.',
      '§ 6 Kündigung: Die Kündigungsfrist beträgt drei Monate.',
    ],
  ])
}

/** Muster-Rechnung ohne echte Daten (Wasser, umlagefähig), für Tests und die Vorschau. */
export function musterRechnung(): Uint8Array {
  return musterPdf([
    [
      'Stadtwerke Musterstadt GmbH',
      'Jahresrechnung Trinkwasser Nr. W-2026-0815',
      'Rechnungsdatum: 05.01.2026',
      'Verbrauchsstelle: Musterweg 1, 99999 Musterstadt',
      'Abrechnungszeitraum: 01.01.2025 bis 31.12.2025',
      'Nettobetrag: 450,00 €',
      'Umsatzsteuer 7 %: 31,50 €',
      'Rechnungsbetrag: 481,50 €',
      'Der Betrag wird am 15.01.2026 von Ihrem Konto abgebucht.',
    ],
  ])
}

/** Muster-Rechnung Steuerberatung für alle Objekte (Verwaltungskosten, aufzuteilen). */
export function musterSteuerberatung(): Uint8Array {
  return musterPdf([
    [
      'Steuerkanzlei Muster',
      'Rechnung Nr. SB-26-031 vom 20.03.2026',
      'Erstellung Anlage V für das Jahr 2025, alle Objekte',
      'Honorar netto: 600,00 €',
      'Umsatzsteuer 19 %: 114,00 €',
      'Rechnungsbetrag: 714,00 €',
    ],
  ])
}
