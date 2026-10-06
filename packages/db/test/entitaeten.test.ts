import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, expectTypeOf, it } from 'vitest'
import type {
  DarlehenDaten,
  DokumentDaten,
  DokumentIdentitaet,
  EigentumsanteilDaten,
  EinheitDaten,
  MietkonditionDaten,
  MietverhaeltnisDaten,
  ObjektDaten,
  PersonDaten,
  ZaehlerDaten,
} from '@vermieteros/schema'
import {
  ENTITAETEN,
  aktuell,
  neuerZaehlerstand,
  neueVersion,
  stand,
  storniereVersion,
  type IdentitaetsDaten,
  type VersionsDaten,
} from '../src/ledger'
import { withMandant } from '../src/mandant'
import { NUTZER, erwarteFehler, neuerMandant, verbindungen } from './helfer'

const v = verbindungen()
afterAll(() => v.close())

let mandant: string
let objektId: string
let einheitId: string
let personId: string
let mietverhaeltnisId: string
let mietkonditionId: string
let zaehlerId: string

beforeAll(async () => {
  mandant = await neuerMandant(v.app, 'Stammdaten')
  await withMandant(v.app, mandant, async (tx) => {
    const o = await neueVersion(tx, {
      entitaet: 'objekt',
      mandantId: mandant,
      akteur: NUTZER,
      gueltigAb: '2020-01-01',
      identitaet: {},
      daten: { bezeichnung: 'Musterstraße 1', art: 'haus', plz: '50667', ort: 'Köln' },
    })
    objektId = o.identId
    const e = await neueVersion(tx, {
      entitaet: 'einheit',
      mandantId: mandant,
      akteur: NUTZER,
      gueltigAb: '2020-01-01',
      identitaet: { objektId },
      daten: { bezeichnung: 'EG links', wohnflaecheQm100: 7250 },
    })
    einheitId = e.identId
  })
})

describe('Zod-Schemas passen zu den Drizzle-Versionstabellen', () => {
  it('Typen sind zuweisbar', () => {
    expectTypeOf<ObjektDaten>().toExtend<VersionsDaten<'objekt'>>()
    expectTypeOf<EinheitDaten>().toExtend<VersionsDaten<'einheit'>>()
    expectTypeOf<PersonDaten>().toExtend<VersionsDaten<'person'>>()
    expectTypeOf<MietverhaeltnisDaten>().toExtend<VersionsDaten<'mietverhaeltnis'>>()
    expectTypeOf<MietkonditionDaten>().toExtend<VersionsDaten<'mietkondition'>>()
    expectTypeOf<ZaehlerDaten>().toExtend<VersionsDaten<'zaehler'>>()
    expectTypeOf<DarlehenDaten>().toExtend<VersionsDaten<'darlehen'>>()
    expectTypeOf<DokumentDaten>().toExtend<VersionsDaten<'dokument'>>()
    expectTypeOf<DokumentIdentitaet>().toExtend<IdentitaetsDaten<'dokument'>>()
    expectTypeOf<EigentumsanteilDaten>().toExtend<VersionsDaten<'eigentumsanteil'>>()
  })
})

describe('Person → Mietverhältnis → Mietkondition', () => {
  it('legt die Kette an und liest sie über die Sichten', async () => {
    await withMandant(v.app, mandant, async (tx) => {
      const p = await neueVersion(tx, {
        entitaet: 'person',
        mandantId: mandant,
        akteur: NUTZER,
        gueltigAb: '2024-01-01',
        identitaet: {},
        daten: {
          rolle: 'mieter',
          vorname: 'Erika',
          nachname: 'Mustermann',
          email: 'erika@example.org',
        },
      })
      personId = p.identId
      const mv = await neueVersion(tx, {
        entitaet: 'mietverhaeltnis',
        mandantId: mandant,
        akteur: NUTZER,
        gueltigAb: '2024-04-01',
        identitaet: { einheitId },
        daten: {
          beginn: '2024-04-01',
          kautionCent: 255000,
          kautionArt: 'bar',
          mieterIds: [personId],
        },
      })
      mietverhaeltnisId = mv.identId
      const mk = await neueVersion(tx, {
        entitaet: 'mietkondition',
        mandantId: mandant,
        akteur: NUTZER,
        gueltigAb: '2024-04-01',
        identitaet: { mietverhaeltnisId },
        daten: {
          kaltmieteCent: 85000,
          vorauszahlungBkCent: 18000,
          vorauszahlungHkCent: 9000,
          personenzahl: 2,
        },
      })
      mietkonditionId = mk.identId
    })

    const mv = await withMandant(v.app, mandant, (tx) =>
      aktuell(tx, 'mietverhaeltnis', mietverhaeltnisId),
    )
    expect(mv?.mieterIds).toEqual([personId])
    expect(mv?.kautionCent).toBe(255000)

    const mk = await withMandant(v.app, mandant, (tx) =>
      aktuell(tx, 'mietkondition', mietkonditionId),
    )
    expect(mk?.kaltmieteCent).toBe(85000)
    expect(mk?.personenzahl).toBe(2)
    expect(mk?.grund).toBe('vertrag')
  })

  it('Mieterhöhung ist eine neue Konditionsversion mit gueltig_ab in der Zukunft', async () => {
    await withMandant(v.app, mandant, (tx) =>
      neueVersion(tx, {
        entitaet: 'mietkondition',
        mandantId: mandant,
        akteur: NUTZER,
        gueltigAb: '2099-01-01',
        identId: mietkonditionId,
        begruendung: 'Mieterhöhung § 558 BGB, Zustimmung liegt vor',
        daten: {
          kaltmieteCent: 92000,
          vorauszahlungBkCent: 18000,
          vorauszahlungHkCent: 9000,
          personenzahl: 2,
          grund: 'erhoehung_558',
        },
      }),
    )
    // Heute gilt noch die alte Miete, am Stichtag die neue.
    const heute = await withMandant(v.app, mandant, (tx) =>
      aktuell(tx, 'mietkondition', mietkonditionId),
    )
    expect(heute?.kaltmieteCent).toBe(85000)
    const spaeter = await withMandant(v.app, mandant, (tx) =>
      stand(tx, 'mietkondition', mietkonditionId, '2099-06-01'),
    )
    expect(spaeter?.kaltmieteCent).toBe(92000)
    expect(spaeter?.grund).toBe('erhoehung_558')
  })
})

