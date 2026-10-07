import type { DokumentStatus, DokumentTyp } from '@vermieteros/schema'

export const DOKUMENT_TYP_TEXT: Record<DokumentTyp, string> = {
  mietvertrag: 'Mietvertrag',
  nachtrag: 'Nachtrag',
  uebergabeprotokoll: 'Übergabeprotokoll',
  kautionsnachweis: 'Kautionsnachweis',
  versicherung: 'Versicherung',
  grundbuch: 'Grundbuchauszug',
  kaufvertrag: 'Kaufvertrag',
  kreditvertrag: 'Kreditvertrag',
  teilungserklaerung: 'Teilungserklärung',
  hausgeldabrechnung: 'Hausgeldabrechnung',
  beleg: 'Beleg',
  mietspiegel: 'Mietspiegel',
  bescheinigung: 'Bescheinigung (ausgestellt)',
  sonstiges: 'Sonstiges',
}

export const DOKUMENT_STATUS_TEXT: Record<DokumentStatus, string> = {
  gueltig: 'gültig',
  ersetzt: 'ersetzt',
  abgelaufen: 'abgelaufen',
}

/** Was hochgeladen werden darf: Verträge als PDF, Fotos von Belegen und Schäden. */
export const ERLAUBTE_TYPEN = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
export const MAX_GROESSE = 20 * 1024 * 1024
