import { sql } from 'drizzle-orm'
import {
  pruefeDatenqualitaet,
  type Datenqualitaet,
  type EinheitStand,
  type ObjektStand,
} from '@vermieteros/rechenkern'
import type {
  DarlehenDaten,
  EigentuemerschaftArt,
  EinheitDaten,
  MietkonditionDaten,
  MietverhaeltnisDaten,
  ObjektDaten,
} from '@vermieteros/schema'
import type { Tx } from './client'
import { aktuell } from './ledger'

/**
 * Lädt den aktuellen Stand eines Objekts aus den `*_aktuell`-Sichten und lässt den
 * Rechenkern prüfen. Muss innerhalb von `withMandant()` laufen.
 */
export async function datenqualitaet(tx: Tx, objektId: string): Promise<Datenqualitaet | null> {
  const objekt = await aktuell(tx, 'objekt', objektId)
  if (!objekt) return null

  const einheitRows = await tx.execute<{ id: string }>(
    sql`select e.id from einheiten e where e.objekt_id = ${objektId} order by e.erstellt_am`,
  )
  const einheiten: EinheitStand[] = []
  for (const { id: einheitId } of einheitRows) {
    const e = await aktuell(tx, 'einheit', einheitId)
    if (!e) continue
    const mvRows = await tx.execute<{ id: string }>(
      sql`select m.id from mietverhaeltnisse m where m.einheit_id = ${einheitId} order by m.erstellt_am`,
    )
    const mietverhaeltnisse: EinheitStand['mietverhaeltnisse'] = []
    for (const { id: mvId } of mvRows) {
      const mv = await aktuell(tx, 'mietverhaeltnis', mvId)
      if (!mv) continue
      const [mk] = await tx.execute<{ id: string }>(
        sql`select k.id from mietkonditionen k where k.mietverhaeltnis_id = ${mvId} order by k.erstellt_am limit 1`,
      )
      const kondition = mk ? await aktuell(tx, 'mietkondition', mk.id) : null
      mietverhaeltnisse.push({
        id: mvId,
        daten: ohneSystemspalten<MietverhaeltnisDaten>(mv),
        kondition: kondition
          ? { ...ohneSystemspalten<MietkonditionDaten>(kondition), gueltigAb: kondition.gueltigAb }
          : null,
      })
    }
    einheiten.push({ id: einheitId, daten: ohneSystemspalten<EinheitDaten>(e), mietverhaeltnisse })
  }

  const darlehenRows = await tx.execute<{ id: string }>(
    sql`select d.id from darlehen d where d.objekt_id = ${objektId} order by d.erstellt_am`,
  )
  const darlehen: ObjektStand['darlehen'] = []
  for (const { id } of darlehenRows) {
    const d = await aktuell(tx, 'darlehen', id)
    if (d) darlehen.push({ id, daten: ohneSystemspalten<DarlehenDaten>(d) })
  }

  const [mandant] = await tx.execute<{ id: string; art: EigentuemerschaftArt }>(
    sql`select id, art from mandanten limit 1`,
  )
  const anteile = await tx.execute<{ zaehler: number; nenner: number }>(
    sql`select zaehler, nenner from eigentumsanteile_aktuell`,
  )

  return pruefeDatenqualitaet({
    id: objektId,
    objekt: ohneSystemspalten<ObjektDaten>(objekt),
    einheiten,
    darlehen,
    ...(mandant
      ? {
          eigentum: {
            mandantId: mandant.id,
            art: mandant.art,
            anteile: anteile.map((a) => ({ zaehler: a.zaehler, nenner: a.nenner })),
          },
        }
      : {}),
  })
}

const SYSTEMSPALTEN = new Set([
  'id',
  'mandantId',
  'versionNr',
  'gueltigAb',
  'erfasstAm',
  'erfasstVon',
  'ereignisId',
  'begruendung',
  'herkunft',
  'objektId',
  'einheitId',
  'personId',
  'mietverhaeltnisId',
  'mietkonditionId',
  'zaehlerId',
  'darlehenId',
  'dokumentId',
  'eigentumsanteilId',
])

// Die Sichten liefern Versionszeilen; der Rechenkern will nur Fachdaten.
function ohneSystemspalten<T>(v: Record<string, unknown>): T {
  const out: Record<string, unknown> = {}
  for (const [k, val] of Object.entries(v)) if (!SYSTEMSPALTEN.has(k)) out[k] = val
  return out as T
}
