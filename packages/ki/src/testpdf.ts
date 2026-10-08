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

/**
 * Muster-Kaufvertrag ohne echte Daten: Eigentumswohnung mit separatem Stellplatz (zwei
 * Grundbuchblätter), ausdrückliche Aufteilung des Kaufpreises, Übergang an die Zahlung gebunden.
 */
export function musterKaufvertrag(): Uint8Array {
  return musterPdf([
    [
      'Urkundenrolle Nr. 999/2021 (Muster)',
      'Verhandelt zu Musterstadt am 30.04.2021',
      'Kaufvertrag über Wohnungseigentum und Teileigentum',
      'zwischen Verkäufer Muster und Käufer Beispiel.',
    ],
    [
      '§ 1 Grundbuchstand',
      'Wohnungsgrundbuch des Amtsgerichts Musterstadt von Musterdorf Blatt W-1:',
      '88,89/1.000 Miteigentumsanteil an Flurstück A mit 464 m² und Flurstück B mit 331 m²,',
      'verbunden mit dem Sondereigentum an der Wohnung Nr. 3.',
      'Teileigentumsgrundbuch des Amtsgerichts Musterstadt von Musterdorf Blatt G-2:',
      'Stellplatz auf Flurstück C mit 14 m² im Alleineigentum.',
    ],
    [
      '§ 3 Kaufpreis',
      'Der Kaufpreis beträgt 187.000,00 €.',
      'Davon entfallen auf den Grund und Boden 37.400,00 €.',
      'Mitverkauft ist eine Einbauküche, die mit 3.000,00 € bewertet wird.',
      '§ 4 Besitzübergang',
      'Besitz, Nutzen und Lasten gehen mit vollständiger Zahlung des Kaufpreises über.',
    ],
  ])
}

/**
 * Muster eines nicht ausgefüllten Vertragsformulars mit typischen Fallen: leere Felder, Inklusivmiete
 * als Grundfall, Vorauszahlungen je Kostenart, Sonderkündigungsfrist statt ordentlicher Frist,
 * Begrenzung der Modernisierungsumlage. Nachgebaut, kein Originaltext.
 */
export function musterLeererMietvertrag(): Uint8Array {
  return musterPdf([
    [
      'Wohnungs-Mietvertrag (Muster, nicht ausgefüllt)',
      'Zwischen ____________________ als Vermieter/in',
      'und ____________________ als Mieter/in',
      '§ 1 Mieträume: Die Wohnfläche beträgt ______ qm.',
      '§ 2 Mietzeit: Das Mietverhältnis wird auf unbestimmte Zeit abgeschlossen. Es beginnt am: ________',
      'Eigenbedarfs- und Verwertungskündigungen sind für ______ Jahre ausgeschlossen.',
    ],
    [
      '§ 3 Miete: Die Miete beträgt je Monat: ____________ €.',
      'Die Miete kann für den Zeitraum von ______ Jahren nicht erhöht werden.',
      'Mit dieser Mietzahlung sind sämtliche Betriebskosten abgegolten,',
      'sofern nicht die nachfolgende Regelung vereinbart wird.',
      'Monatliche Vorauszahlung:',
      'Heizungs- und Warmwasserkosten ________ €',
      'Frischwasserkosten ________ €',
      'Müllabfuhrkosten ________ €',
      'Für die oben aufgeführten Nebenkosten leistet der Mieter eine Pauschalzahlung.',
    ],
    [
      '§ 8 Untervermietung: Verweigert der Vermieter die Erlaubnis zur Untervermietung,',
      'kann der Mieter das Mietverhältnis mit einmonatiger Kündigungsfrist aufkündigen.',
      '§ 10 Modernisierung: Die Mieterhöhung ist auf 5,5 % der Kosten beschränkt.',
    ],
  ])
}

/**
 * Ausgefüllter Muster-Mietvertrag mit Kaltmiete, Stellplatz, einer Betriebskosten-Vorauszahlung
 * ohne getrennte Heizkosten, Gesamtmiete, „Mietsicherheit“ und Kündigung nach Gesetz.
 * Nachgebaut nach dem Aufbau verbreiteter Formulare, kein Originaltext.
 */
export function musterMietvertragGesamtmiete(): Uint8Array {
  return musterPdf([
    [
      'Mietvertrag für Wohnraum (Muster)',
      'Vermieter: Vermieter Muster, Musterweg 1, 99999 Musterstadt',
      'Mieter: Max Beispiel',
      '§ 1 Mieträume: Wohnung im 2. OG links, Musterweg 1, 99999 Musterstadt',
    ],
    [
      '§ 2 Mietzins und Nebenkosten',
      'Die monatliche Kaltmiete beträgt 720,00 €',
      'Die Kosten für Garage/Stellplatz/Carport betragen monatlich 45,00 €',
      'Die monatlich mit der Miete zu entrichtende Betriebskostenvorauszahlung beträgt 180,00 €',
      'Die insgesamt inklusive der Betriebskostenvorauszahlung zu entrichtende Miete beträgt 945,00 €',
      '§ 4 Mietdauer: Das Mietverhältnis beginnt am 01.03.2024 und läuft auf unbestimmte Zeit.',
      'Das Kündigungsrecht bestimmt sich nach den gesetzlichen Vorschriften.',
      '§ 5 Mietsicherheit: Der Mieter hinterlegt eine Mietsicherheit in Höhe von 2.160,00 €.',
    ],
  ])
}

/**
 * Muster eines Formularvertrags mit Vorauszahlungen je Kostenart und Summe, Heizkosten „siehe
 * Anlage“, aufgedruckten Seitenzahlen, die nicht den PDF-Seiten entsprechen, und einer
 * Bedingung für die Wirksamkeit. Synthetische Werte, nachgebaut, kein Originaltext.
 */
export function musterMietvertragFormular(): Uint8Array {
  return musterPdf([
    [
      'Vertrag zur Vermietung einer Eigentumswohnung (Muster)',
      'Zwischen Vermieter Muster und Mieterin Erika Beispiel',
      '§ 2 Mietzeit: Das Mietverhältnis beginnt am 01.06.2023.',
    ],
    [
      '- 2 -',
      '§ 3 Miete: Die Grundmiete beträgt monatlich EUR 510,-',
      'a) Heizkosten siehe Anlage',
      'b) Wasserversorgung und Entwässerung EUR 31,-',
      'c) Müllbeseitigung EUR 12,-',
      'g) Sach- und Haftpflichtversicherung EUR 22,-',
      'p) sonstige Betriebskosten (Verwaltung) EUR 100,-',
      'Monatl. Vorauszahlung auf die Betriebskosten EUR 165,-',
      'Gesamtmiete monatlich EUR 675,-',
      '- 3 -',
      '§ 8 Mietsicherheit: Der Mieter zahlt eine Kaution von 1.530 EUR.',
    ],
    [
      '§ 22 Sonstige Vereinbarungen',
      'Der Vertrag wird erst wirksam nach Zusage der Kostenübernahme für Miete und Kaution durch das Sozialamt.',
    ],
  ])
}
