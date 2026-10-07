import type { Aufgabe } from '../aufgabe'

/**
 * Prompt-Register: alle produktiven Aufgaben. Das Golden-Set läuft für jede Aufgabe hier,
 * deren Ordner `golden/<name>/` Fälle enthält. Die ersten Aufgaben kommen mit WP 1.5
 * (Sortierung, Antwortvorschlag).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Register über verschiedene Aufgaben
export const AUFGABEN: Array<Aufgabe<any, any>> = []
