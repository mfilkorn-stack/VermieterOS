import type { Referenz } from '@vermieteros/db'
import type { PlatzhalterKatalog } from '../platzhalter'

/**
 * Ergebnis eines Kontext-Builders (PLAN 4.1). Builder lesen nur aus `*_aktuell`-Sichten und
 * gültigen Dokumenten und merken sich alles, worauf der Kontext beruht.
 */
export type Kontext<D> = {
  /** Worauf sich der Vorschlag bezieht */
  bezug: Referenz
  /** Inhalt für das Modell */
  daten: D
  /** Platzhalter, die der Entwurf verwenden darf; Werte setzt erst der Renderer ein */
  platzhalter: PlatzhalterKatalog
  /** Entitäten, deren Änderung den Vorschlag veralten lässt */
  referenzen: Referenz[]
  /** Dokumente, die in den Kontext eingeflossen sind */
  dokumentIds: string[]
}

/** Sammelt Referenzen ohne Dubletten, damit Builder einfach `merke()` rufen können. */
export class Referenzen {
  private readonly m = new Map<string, Referenz>()
  merke(entitaet: string, id: string | null | undefined): this {
    if (id) this.m.set(`${entitaet}:${id}`, { entitaet, id })
    return this
  }
  liste(): Referenz[] {
    return [...this.m.values()]
  }
}
