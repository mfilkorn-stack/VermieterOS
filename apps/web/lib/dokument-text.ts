import type { DokumentStatus, DokumentTyp } from '@vermieteros/schema'

export const DOKUMENT_TYP_TEXT: Record<DokumentTyp, string> = {
  mietvertrag: 'Mietvertrag',
  nachtrag: 'Nachtrag',
  uebergabeprotokoll: 'Übergabeprotokoll',
  kautionsnachweis: 'Kautionsnachweis',
  wohnungsgeberbestaetigung: 'Wohnungsgeberbestätigung',
  expose: 'Exposé',
  reservierung: 'Reservierungsvereinbarung',
  kaufvertrag: 'Kaufvertrag',
  notarschreiben: 'Notarschreiben (Fälligkeit, Zahlungsbestätigung)',
  vollmacht: 'Vollmacht',
  grunderwerbsteuerbescheid: 'Grunderwerbsteuerbescheid',
  grundbuch: 'Grundbuchauszug',
  grundbuchmitteilung: 'Eintragungsbekanntmachung Grundbuchamt',
  flurkarte: 'Flurkarte / Liegenschaftskataster',
  bodenrichtwert: 'Bodenrichtwertauskunft',
  grundriss: 'Grundriss / Aufteilungsplan',
  energieausweis: 'Energieausweis',
  objektfoto: 'Objektfotos / Fotodokumentation',
  kreditvertrag: 'Kreditvertrag',
  grundschuldbestellung: 'Grundschuldbestellung',
  finanzierung: 'Finanzierungsunterlagen (Selbstauskunft, Angebot)',
  teilungserklaerung: 'Teilungserklärung',
  verwaltervertrag: 'Verwaltervertrag',
  wirtschaftsplan: 'Wirtschaftsplan',
  hausgeldabrechnung: 'Hausgeldabrechnung',
  heizkostenabrechnung: 'Heizkostenabrechnung (Messdienst)',
  betriebskostenabrechnung: 'Betriebskostenabrechnung',
  steuerpaket: 'Steuerpaket (ZIP für den Steuerberater)',
  weg_protokoll: 'Protokoll Eigentümerversammlung',
  hausordnung: 'Hausordnung',
  grundsteuer: 'Grundsteuer (Erklärung, Bescheid)',
  versicherung: 'Versicherung',
  beleg: 'Beleg',
  mietspiegel: 'Mietspiegel',
  bescheinigung: 'Bescheinigung (ausgestellt)',
  mangelfoto: 'Foto zu einer Mängelmeldung',
  sonstiges: 'Sonstiges',
}

/** Gruppen für die Auswahl der Dokumentart; jede Art steht in genau einer Gruppe. */
export const DOKUMENT_GRUPPEN: ReadonlyArray<readonly [string, readonly DokumentTyp[]]> = [
  [
    'Mietverhältnis',
    [
      'mietvertrag',
      'nachtrag',
      'uebergabeprotokoll',
      'kautionsnachweis',
      'wohnungsgeberbestaetigung',
      'betriebskostenabrechnung',
    ],
  ],
  [
    'Kauf',
    [
      'expose',
      'reservierung',
      'kaufvertrag',
      'notarschreiben',
      'vollmacht',
      'grunderwerbsteuerbescheid',
    ],
  ],
  [
    'Grundstück und Gebäude',
    [
      'grundbuch',
      'grundbuchmitteilung',
      'flurkarte',
      'bodenrichtwert',
      'grundriss',
      'energieausweis',
      'objektfoto',
    ],
  ],
  ['Finanzierung', ['kreditvertrag', 'grundschuldbestellung', 'finanzierung']],
  [
    'WEG und Haus',
    [
      'teilungserklaerung',
      'verwaltervertrag',
      'wirtschaftsplan',
      'hausgeldabrechnung',
      'heizkostenabrechnung',
      'weg_protokoll',
      'hausordnung',
    ],
  ],
  [
    'Laufend und Sonstiges',
    [
      'grundsteuer',
      'versicherung',
      'steuerpaket',
      'beleg',
      'mietspiegel',
      'bescheinigung',
      'mangelfoto',
      'sonstiges',
    ],
  ],
]

export const DOKUMENT_STATUS_TEXT: Record<DokumentStatus, string> = {
  gueltig: 'gültig',
  ersetzt: 'ersetzt',
  abgelaufen: 'abgelaufen',
}

/**
 * Was abgelegt wird: Verträge als PDF, Fotos von Belegen und Schäden. HEIC (iPhone) ist beim
 * Hochladen zusätzlich erlaubt und wird vorher zu JPEG (lib/upload.ts).
 */
export const ERLAUBTE_TYPEN = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
export const MAX_GROESSE = 20 * 1024 * 1024
/** `accept` für Dateifelder; Endungen zusätzlich, weil manche Browser HEIC ohne Typ melden. */
export const DATEI_ACCEPT =
  'application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif'
export const DATEI_FEHLER = 'Erlaubt sind PDF, JPG, PNG, WebP und HEIC.'
