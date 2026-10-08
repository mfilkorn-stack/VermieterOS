/**
 * Welche angelegten Objekte nennt ein Beleg? Ohne KI und prüfbar: Straße mit Hausnummer (oder
 * eine eindeutige Objektbezeichnung) muss wörtlich im Text des PDFs stehen. Fotos und Scans ohne
 * Textebene liefern nichts; dann bleibt der Vorschlag der KI.
 */
export type ObjektReferenz = { id: string; bezeichnung: string; anschrift: string | null }
export type ObjektTreffer = { objektId: string; seite: number; treffer: string }

function norm(t: string): string {
  return t
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/strasse\b|str\./g, 'str')
    .replace(/[.,;:()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** „Musterweg 1, 99999 Musterstadt“ → „Musterweg 1“ */
function strasseMitNummer(anschrift: string | null): string | null {
  const teil = anschrift?.split(',')[0]?.trim()
  return teil && /\d/.test(teil) ? teil : null
}

/** Ganzes Wort: „Musterweg 1“ trifft nicht „Musterweg 10“, „Musterweg 1a“ oder „Am Musterweg 1“ teilweise. */
function enthaelt(text: string, muster: string): boolean {
  const m = muster.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp('(^|[^0-9a-zäöü])' + m + '(?![0-9a-zäöü])').test(text)
}

export function objekteImText(seiten: string[], objekte: ObjektReferenz[]): ObjektTreffer[] {
  const texte = seiten.map(norm)
  const treffer: ObjektTreffer[] = []
  for (const o of objekte) {
    const kandidaten = [strasseMitNummer(o.anschrift)]
    // Eine eigene Bezeichnung zählt nur, wenn sie lang genug ist, um zufällige Treffer zu vermeiden.
    if (o.bezeichnung.trim().length >= 8 && /\d/.test(o.bezeichnung)) kandidaten.push(o.bezeichnung)
    for (const k of kandidaten) {
      if (!k) continue
      const seite = texte.findIndex((t) => enthaelt(t, norm(k)))
      if (seite >= 0) {
        treffer.push({ objektId: o.id, seite: seite + 1, treffer: k })
        break
      }
    }
  }
  return treffer
}
