import type { GrundbuchEintrag, NebenkostenPosition } from '@vermieteros/schema'
import type { GrundbuchRoh } from '@/components/grundbuch-editor'
import type { NebenkostenRoh } from '@/components/nebenkosten-editor'
import { bruch, Eingabefehler } from './eingabe'
import { bruchText, euroText } from './format'
import { parseDezimal, parseEuro } from '@vermieteros/rechenkern'

/** Rohdaten des Grundbuch-Editors → Fachdaten. Leere Blätter werden ignoriert. */
export function grundbuchAusRoh(roh: GrundbuchRoh[] | null): GrundbuchEintrag[] | null {
  if (!roh) return null
  const eintraege = roh
    .filter(
      (e) => e.amtsgericht.trim() || e.blatt.trim() || e.flurstuecke.some((f) => f.nummer.trim()),
    )
    .map((e, i) => {
      const flurstuecke = e.flurstuecke
        .filter((f) => f.nummer.trim() || f.flaeche.trim())
        .map((f) => {
          let flaecheQm: number
          try {
            flaecheQm = parseDezimal(f.flaeche, 0)
          } catch {
            throw new Eingabefehler(
              `Grundbuchblatt ${i + 1}: Fläche „${f.flaeche}“ in ganzen m² angeben.`,
            )
          }
          return { nummer: f.nummer.trim(), bezeichnung: f.bezeichnung.trim() || null, flaecheQm }
        })
      return {
        art: e.art as GrundbuchEintrag['art'],
        amtsgericht: e.amtsgericht.trim(),
        blatt: e.blatt.trim(),
        miteigentumsanteil: bruch(
          e.meaZaehler.trim() || null,
          e.meaNenner.trim() || null,
          `Grundbuchblatt ${i + 1}`,
        ),
        flurstuecke,
      }
    })
  return eintraege.length ? eintraege : null
}

export function grundbuchZuRoh(g: GrundbuchEintrag[] | null | undefined): GrundbuchRoh[] {
  return (g ?? []).map((e) => {
    const [meaZaehler, meaNenner] = bruchText(e.miteigentumsanteil)
    return {
      art: e.art,
      amtsgericht: e.amtsgericht,
      blatt: e.blatt,
      meaZaehler,
      meaNenner,
      flurstuecke: e.flurstuecke.map((f) => ({
        nummer: f.nummer,
        bezeichnung: f.bezeichnung ?? '',
        flaeche: String(f.flaecheQm),
      })),
    }
  })
}

export function nebenkostenAusRoh(roh: NebenkostenRoh[] | null): NebenkostenPosition[] | null {
  if (!roh) return null
  const positionen = roh
    .filter((z) => z.betrag.trim())
    .map((z) => {
      let betragCent: number
      try {
        betragCent = parseEuro(z.betrag)
      } catch {
        throw new Eingabefehler(`Nebenkosten: „${z.betrag}“ ist kein Betrag.`)
      }
      return {
        art: z.art as NebenkostenPosition['art'],
        bezeichnung: z.bezeichnung.trim() || null,
        betragCent,
        bezahltAm: z.bezahltAm || null,
      }
    })
  return positionen.length ? positionen : null
}

export function nebenkostenZuRoh(n: NebenkostenPosition[] | null | undefined): NebenkostenRoh[] {
  return (n ?? []).map((p) => ({
    art: p.art,
    bezeichnung: p.bezeichnung ?? '',
    betrag: euroText(p.betragCent),
    bezahltAm: p.bezahltAm ?? '',
  }))
}
