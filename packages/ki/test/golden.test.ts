import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { Aufgabe } from '../src/aufgabe'
import { FakeKiClient } from '../src/fake'
import { GoldenFall, laufeGoldenSet } from '../src/golden/lauf'

const A = z.object({ kategorie: z.string(), entwurf: z.string() })
const AUFGABE: Aufgabe<{ text: string }, z.infer<typeof A>> = {
  name: 'golden_test',
  version: 2,
  system: 's',
  nachricht: (d) => d.text,
  ausgabe: A,
  entwuerfe: (a) => [a.entwurf],
}

const fall = (erwartet: Record<string, unknown>) =>
  GoldenFall.parse({
    beschreibung: 'b',
    synthetisch: true,
    daten: { text: 'Heizung kalt' },
    platzhalter: { 'mieter.name': 'Name' },
    erwartet,
  })

describe('Golden-Set', () => {
  it('bewertet Kategorie, Zahlen im Entwurf und Platzhalter je Fall', async () => {
    const client = new FakeKiClient(
      { kategorie: 'heizung', entwurf: 'Hallo {{mieter.name}}' },
      { kategorie: 'heizung', entwurf: 'Wir kommen am 3. Mai.' },
      { kategorie: 'sonstiges', entwurf: 'Hallo {{mieter.iban}}' },
    )
    const r = await laufeGoldenSet(
      AUFGABE,
      [
        { name: 'gut.json', fall: fall({ kategorie: 'heizung' }) },
        { name: 'zahl.json', fall: fall({ kategorie: 'heizung' }) },
        { name: 'falsch.json', fall: fall({ kategorie: 'heizung' }) },
      ],
      client,
      'fake',
    )
    expect(r).toMatchObject({ aufgabe: 'golden_test@2', gesamt: 3, bestanden: 1, ok: false })
    expect(r.faelle[1]!.befunde).toEqual(['Zahl im Entwurf: „3.“'])
    expect(r.faelle[2]!.befunde).toEqual([
      'Platzhalter unbekannt: mieter.iban',
      'kategorie: erwartet "heizung", erhalten "sonstiges"',
    ])
  })

  it('eine Schwelle unter 1 lässt einzelne Fehlschläge zu', async () => {
    const client = new FakeKiClient(
      { kategorie: 'a', entwurf: '' },
      { kategorie: 'b', entwurf: '' },
    )
    const r = await laufeGoldenSet(
      { ...AUFGABE, goldenSchwelle: 0.5 },
      [
        { name: '1', fall: fall({ kategorie: 'a' }) },
        { name: '2', fall: fall({ kategorie: 'a' }) },
      ],
      client,
      'fake',
    )
    expect(r).toMatchObject({ bestanden: 1, quote: 0.5, ok: true })
  })
})
