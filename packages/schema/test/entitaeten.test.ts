import { describe, expect, it } from 'vitest'
import {
  DokumentIdentitaet,
  HerkunftEintrag,
  MietkonditionDaten,
  MietverhaeltnisDaten,
  ObjektDaten,
  Plz,
} from '../src/index'

describe('ObjektDaten', () => {
  it('akzeptiert ein minimales Objekt und setzt Defaults', () => {
    const o = ObjektDaten.parse({ bezeichnung: 'Haus 1', art: 'haus' })
    expect(o.weg).toBe(false)
  })
  it('lehnt unbekannte Art und kaputte PLZ ab', () => {
    expect(ObjektDaten.safeParse({ bezeichnung: 'x', art: 'villa' }).success).toBe(false)
    expect(ObjektDaten.safeParse({ bezeichnung: 'x', art: 'haus', plz: '1234' }).success).toBe(
      false,
    )
    expect(Plz.safeParse('50667').success).toBe(true)
  })
})

describe('MietverhaeltnisDaten', () => {
  it('Ende darf nicht vor Beginn liegen', () => {
    const r = MietverhaeltnisDaten.safeParse({
      beginn: '2025-01-01',
      ende: '2024-12-31',
      mieterIds: ['019a0000-0000-7000-8000-000000000001'],
    })
    expect(r.success).toBe(false)
  })
  it('braucht mindestens einen Mieter', () => {
    expect(MietverhaeltnisDaten.safeParse({ beginn: '2025-01-01', mieterIds: [] }).success).toBe(
      false,
    )
  })
})

describe('MietkonditionDaten', () => {
  it('Staffelmiete braucht Stufen', () => {
    expect(MietkonditionDaten.safeParse({ kaltmieteCent: 85000, mietart: 'staffel' }).success).toBe(
      false,
    )
    expect(
      MietkonditionDaten.safeParse({
        kaltmieteCent: 85000,
        mietart: 'staffel',
        staffel: [{ ab: '2027-01-01', kaltmieteCent: 90000 }],
      }).success,
    ).toBe(true)
  })
  it('Cent müssen ganzzahlig sein', () => {
    expect(MietkonditionDaten.safeParse({ kaltmieteCent: 850.5 }).success).toBe(false)
  })
})

describe('HerkunftEintrag', () => {
  it('verlangt Pflichtangaben je Quelle', () => {
    expect(HerkunftEintrag.safeParse({ quelle: 'dokument' }).success).toBe(false)
    expect(
      HerkunftEintrag.safeParse({
        quelle: 'dokument',
        dokumentId: '019a0000-0000-7000-8000-000000000001',
        seite: 3,
      }).success,
    ).toBe(true)
    expect(HerkunftEintrag.safeParse({ quelle: 'manuell' }).success).toBe(true)
  })
})

describe('DokumentIdentitaet', () => {
  it('hängt an Objekt oder Mietverhältnis', () => {
    const basis = {
      dateiHash: 'a'.repeat(64),
      speicherSchluessel: 'm/1/x.pdf',
      dateiname: 'x.pdf',
      mime: 'application/pdf',
      groesseBytes: 10,
    }
    expect(DokumentIdentitaet.safeParse(basis).success).toBe(false)
    expect(
      DokumentIdentitaet.safeParse({ ...basis, objektId: '019a0000-0000-7000-8000-000000000001' })
        .success,
    ).toBe(true)
  })
})
