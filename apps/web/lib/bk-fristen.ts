import 'server-only'
import { bkFristen, type Tx } from '@vermieteros/db'
import { fristStatus, type FristStufe } from '@vermieteros/rechenkern'
import { heuteBerlin } from './zeit'

/**
 * Frist-Wächter (WP 2.5): die beiden letzten Kalenderjahre je vermieteter Einheit, mit Stufe
 * nach § 556 Abs. 3 BGB (Warnung ab Monat 9, Eskalation ab Monat 11).
 */
export async function ladeBkFristen(tx: Tx) {
  const heute = heuteBerlin()
  const jahr = Number(heute.slice(0, 4))
  const zeilen = await bkFristen(tx, [jahr - 2, jahr - 1])
  return zeilen
    .map((z) => ({ ...z, ...fristStatus(z.zeitraumBis, heute, z.versendet) }))
    .filter((z) => z.stufe !== 'laufend')
}

export type BkFrist = Awaited<ReturnType<typeof ladeBkFristen>>[number]

/** Stufen, die Handlung verlangen (Zähler im Menü, Hinweis auf der Startseite). */
export const DRINGEND: ReadonlySet<FristStufe> = new Set(['warnung', 'eskalation', 'abgelaufen'])

export const STUFE_TEXT: Record<FristStufe, string> = {
  laufend: 'Zeitraum läuft',
  offen: 'offen',
  warnung: 'Frist in Sicht',
  eskalation: 'Frist läuft ab',
  abgelaufen: 'Frist abgelaufen',
  erledigt: 'versendet',
}

export const STUFE_TON: Record<FristStufe, 'rot' | 'gelb' | 'gruen' | 'neutral'> = {
  laufend: 'neutral',
  offen: 'neutral',
  warnung: 'gelb',
  eskalation: 'rot',
  abgelaufen: 'rot',
  erledigt: 'gruen',
}
