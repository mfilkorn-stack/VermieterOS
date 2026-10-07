import type { JournalEintragDaten } from '@vermieteros/schema'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  belegMitHash,
  bucheJournal,
  journalSummen,
  ladeBeleg,
  listeBelege,
  listeJournal,
  offeneBelege,
  storniereJournal,
} from '../src/journal'
import { neueVersion } from '../src/ledger'
import { withMandant } from '../src/mandant'
import { NUTZER, erwarteFehler, neuerMandant, verbindungen } from './helfer'

const v = verbindungen()
afterAll(() => v.close())

let a: string
let b: string
let haus1: string
let haus2: string
let fremdesObjekt: string

const objekt = (m: string, bezeichnung: string) =>
  withMandant(v.app, m, (tx) =>
    neueVersion(tx, {
      entitaet: 'objekt',
      mandantId: m,
      akteur: NUTZER,
      gueltigAb: '2024-01-01',
      identitaet: {},
      daten: { bezeichnung, art: 'haus' },
    }),
  ).then((r) => r.identId)

const beleg = (m: string, hash: string) =>
  withMandant(v.app, m, (tx) =>
    neueVersion(tx, {
      entitaet: 'dokument',
      mandantId: m,
      akteur: NUTZER,
      gueltigAb: '2026-01-10',
      identitaet: {
        beleg: true,
        dateiHash: hash.repeat(64).slice(0, 64),
        speicherSchluessel: `${m}/dokument/${hash}`,
        dateiname: 'rechnung.pdf',
        mime: 'application/pdf',
        groesseBytes: 1000,
      },
      daten: { typ: 'beleg', status: 'gueltig', titel: 'Rechnung Stadtwerke' },
    }),
  ).then((r) => r.identId)

const wasser = (anteile: JournalEintragDaten['anteile']): JournalEintragDaten => ({
  richtung: 'ausgabe',
  gegenpartei: 'Stadtwerke Musterstadt',
  zahlungsdatum: '2026-01-15',
  leistungVon: '2025-01-01',
  leistungBis: '2025-12-31',
  bruttoCent: 48_150,
  umsatzsteuerCent: 3_150,
  steuerkategorie: 'betriebskosten',
  kostenart: 'wasserversorgung',
  umlagefaehig: true,
  anteile,
})

const buche = (m: string, daten: JournalEintragDaten, dokumentId?: string) =>
  withMandant(v.app, m, (tx) =>
    bucheJournal(tx, { mandantId: m, akteur: NUTZER, daten, dokumentId: dokumentId ?? null }),
  )

beforeAll(async () => {
  a = await neuerMandant(v.app, 'Journal A')
  b = await neuerMandant(v.app, 'Journal B')
  haus1 = await objekt(a, 'Haus 1')
  haus2 = await objekt(a, 'Haus 2')
  fremdesObjekt = await objekt(b, 'Fremd')
})

describe('Journal', () => {
  it('vergibt fortlaufende Belegnummern je Zahlungsjahr', async () => {
    const r1 = await buche(a, wasser([{ objektId: haus1, betragCent: 48_150 }]))
    const r2 = await buche(a, wasser([{ objektId: haus1, betragCent: 48_150 }]))
    const r3 = await buche(a, {
      ...wasser([{ objektId: haus1, betragCent: 48_150 }]),
      zahlungsdatum: '2025-12-30',
    })
    expect([r1.belegnummer, r2.belegnummer, r3.belegnummer]).toEqual([
      '2026-0001',
      '2026-0002',
      '2025-0001',
    ])
    // Der andere Mandant zählt eigenständig.
    const rb = await buche(b, wasser([{ objektId: fremdesObjekt, betragCent: 48_150 }]))
    expect(rb.belegnummer).toBe('2026-0001')
  })

  it('Anteile müssen den Bruttobetrag ergeben (geprüft beim Commit)', async () => {
    await erwarteFehler(
      () =>
        buche(
          a,
          wasser([
            { objektId: haus1, betragCent: 20_000 },
            { objektId: haus2, betragCent: 20_000 },
          ]),
        ),
      /ergeben nicht den Bruttobetrag/,
    )
  })

  it('Aufteilung auf zwei Objekte: Summen je Objekt anteilig', async () => {
    const m = await neuerMandant(v.app, 'Aufteilung')
    const o1 = await objekt(m, 'Links')
    const o2 = await objekt(m, 'Rechts')
    await buche(m, {
      richtung: 'ausgabe',
      gegenpartei: 'Steuerberatung Muster',
      zahlungsdatum: '2026-03-01',
      bruttoCent: 100_001,
      steuerkategorie: 'verwaltungskosten',
      umlagefaehig: false,
      anteile: [
        { objektId: o1, betragCent: 50_001 },
        { objektId: o2, betragCent: 50_000 },
      ],
    })
    const gesamt = await withMandant(v.app, m, (tx) => journalSummen(tx, { jahr: 2026 }))
    expect(gesamt).toEqual([
      { richtung: 'ausgabe', steuerkategorie: 'verwaltungskosten', summeCent: 100_001, anzahl: 1 },
    ])
    const links = await withMandant(v.app, m, (tx) =>
      journalSummen(tx, { jahr: 2026, objektId: o1 }),
    )
    expect(links[0]?.summeCent).toBe(50_001)
    const liste = await withMandant(v.app, m, (tx) =>
      listeJournal(tx, { jahr: 2026, objektId: o2 }),
    )
    expect(liste).toHaveLength(1)
    expect(liste[0]?.anteile.map((x) => x.objekt)).toEqual(['Links', 'Rechts'])
  })

  it('kein Anteil an einem fremden Objekt', async () => {
    await erwarteFehler(
      () => buche(a, wasser([{ objektId: fremdesObjekt, betragCent: 48_150 }])),
      /gehört nicht zum Mandanten/,
    )
  })

  it('fachliche Regeln auch in der Datenbank', async () => {
    await erwarteFehler(
      () =>
        buche(a, {
          ...wasser([{ objektId: haus1, betragCent: 48_150 }]),
          steuerkategorie: 'mieteinnahmen',
        }),
      /journal_kategorie_chk/,
    )
    await erwarteFehler(
      () =>
        buche(a, {
          ...wasser([{ objektId: haus1, betragCent: 48_150 }]),
          kostenart: null,
        }),
      /journal_umlage_chk/,
    )
  })

  it('append-only: kein UPDATE, kein DELETE', async () => {
    await erwarteFehler(
      () =>
        withMandant(v.app, a, (tx) =>
          tx.execute(sql`UPDATE journal_eintraege SET brutto_cent = 1`),
        ),
      /permission denied|append-only|erlaubt kein/,
    )
    await erwarteFehler(
      () => withMandant(v.owner, a, (tx) => tx.execute(sql`DELETE FROM journal_anteile`)),
      /append-only|erlaubt kein|DELETE/,
    )
  })

  it('RLS: Mandant B sieht die Buchungen von A nicht', async () => {
    const liste = await withMandant(v.app, b, (tx) => listeJournal(tx, { jahr: 2026 }))
    expect(liste.every((e) => e.anteile.every((x) => x.objektId === fremdesObjekt))).toBe(true)
  })
})