describe('Zähler und Zählerstände', () => {
  it('Zählerstände sind Ereignisse: append-only, Storno statt Korrektur', async () => {
    const z = await withMandant(v.app, mandant, (tx) =>
      neueVersion(tx, {
        entitaet: 'zaehler',
        mandantId: mandant,
        akteur: NUTZER,
        gueltigAb: '2020-01-01',
        identitaet: { objektId, einheitId },
        daten: { art: 'wasser_kalt', nummer: 'W-4711', masseinheit: 'm³' },
      }),
    )
    zaehlerId = z.identId

    const s1 = await withMandant(v.app, mandant, (tx) =>
      neuerZaehlerstand(tx, {
        mandantId: mandant,
        akteur: NUTZER,
        zaehlerId,
        standX1000: 123_456,
        abgelesenAm: '2025-12-31',
        quelle: 'manuell',
      }),
    )
    const falsch = await withMandant(v.app, mandant, (tx) =>
      neuerZaehlerstand(tx, {
        mandantId: mandant,
        akteur: NUTZER,
        zaehlerId,
        standX1000: 999_999_000,
        abgelesenAm: '2026-06-30',
        quelle: 'mieter',
      }),
    )
    await withMandant(v.app, mandant, (tx) =>
      storniereVersion(tx, {
        entitaet: 'zaehlerstand',
        mandantId: mandant,
        versionId: falsch.id,
        akteur: NUTZER,
        grund: 'Zahlendreher des Mieters',
      }),
    )

    const gueltig = await withMandant(v.app, mandant, (tx) =>
      tx.execute<{ id: string; stand_x1000: number }>(
        sql`select id, stand_x1000 from zaehlerstaende_gueltig where zaehler_id = ${zaehlerId} order by abgelesen_am`,
      ),
    )
    expect(gueltig.map((r) => r.id)).toEqual([s1.id])
    expect(gueltig[0]?.stand_x1000).toBe(123_456)

    await erwarteFehler(
      () => v.owner.execute(sql`update zaehlerstaende set stand_x1000 = 1 where id = ${s1.id}`),
      /append-only/,
    )
  })

  it('ein Zählerstand kann nicht an den Zähler eines fremden Mandanten', async () => {
    const fremd = await neuerMandant(v.app, 'Fremd')
    await erwarteFehler(
      () =>
        withMandant(v.app, fremd, (tx) =>
          neuerZaehlerstand(tx, {
            mandantId: fremd,
            akteur: NUTZER,
            zaehlerId,
            standX1000: 1,
            abgelesenAm: '2026-01-01',
            quelle: 'manuell',
          }),
        ),
      /Mandanten der Identität/,
    )
  })
})

