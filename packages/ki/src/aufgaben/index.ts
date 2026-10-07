import type { Aufgabe } from '../aufgabe'
import { ANTWORTVORSCHLAG } from './antwortvorschlag'
import { SORTIERUNG } from './sortierung'

/**
 * Prompt-Register: alle produktiven Aufgaben. Das Golden-Set läuft für jede Aufgabe hier,
 * deren Ordner `golden/<name>/` Fälle enthält.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Register über verschiedene Aufgaben
export const AUFGABEN: Array<Aufgabe<any, any>> = [SORTIERUNG, ANTWORTVORSCHLAG]
