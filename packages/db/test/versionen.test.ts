import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { v7 as uuidv7 } from 'uuid'
import { aktuell, neueVersion, stand, storniereVersion } from '../src/ledger'
import { withMandant } from '../src/mandant'
import { NUTZER, erwarteFehler, neuerMandant, verbindungen } from './helfer'

const v = verbindungen()
afterAll(() => v.close())

let mandant: string
let objektId: string
let einheitId: string
let v1: string
let v2: string
let v2ErfasstAm: string
let stornoZeit: string

beforeAll(async () => {
  mandant = await neuerMandant(v.app, 'Versionen')
  const o = await withMandant(v.app, mandant, (tx) =>
    neueVersion(tx, {
      entitaet: 'objekt',
      mandantId: mandant,
      akteur: NUTZER,
      gueltigAb: '2020-01-01',
      identitaet: {},
      daten: { bezeichnung: 'Musterstraße 1', art: 'haus', ort: 'Köln' },
    }),
  )
  objektId = o.identId
})

describe('Versionsmuster: zwei Zeitachsen', () => {
  it('Version 1 braucht keine Begründung, speichert Herkunft', async () => {
    const r = await withMandant(v.app, mandant, (tx) =>
      neueVersion(tx, {
        entitaet: 'einheit',
        mandantId: mandant,
        akteur: NUTZER,
        gueltigAb: '2025-01-01',
        identitaet: { objektId },
        herkunft: { wohnflaecheQm100: { quelle: 'dokument', dokumentId: 'dok-1', seite: 3 } },
        daten: { bezeichnung: 'EG links', wohnflaecheQm100: 7250 },
      }),
    )
    einheitId = r.identId
    v1 = r.versionId
    expect(r.versionNr).toBe(1)

    const a = await withMandant(v.app, mandant, (tx) => aktuell(tx, 'einheit', einheitId))
    expect(a?.wohnflaecheQm100).toBe(7250)
    expect(a?.herkunft).toEqual({
      wohnflaecheQm100: { quelle: 'dokument', dokumentId: 'dok-1', seite: 3 },
    })
  })

  it('Version 2 ohne Begründung wird abgelehnt (Code und Datenbank)', async () => {
    await erwarteFehler(
      () =>
        withMandant(v.app, mandant, (tx) =>
          neueVersion(tx, {
            entitaet: 'einheit',
            mandantId: mandant,
            akteur: NUTZER,
            gueltigAb: '2026-01-01',
            identId: einheitId,
            daten: { bezeichnung: 'EG links', wohnflaecheQm100: 7000 },
          }),
        ),
      /Begründung/,
    )

    // Direkt an der Datenbank vorbei am TS-Check: Check-Constraint greift.
    await erwarteFehler(
      () =>
        withMandant(v.app, mandant, async (tx) => {
          const [e] = await tx.execute<{ id: string }>(
            sql`insert into ereignisse (id, mandant_id, typ, akteur_art, akteur_id) values (${uuidv7()}, ${mandant}, 'version_angelegt', 'nutzer', 't') returning id`,
          )
          await tx.execute(
            sql`insert into einheit_versionen (id, mandant_id, version_nr, gueltig_ab, erfasst_von, ereignis_id, einheit_id, bezeichnung)
              values (${uuidv7()}, ${mandant}, 2, '2026-01-01', 't', ${e!.id}, ${einheitId}, 'x')`,
          )
        }),
      /begruendung_chk/,
    )
  })

  it('Version 2 mit neuem gueltig_ab: aktuell zeigt sie, Stand in der Vergangenheit zeigt Version 1', async () => {
    const r = await withMandant(v.app, mandant, (tx) =>
      neueVersion(tx, {
        entitaet: 'einheit',
        mandantId: mandant,
        akteur: NUTZER,
        gueltigAb: '2026-01-01',
        identId: einheitId,
        begruendung: 'Neuvermessung nach WoFlV',
        herkunft: { wohnflaecheQm100: { quelle: 'dokument', dokumentId: 'dok-2', seite: 1 } },
        daten: { bezeichnung: 'EG links', wohnflaecheQm100: 7000 },
      }),
    )
    v2 = r.versionId
    expect(r.versionNr).toBe(2)

    const a = await withMandant(v.app, mandant, (tx) => aktuell(tx, 'einheit', einheitId))
    expect(a?.id).toBe(v2)
    v2ErfasstAm = a!.erfasstAm

    const s2025 = await withMandant(v.app, mandant, (tx) =>
      stand(tx, 'einheit', einheitId, '2025-06-30'),
    )
    expect(s2025?.id).toBe(v1)
    expect(s2025?.wohnflaecheQm100).toBe(7250)

    const s2026 = await withMandant(v.app, mandant, (tx) =>
      stand(tx, 'einheit', einheitId, '2026-03-01'),
    )
    expect(s2026?.id).toBe(v2)

    const vorher = await withMandant(v.app, mandant, (tx) =>
      stand(tx, 'einheit', einheitId, '2019-01-01'),
    )
    expect(vorher).toBeNull()
  })

  it('technische Zeitachse: was wussten wir vor der Erfassung von Version 2?', async () => {
    // Eine Mikrosekunde vor erfasst_am von v2 → v2 noch unbekannt, v1 galt als aktuell
    const [vorher] = await v.owner.execute<{ t: string }>(
      sql`select (${v2ErfasstAm}::timestamptz - interval '1 microsecond')::text as t`,
    )
    const s = await withMandant(v.app, mandant, (tx) =>
      stand(tx, 'einheit', einheitId, '2026-03-01', vorher!.t),
    )
    expect(s?.id).toBe(v1)
  })

  it('rückwirkende Korrektur: späteres erfasst_am gewinnt bei gleichem gueltig_ab', async () => {
    const r = await withMandant(v.app, mandant, (tx) =>
      neueVersion(tx, {
        entitaet: 'einheit',
        mandantId: mandant,
        akteur: NUTZER,
        gueltigAb: '2025-01-01',
        identId: einheitId,
        begruendung: 'Tippfehler in der Wohnfläche 2025',
        daten: { bezeichnung: 'EG links', wohnflaecheQm100: 7300 },
      }),
    )
    expect(r.versionNr).toBe(3)
    const s2025 = await withMandant(v.app, mandant, (tx) =>
      stand(tx, 'einheit', einheitId, '2025-06-30'),
    )
    expect(s2025?.id).toBe(r.versionId)
    expect(s2025?.wohnflaecheQm100).toBe(7300)
    // 2026 gilt weiterhin die Version mit gueltig_ab 2026-01-01
    const a = await withMandant(v.app, mandant, (tx) => aktuell(tx, 'einheit', einheitId))
    expect(a?.id).toBe(v2)
  })

  it('Storno nimmt eine Version aus den Sichten, bleibt aber reproduzierbar', async () => {
    const r = await withMandant(v.app, mandant, (tx) =>
      storniereVersion(tx, {
        entitaet: 'einheit',
        mandantId: mandant,
        versionId: v2,
        akteur: NUTZER,
        grund: 'Neuvermessung war fehlerhaft',
      }),
    )
    expect(r.ereignisId).toBeTruthy()
    const [st] = await withMandant(v.app, mandant, (tx) =>
      tx.execute<{ erfasst_am: string }>(
        sql`select erfasst_am from stornos where version_id = ${v2}`,
      ),
    )
    stornoZeit = st!.erfasst_am

    // Jetzt gilt die rückwirkende Korrektur (v3, gueltig_ab 2025-01-01) auch heute.
    const a = await withMandant(v.app, mandant, (tx) => aktuell(tx, 'einheit', einheitId))
    expect(a?.versionNr).toBe(3)

    // Stand vor dem Storno: v2 war gültig. Das braucht die Festschreibung.
    const [vorher] = await v.owner.execute<{ t: string }>(
      sql`select (${stornoZeit}::timestamptz - interval '1 microsecond')::text as t`,
    )
    const s = await withMandant(v.app, mandant, (tx) =>
      stand(tx, 'einheit', einheitId, '2026-03-01', vorher!.t),
    )
    expect(s?.id).toBe(v2)
  })

  it('Versionen und Identitäten sind append-only', async () => {
    await erwarteFehler(
      () => v.owner.execute(sql`update einheit_versionen set bezeichnung = 'x' where id = ${v1}`),
      /append-only/,
    )
    await erwarteFehler(
      () => v.owner.execute(sql`delete from einheiten where id = ${einheitId}`),
      /append-only/,
    )
    await erwarteFehler(
      () => v.owner.execute(sql`delete from stornos where version_id = ${v2}`),
      /append-only/,
    )
  })

  it('eine Version kann nicht an die Identität eines anderen Mandanten gehängt werden', async () => {
    const fremd = await neuerMandant(v.app, 'Fremd')
    await erwarteFehler(
      () =>
        withMandant(v.app, fremd, (tx) =>
          neueVersion(tx, {
            entitaet: 'einheit',
            mandantId: fremd,
            akteur: NUTZER,
            gueltigAb: '2025-01-01',
            identId: einheitId, // gehört zu `mandant`
            daten: { bezeichnung: 'Einbruch' },
          }),
        ),
      /Mandanten der Identität/,
    )
  })
})