describe('Darlehen und Dokumente', () => {
  it('Darlehen am Objekt', async () => {
    const d = await withMandant(v.app, mandant, (tx) =>
      neueVersion(tx, {
        entitaet: 'darlehen',
        mandantId: mandant,
        akteur: NUTZER,
        gueltigAb: '2020-03-01',
        identitaet: { objektId },
        daten: {
          bank: 'Sparkasse',
          nominalCent: 25_000_000,
          zinsBp: 145,
          tilgungBp: 200,
          rateCent: 71_875,
          zinsbindungBis: '2030-02-28',
        },
      }),
    )
    const a = await withMandant(v.app, mandant, (tx) => aktuell(tx, 'darlehen', d.identId))
    expect(a?.nominalCent).toBe(25_000_000)
    expect(a?.zinsBp).toBe(145)
  })

  it('Dokument: Datei in der Identität, Status versioniert, Bezug Pflicht', async () => {
    const identitaet = {
      objektId,
      dateiHash: 'ab'.repeat(32),
      speicherSchluessel: `${mandant}/dok/kaufvertrag.pdf`,
      dateiname: 'kaufvertrag.pdf',
      mime: 'application/pdf',
      groesseBytes: 123_456,
    }
    const d = await withMandant(v.app, mandant, (tx) =>
      neueVersion(tx, {
        entitaet: 'dokument',
        mandantId: mandant,
        akteur: NUTZER,
        gueltigAb: '2020-01-15',
        identitaet,
        daten: {
          typ: 'kaufvertrag',
          titel: 'Kaufvertrag Musterstraße 1',
          dokumentdatum: '2020-01-15',
          seiten: 42,
        },
      }),
    )
    const a = await withMandant(v.app, mandant, (tx) => aktuell(tx, 'dokument', d.identId))
    expect(a?.status).toBe('gueltig')

    // Status „ersetzt“ ist eine neue Version, die Datei bleibt.
    await withMandant(v.app, mandant, (tx) =>
      neueVersion(tx, {
        entitaet: 'dokument',
        mandantId: mandant,
        akteur: NUTZER,
        gueltigAb: '2026-01-01',
        identId: d.identId,
        begruendung: 'Nachtrag ersetzt den Vertrag',
        daten: {
          typ: 'kaufvertrag',
          status: 'ersetzt',
          titel: 'Kaufvertrag Musterstraße 1',
          seiten: 42,
        },
      }),
    )
    const b = await withMandant(v.app, mandant, (tx) => aktuell(tx, 'dokument', d.identId))
    expect(b?.status).toBe('ersetzt')

    await erwarteFehler(
      () =>
        withMandant(v.app, mandant, (tx) =>
          neueVersion(tx, {
            entitaet: 'dokument',
            mandantId: mandant,
            akteur: NUTZER,
            gueltigAb: '2020-01-15',
            identitaet: { ...identitaet, objektId: null, speicherSchluessel: 'x/y.pdf' },
            daten: { typ: 'sonstiges', titel: 'ohne Bezug' },
          }),
        ),
      /dokumente_bezug_chk/,
    )
  })
})

describe('Eigentumsanteile', () => {
  it('Anteil an einer Person, versioniert; Bruch > 1 scheitert an der Datenbank', async () => {
    const a = await withMandant(v.app, mandant, (tx) =>
      neueVersion(tx, {
        entitaet: 'eigentumsanteil',
        mandantId: mandant,
        akteur: NUTZER,
        gueltigAb: '2020-01-01',
        identitaet: { personId },
        daten: { zaehler: 1, nenner: 2 },
      }),
    )
    const s = await withMandant(v.app, mandant, (tx) => aktuell(tx, 'eigentumsanteil', a.identId))
    expect([s?.zaehler, s?.nenner]).toEqual([1, 2])
    await erwarteFehler(
      () =>
        withMandant(v.app, mandant, (tx) =>
          neueVersion(tx, {
            entitaet: 'eigentumsanteil',
            mandantId: mandant,
            akteur: NUTZER,
            gueltigAb: '2026-01-01',
            identId: a.identId,
            begruendung: 'Tippfehler',
            daten: { zaehler: 3, nenner: 2 },
          }),
        ),
      /eigentumsanteil_bruch_chk/,
    )
  })
})

describe('Registry', () => {
  it('jede Entität hat Sicht, Stand-Funktion und Schreibschutz', async () => {
    for (const name of Object.keys(ENTITAETEN)) {
      const def = ENTITAETEN[name as keyof typeof ENTITAETEN]
      const ident = (def.identitaet as unknown as { [k: symbol]: string })[
        Symbol.for('drizzle:Name')
      ]
      const [sicht] = await v.owner.execute<{ n: number }>(
        sql`select count(*)::int as n from pg_views where viewname = ${ident + '_aktuell'}`,
      )
      const [fn] = await v.owner.execute<{ n: number }>(
        sql`select count(*)::int as n from pg_proc where proname = ${name + '_stand'}`,
      )
      const [trg] = await v.owner.execute<{ n: number }>(
        sql`select count(*)::int as n from pg_trigger where tgname = ${ident + '_append_only'}`,
      )
      expect({ name, sicht: sicht?.n, fn: fn?.n, trg: trg?.n }).toEqual({
        name,
        sicht: 1,
        fn: 1,
        trg: 1,
      })
    }
  })
})
