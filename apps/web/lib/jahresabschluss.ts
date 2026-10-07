import 'server-only'
import { abschlussDaten, type AbschlussRoh, type Tx } from '@vermieteros/db'
import { jahresabschluss, type Abschluss, type AbschlussPunkt } from '@vermieteros/rechenkern'
import { heuteBerlin } from './zeit'

/**
 * Jahresabschluss (WP 2.7): Checkliste je Objekt für das Vorjahr, Vollständigkeits-Wächter für
 * das laufende Jahr. Jeder offene Punkt führt dorthin, wo er sich erledigen lässt.
 */
export type AbschlussObjekt = { roh: AbschlussRoh; abschluss: Abschluss }

export async function ladeAbschluss(tx: Tx, jahr: number): Promise<AbschlussObjekt[]> {
  const heute = heuteBerlin()
  return (await abschlussDaten(tx, jahr)).map((roh) => ({
    roh,
    abschluss: jahresabschluss({ ...roh, jahr, heute }),
  }))
}

/** Offene Punkte über Vorjahr und laufendes Jahr, für den Zähler im Menü. */
export async function offeneAbschlussPunkte(tx: Tx): Promise<number> {
  const j = Number(heuteBerlin().slice(0, 4))
  let n = 0
  for (const jahr of [j - 1, j])
    for (const o of await ladeAbschluss(tx, jahr)) n += o.abschluss.faellig
  return n
}

export function abschlussLink(p: AbschlussPunkt, objektId: string, jahr: number): string {
  const neu = (typ: string) => '/dokumente/neu?objekt=' + objektId + '&typ=' + typ
  switch (p.code) {
    case 'belege':
      return '/belege'
    case 'buchungen':
      return '/journal?jahr=' + jahr + '&objekt=' + objektId
    case 'grundsteuer':
      return neu('grundsteuer')
    case 'hausgeld':
      return neu('hausgeldabrechnung')
    case 'zinsen':
      return neu('zinsbescheinigung')
    case 'bk':
      return '/betriebskosten'
    case 'steuerpaket':
      return '/steuer/' + objektId + '/' + jahr
  }
}

export const STAND_TEXT = {
  erledigt: 'erledigt',
  offen: 'offen',
  spaeter: 'nach Jahresende',
  entfaellt: 'entfällt',
} as const

export const STAND_TON = {
  erledigt: 'gruen',
  offen: 'gelb',
  spaeter: 'neutral',
  entfaellt: 'neutral',
} as const
