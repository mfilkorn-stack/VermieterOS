import type { BelegObjekt } from '@vermieteros/db'
import { objekteImText, vorgeschlageneObjekte } from '@vermieteros/ki'

/**
 * Für welche Objekte gilt ein Beleg? Reihenfolge der Quellen:
 *   1. beim Hochladen gewählt oder aus dem Ticket (Entscheidung eines Menschen),
 *   2. Anschrift eines angelegten Objekts steht im Beleg (am PDF-Text geprüft),
 *   3. Vorschlag der KI (auch mehrere Objekte, z. B. Steuerberatung für alle).
 * Mehrere Objekte werden gleichmäßig aufgeteilt; Beträge lassen sich im Formular ändern.
 */
export type ObjektVorschlag = {
  ids: string[]
  quelle: 'hochgeladen' | 'ticket' | 'anschrift' | 'ki'
  hinweis: string
  /** Seite der Fundstelle bei Quelle „anschrift“ */
  seite: number | null
}

export function objektVorschlag(p: {
  objekte: BelegObjekt[]
  objektId: string | null
  ticket: { titel: string; objekt: string } | null
  seiten: string[]
  einordnung: unknown
}): ObjektVorschlag | null {
  const name = (id: string) => p.objekte.find((o) => o.id === id)?.bezeichnung ?? id
  if (p.objektId) {
    return p.ticket
      ? {
          ids: [p.objektId],
          quelle: 'ticket',
          hinweis: 'Aus dem Ticket „' + p.ticket.titel + '“ (' + p.ticket.objekt + ').',
          seite: null,
        }
      : {
          ids: [p.objektId],
          quelle: 'hochgeladen',
          hinweis: 'Beim Hochladen gewählt.',
          seite: null,
        }
  }
  const treffer = objekteImText(p.seiten, p.objekte)
  if (treffer.length) {
    return {
      ids: treffer.map((t) => t.objektId),
      quelle: 'anschrift',
      hinweis:
        'Im Beleg steht ' +
        treffer.map((t) => '„' + t.treffer + '“ (S. ' + t.seite + ')').join(' und ') +
        (treffer.length > 1 ? ', gleichmäßig aufgeteilt.' : '.'),
      seite: treffer[0]!.seite,
    }
  }
  const ki = vorgeschlageneObjekte(p.einordnung).filter((id) => p.objekte.some((o) => o.id === id))
  if (ki.length) {
    return {
      ids: ki,
      quelle: 'ki',
      hinweis:
        'Vorschlag der KI: ' +
        ki.map(name).join(', ') +
        (ki.length > 1 ? ', gleichmäßig aufgeteilt.' : '.'),
      seite: null,
    }
  }
  return null
}

/** Stimmt die gebuchte Aufteilung mit dem Vorschlag überein (gleiche Objekte, Reihenfolge egal)? */
export function gleicheObjekte(gebucht: string[], vorschlag: string[]): boolean {
  const a = new Set(gebucht)
  return a.size === vorschlag.length && vorschlag.every((id) => a.has(id))
}
