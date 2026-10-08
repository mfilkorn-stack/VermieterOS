import { describe, expect, it } from 'vitest'
import {
  centAus,
  datumAus,
  monateAus,
  werteMietvertragAus,
  type MietvertragAuszug,
} from '../src/aufgaben/mietvertrag'
import { seitenTexte } from '../src/pdf'
import { musterMietvertrag } from '../src/testpdf'

const AUSZUG: MietvertragAuszug = {
  mietbeginn: { wert: '01.09.2021', seite: 2, zitat: 'Das Mietverhältnis beginnt am 01.09.2021.' },
  kaltmiete: {
    wert: '650,00 €',
    seite: 2,
    zitat: 'Die Nettokaltmiete beträgt 650,00 € monatlich.',
  },
  vorauszahlung_betriebskosten: { wert: '120,00 €', seite: 2, zitat: 'Betriebskosten: 120,00 €' },
  vorauszahlung_heizkosten: null,
  // erfunden: steht nicht im Vertrag
  kaution: { wert: '2.000,00 €', seite: 2, zitat: 'Kaution von 2.000,00 €' },
  // falsche Seite
  kuendigungsfrist_monate: {
    wert: 'drei Monate',
    seite: 1,
    zitat: 'Kündigungsfrist beträgt drei Monate',
  },
  mieter: ['Erika Beispiel'],
  hinweise: [],
}

describe('Mietvertrag: Fundstellen prüfen', () => {
  it('liest den Text je Seite aus dem PDF', async () => {
    const seiten = await seitenTexte(musterMietvertrag())
    expect(seiten).toHaveLength(2)
    expect(seiten[1]).toContain('650,00 €')
  })

  it('belegt nur, was wörtlich auf der genannten Seite steht', async () => {
    const seiten = await seitenTexte(musterMietvertrag())
    const a = Object.fromEntries(werteMietvertragAus(AUSZUG, seiten).map((x) => [x.feld, x]))
    expect(a['mietbeginn']).toMatchObject({ pruefung: 'belegt', normiert: '2021-09-01' })
    expect(a['kaltmiete']).toMatchObject({ pruefung: 'belegt', normiert: 65000 })
    expect(a['vorauszahlung_betriebskosten']).toMatchObject({ pruefung: 'belegt', normiert: 12000 })
    expect(a['kaution']?.pruefung).toBe('nicht_belegt')
    expect(a['kuendigungsfrist_monate']?.pruefung).toBe('nicht_belegt')
    expect(a['vorauszahlung_heizkosten']).toBeUndefined()
  })

  it('ein Scan ohne Text lässt sich nicht prüfen', () => {
    const [x] = werteMietvertragAus({ ...AUSZUG, kaution: null }, ['', ''])
    expect(x?.pruefung).toBe('scan')
  })

  it('normiert Daten, Beträge und Monate', () => {
    expect(datumAus('1. September 2021')).toBe('2021-09-01')
    expect(datumAus('2021-09-01')).toBe('2021-09-01')
    expect(centAus('1.950,00 €')).toBe(195000)
    expect(centAus('EUR 650')).toBe(65000)
    expect(monateAus('drei Monate')).toBe(3)
    expect(monateAus('3 Monate')).toBe(3)
    expect(datumAus('ab sofort')).toBeNull()
  })
})

describe('Muster für das Golden-Set', () => {
  it('Formular- und Gesamtmiete-Muster haben eine Textebene, Fundstellen sind prüfbar', async () => {
    const { musterLeererMietvertrag, musterMietvertragGesamtmiete } = await import('../src/testpdf')
    const leer = await seitenTexte(musterLeererMietvertrag())
    expect(leer).toHaveLength(3)
    const gesamt = await seitenTexte(musterMietvertragGesamtmiete())
    const a = werteMietvertragAus(
      {
        mietbeginn: { wert: '01.03.2024', seite: 2, zitat: 'beginnt am 01.03.2024' },
        kaltmiete: {
          wert: '720,00 €',
          seite: 2,
          zitat: 'Die monatliche Kaltmiete beträgt 720,00 €',
        },
        vorauszahlung_betriebskosten: null,
        vorauszahlung_heizkosten: null,
        // Gesamtmiete statt Kaltmiete: steht so nicht als Kaution im Text
        kaution: { wert: '945,00 €', seite: 2, zitat: 'Mietsicherheit in Höhe von 945,00 €' },
        kuendigungsfrist_monate: null,
        mieter: [],
        hinweise: [],
      },
      gesamt,
    )
    expect(a.find((x) => x.feld === 'kaltmiete')).toMatchObject({
      pruefung: 'belegt',
      normiert: 72000,
    })
    expect(a.find((x) => x.feld === 'kaution')?.pruefung).toBe('nicht_belegt')
  })
})
