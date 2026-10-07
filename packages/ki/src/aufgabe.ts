import type { z } from 'zod'
import type { PlatzhalterKatalog } from './platzhalter'

/**
 * Eine KI-Aufgabe im Prompt-Register. Name und Version bilden die Prompt-Version im Stempel;
 * jede Änderung an System, Nachricht oder Schema erhöht die Version und läuft gegen das Golden-Set.
 */
export type Aufgabe<D, A> = {
  name: string
  version: number
  /** Rolle, Regeln, Vorlagen: stabil, wird gecacht */
  system: string
  /** Baut die Nachricht aus den Kontextdaten */
  nachricht: (daten: D, platzhalter: PlatzhalterKatalog) => string
  ausgabe: z.ZodType<A>
  /** Texte der Ausgabe, die als Entwurf gelten: keine Zahlen, nur bekannte Platzhalter */
  entwuerfe?: (a: A) => string[]
  maxTokens?: number
  /** Gültigkeit eines Vorschlags in Tagen (PLAN 4.2: Standard 14) */
  ablaufTage?: number
  /** Anteil der Golden-Set-Fälle, die bestehen müssen (Standard 1, Extraktion 0,95) */
  goldenSchwelle?: number
}

export function promptVersion(a: Pick<Aufgabe<unknown, unknown>, 'name' | 'version'>): string {
  return `${a.name}@${a.version}`
}
