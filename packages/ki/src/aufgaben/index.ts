import type { Aufgabe } from '../aufgabe'
import { ANTWORTVORSCHLAG } from './antwortvorschlag'
import { BELEG_EXTRAKTION } from './beleg'
import { KAUFVERTRAG_EXTRAKTION } from './kaufvertrag'
import { MIETVERTRAG_EXTRAKTION } from './mietvertrag'
import { SORTIERUNG } from './sortierung'
import { TICKET_EXTRAKTION } from './ticket'

/**
 * Prompt-Register: alle produktiven Aufgaben. Das Golden-Set läuft für jede Aufgabe hier,
 * deren Ordner `golden/<name>/` Fälle enthält.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Register über verschiedene Aufgaben
export const AUFGABEN: Array<Aufgabe<any, any>> = [
  SORTIERUNG,
  ANTWORTVORSCHLAG,
  MIETVERTRAG_EXTRAKTION,
  BELEG_EXTRAKTION,
  KAUFVERTRAG_EXTRAKTION,
  TICKET_EXTRAKTION,
]
