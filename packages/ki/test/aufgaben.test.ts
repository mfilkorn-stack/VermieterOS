import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ANTWORTVORSCHLAG } from '../src/aufgaben/antwortvorschlag'
import { AUFGABEN } from '../src/aufgaben/index'
import { SORTIERUNG } from '../src/aufgaben/sortierung'
import { GoldenFall } from '../src/golden/lauf'
import type { NachrichtDaten } from '../src/kontext/nachricht'

const GOLDEN = resolve(import.meta.dirname, '../golden')

const MAIL: NachrichtDaten = {
  betreff: 'Kündigung',
  text: 'Hiermit kündige ich. Bitte bestätigen Sie mir den Eingang bis zum 15.11.2026.',
  absender: 'Mieterin',
  eingegangen: '2026-11-03T08:00:00Z',
  anhaenge: [],
  zuordnung: null,
  wissen: [],
}

describe('Prompt-Register und Golden-Set', () => {
  it('jeder Golden-Ordner gehört zu einer registrierten Aufgabe, jeder Fall ist gültig', () => {
    const namen = AUFGABEN.map((a) => a.name)
    for (const ordner of readdirSync(GOLDEN, { withFileTypes: true }).filter((d) =>
      d.isDirectory(),
    )) {
      expect(namen).toContain(ordner.name)
      const dateien = readdirSync(join(GOLDEN, ordner.name))
      for (const f of dateien.filter((x) => x.endsWith('.json'))) {
        const fall = GoldenFall.parse(
          JSON.parse(readFileSync(join(GOLDEN, ordner.name, f), 'utf8')),
        )
        if (fall.datei) {
          // Fälle mit Datei (Belege, Verträge): die Datei liegt daneben.
          expect(dateien, `${ordner.name}/${f}`).toContain(fall.datei)
        } else {
          expect(fall.daten, `${ordner.name}/${f}`).toMatchObject({ betreff: expect.any(String) })
        }
      }
    }
  })

  it('Nachrichten an das Modell enthalten den Kontext, beim Antwortvorschlag auch die Platzhalter', () => {
    expect(SORTIERUNG.nachricht(MAIL, {})).toContain('bis zum 15.11.2026')
    const n = ANTWORTVORSCHLAG.nachricht(MAIL, { 'mieter.name': 'Name' })
    expect(n).toContain('mieter.name')
  })
})

describe('Sortierung: Frist muss belegt sein', () => {
  const basis = {
    kategorie: 'vertrag_kuendigung' as const,
    dringlichkeit: 'hoch' as const,
    zusammenfassung: 'Kündigung',
    begruendung: 'Kündigung mit Frist',
  }
  it('akzeptiert eine wörtlich belegte Frist, auch mit anderen Leerzeichen', () => {
    expect(
      SORTIERUNG.pruefe!(
        { ...basis, frist: { datum: '2026-11-15', beleg: 'bis  zum 15.11.2026' } },
        MAIL,
      ),
    ).toEqual([])
    expect(SORTIERUNG.pruefe!({ ...basis, frist: null }, MAIL)).toEqual([])
  })
  it('lehnt erfundene Belege und ungültige Daten ab', () => {
    expect(
      SORTIERUNG.pruefe!(
        { ...basis, frist: { datum: '15.11.2026', beleg: 'bis zum 1.12.' } },
        MAIL,
      ),
    ).toHaveLength(2)
  })
})

describe('Antwortvorschlag: Zusagen müssen markiert sein', () => {
  it('lehnt einen Entwurf mit unmarkierter Kostenübernahme ab', () => {
    const a = {
      entwurf: 'Wir übernehmen selbstverständlich die Kosten.',
      zusagen: [],
      offene_punkte: [],
    }
    expect(ANTWORTVORSCHLAG.pruefe!(a, MAIL)).toHaveLength(1)
    expect(
      ANTWORTVORSCHLAG.pruefe!({ ...a, zusagen: ['Wir übernehmen … die Kosten.'] }, MAIL),
    ).toEqual([])
  })
  it('ein neutraler Entwurf braucht keine Markierung', () => {
    const a = {
      entwurf:
        'Guten Tag {{mieter.name}}, danke für Ihre Nachricht. Wir melden uns. {{vermieter.name}}',
      zusagen: [],
      offene_punkte: [],
    }
    expect(ANTWORTVORSCHLAG.pruefe!(a, MAIL)).toEqual([])
  })
})
