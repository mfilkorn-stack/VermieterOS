import type {
  Gewerk,
  NotfallArt,
  Prioritaet,
  TicketStatus,
  WissenKategorie,
} from '@vermieteros/schema'

export const GEWERK_TEXT: Record<Gewerk, string> = {
  heizung_sanitaer: 'Heizung und Sanitär',
  elektro: 'Elektro',
  schluesseldienst: 'Schlüsseldienst',
  dach_fassade: 'Dach und Fassade',
  fenster_tueren: 'Fenster und Türen',
  maler_boden: 'Maler und Boden',
  garten: 'Garten',
  reinigung: 'Reinigung',
  hausmeister: 'Hausmeister',
  sonstiges: 'Sonstiges',
}

export const NOTFALL_TEXT: Record<NotfallArt, string> = {
  heizung: 'Heizung',
  wasser: 'Wasser',
  strom: 'Strom',
  gas: 'Gas',
  schluessel: 'Schlüsseldienst',
  hausverwaltung: 'Hausverwaltung',
  sonstiges: 'Sonstiges',
}

export const WISSEN_TEXT: Record<WissenKategorie, string> = {
  hausordnung: 'Hausordnung',
  anleitung: 'Anleitung',
  muell: 'Müll',
  faq: 'Häufige Frage',
  sonstiges: 'Sonstiges',
}

export const TICKET_STATUS_TEXT: Record<TicketStatus, string> = {
  gemeldet: 'gemeldet',
  beauftragt: 'beauftragt',
  termin: 'Termin steht',
  erledigt: 'erledigt',
  abgeschlossen: 'abgeschlossen',
  verworfen: 'verworfen',
}

export const PRIORITAET_TEXT: Record<Prioritaet, string> = {
  notfall: 'Notfall',
  hoch: 'dringend',
  normal: 'normal',
  niedrig: 'niedrig',
}

export function optionen<T extends string>(m: Record<T, string>): Array<readonly [T, string]> {
  return (Object.entries(m) as Array<[T, string]>).map(([k, v]) => [k, v] as const)
}
