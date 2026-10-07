import { createHash } from 'node:crypto'
import { extractText, getDocumentProxy } from 'unpdf'
import { describe, expect, it } from 'vitest'
import { betriebskostenabrechnungBrief, briefPdf } from '../src'
import { BK_MUSTER } from './bk-muster'

async function text(pdf: Uint8Array): Promise<string> {
  const { text } = await extractText(await getDocumentProxy(new Uint8Array(pdf)), {
    mergePages: true,
  })
  return text.replace(/\s+/g, ' ')
}

describe('Betriebskostenabrechnung als PDF', () => {
  it('Anschreiben und Abrechnung mit allen Mindestangaben, zweiseitig', async () => {
    const pdf = await briefPdf(betriebskostenabrechnungBrief(BK_MUSTER))
    const t = await text(pdf)
    expect(t).toContain('Sehr geehrter Herr Beispiel,')
    expect(t).toContain('Guthaben von 479,11 €')
    expect(t).toContain(
      'senken wir Ihre monatliche Vorauszahlung von bisher 189,00 € um 39,00 € auf 150,00 €',
    )
    expect(t).toContain('§ 560 Abs. 4 BGB')
    expect(t).toContain('Lohnkostenanteil beträgt 112,24 €')
    expect(t).toContain('Verteilerschlüssel')
    expect(t).toContain('11.215,92 €')
    expect(t).toContain('-33,10 €')
    expect(t).toContain('1.788,89 €')
    expect(t).toContain('-2.268,00 €')
    expect(t).toContain('Erläuterung der Verteilerschlüssel')
    expect(t).toContain('Seite 2 von 2')
  })

  it('Nachzahlung ohne Anpassung; Ausgabe für dieselben Daten byte-gleich', async () => {
    const d = { ...BK_MUSTER, saldoCent: 2_884, anpassung: null, lohnanteil35aCent: 0 }
    const a = await briefPdf(betriebskostenabrechnungBrief(d))
    const b = await briefPdf(betriebskostenabrechnungBrief(d))
    const h = (x: Uint8Array) => createHash('sha256').update(x).digest('hex')
    expect(h(a)).toBe(h(b))
    const t = await text(a)
    expect(t).toContain('Nachzahlung von 28,84 €')
    expect(t).toContain('innerhalb von 30 Tagen')
    expect(t).not.toContain('§ 560')
  })
})