describe('Belegeingang', () => {
  it('Beleg ohne Objekt: offen bis zur Buchung, danach gebucht; Storno öffnet ihn wieder', async () => {
    const m = await neuerMandant(v.app, 'Belege')
    const o = await objekt(m, 'Haus')
    const d = await beleg(m, 'a')
    expect(await withMandant(v.app, m, (tx) => offeneBelege(tx))).toBe(1)
    expect(await withMandant(v.app, m, (tx) => belegMitHash(tx, 'a'.repeat(64)))).toBe(d)

    const r = await buche(m, wasser([{ objektId: o, betragCent: 48_150 }]), d)
    expect(await withMandant(v.app, m, (tx) => offeneBelege(tx))).toBe(0)
    const gebucht = await withMandant(v.app, m, (tx) => listeBelege(tx, { status: 'gebucht' }))
    expect(gebucht.map((x) => x.buchung?.belegnummer)).toEqual([r.belegnummer])

    // Ein Beleg ist höchstens einmal gültig gebucht.
    await erwarteFehler(
      () => buche(m, wasser([{ objektId: o, betragCent: 48_150 }]), d),
      /bereits gebucht/,
    )

    await withMandant(v.app, m, (tx) =>
      storniereJournal(tx, { mandantId: m, akteur: NUTZER, id: r.id, grund: 'Falscher Betrag' }),
    )
    const nachStorno = await withMandant(v.app, m, (tx) => ladeBeleg(tx, d))
    expect(nachStorno?.buchung).toBeNull()
    const mitStorno = await withMandant(v.app, m, (tx) =>
      listeJournal(tx, { jahr: 2026, mitStorno: true }),
    )
    expect(mitStorno[0]?.storno?.grund).toBe('Falscher Betrag')
    expect(await withMandant(v.app, m, (tx) => listeJournal(tx, { jahr: 2026 }))).toEqual([])

    // Neubuchung bekommt eine neue Nummer.
    const neu = await buche(m, wasser([{ objektId: o, betragCent: 48_150 }]), d)
    expect(neu.belegnummer).toBe('2026-0002')
    await erwarteFehler(
      () =>
        withMandant(v.app, m, (tx) =>
          storniereJournal(tx, { mandantId: m, akteur: NUTZER, id: r.id, grund: 'nochmal' }),
        ),
      /bereits storniert/,
    )
  })

  it('andere Dokumente brauchen weiterhin Objekt oder Mietverhältnis', async () => {
    await erwarteFehler(
      () =>
        withMandant(v.app, a, (tx) =>
          neueVersion(tx, {
            entitaet: 'dokument',
            mandantId: a,
            akteur: NUTZER,
            gueltigAb: '2026-01-10',
            identitaet: {
              dateiHash: 'b'.repeat(64),
              speicherSchluessel: 'x',
              dateiname: 'x.pdf',
              mime: 'application/pdf',
              groesseBytes: 1,
            },
            daten: { typ: 'sonstiges', status: 'gueltig', titel: 'Lose' },
          }),
        ),
      /dokumente_bezug_chk/,
    )
  })

  it('der Worker darf Belege ablegen, aber nicht buchen', async () => {
    const m = await neuerMandant(v.app, 'Worker-Belege')
    const o = await objekt(m, 'Haus')
    await withMandant(v.worker, m, (tx) =>
      neueVersion(tx, {
        entitaet: 'dokument',
        mandantId: m,
        akteur: { art: 'system', id: 'mail-abruf' },
        gueltigAb: '2026-01-10',
        identitaet: {
          beleg: true,
          dateiHash: 'c'.repeat(64),
          speicherSchluessel: 'y',
          dateiname: 'y.pdf',
          mime: 'application/pdf',
          groesseBytes: 1,
        },
        daten: { typ: 'beleg', status: 'gueltig', titel: 'Per Mail' },
      }),
    )
    await erwarteFehler(
      () =>
        withMandant(v.worker, m, (tx) =>
          bucheJournal(tx, {
            mandantId: m,
            akteur: { art: 'system', id: 'x' },
            daten: wasser([{ objektId: o, betragCent: 48_150 }]),
          }),
        ),
      /permission denied/,
    )
  })
})
