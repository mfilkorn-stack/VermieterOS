import type { ZuordnungsKandidat } from '@vermieteros/db'
import type { ZuordnungArt } from '@vermieteros/schema'
import { datumAnzeige } from './format'

export const ZUORDNUNG_TEXT: Record<ZuordnungArt, string> = {
  verlauf: 'automatisch, Antwort im selben Verlauf',
  absender: 'automatisch über den Absender',
  absender_betreff: 'automatisch über Absender und Betreff',
  manuell: 'von Hand',
  aufgehoben: 'Zuordnung aufgehoben',
  erledigt: 'erledigt ohne Zuordnung',
}

/** „Wohnung Nr. 1 · ETW mit Stellplatz · Max Mieter · seit 01.09.2021“ */
export function mietverhaeltnisText(k: ZuordnungsKandidat): string {
  const zeit = k.ende
    ? `${datumAnzeige(k.beginn)} bis ${datumAnzeige(k.ende)}`
    : `seit ${datumAnzeige(k.beginn)}`
  return [k.einheit, k.objekt, k.mieterNamen.join(', ') || 'ohne Mieter', zeit].join(' · ')
}

export function groesseText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1_048_576) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1_048_576).toFixed(1).replace('.', ',')} MB`
}

export function anhangText(n: number): string {
  return n === 1 ? '1 Anhang' : `${n} Anhänge`
}
