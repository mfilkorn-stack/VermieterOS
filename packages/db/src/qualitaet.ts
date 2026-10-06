import { sql } from 'drizzle-orm'
import {
  referenzwert,
  pruefeDatenqualitaet,
  type ReferenzEintrag,
  type ReferenzStand,
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
import { aktuell, fachdaten } from './ledger'

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
        daten: fachdaten('mietverhaeltnis', mv) as MietverhaeltnisDaten,
        kondition: kondition
          ? {
              ...(fachdaten('mietkondition', kondition) as MietkonditionDaten),
              gueltigAb: kondition.gueltigAb,
            }
          : null,
      })
    }
    einheiten.push({
      id: einheitId,
      daten: fachdaten('einheit', e) as EinheitDaten,
      mietverhaeltnisse,
    })
  }

  const darlehenRows = await tx.execute<{ id: string }>(
    sql`select d.id from darlehen d where d.objekt_id = ${objektId} order by d.erstellt_am`,
  )
  const darlehen: ObjektStand['darlehen'] = []
  for (const { id } of darlehenRows) {
    const d = await aktuell(tx, 'darlehen', id)
    if (d) darlehen.push({ id, daten: fachdaten('darlehen', d) as DarlehenDaten })
  }

  const [mandant] = await tx.execute<{ id: string; art: EigentuemerschaftArt }>(
    sql`select id, art from mandanten limit 1`,
  )
  const anteile = await tx.execute<{ zaehler: number; nenner: number }>(
    sql`select zaehler, nenner from eigentumsanteile_aktuell`,
  )

  const referenz = await grunderwerbsteuerFuer(tx, fachdaten('objekt', objekt) as ObjektDaten)

  return pruefeDatenqualitaet({
    referenz,
    id: objektId,
    objekt: fachdaten('objekt', objekt) as ObjektDaten,
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

/** Grunderwerbsteuersatz für Bundesland und Datum des Kaufvertrags (§ 23 GrEStG: Entstehung mit Vertrag). */
async function grunderwerbsteuerFuer(tx: Tx, o: ObjektDaten): Promise<ReferenzStand> {
  const datum = o.kaufvertragDatum ?? o.anschaffungsdatum
  if (!o.bundesland || !datum) return {}
  const eintraege = await ladeReferenzdaten<{ satzPromille: number }>(
    tx,
    'grunderwerbsteuer',
    o.bundesland,
  )
  const r = referenzwert(eintraege, datum, heute())
  return {
    grunderwerbsteuer: {
      status: r.status,
      satzPromille: r.eintrag?.wert.satzPromille ?? null,
      quelle: r.eintrag?.quelle ?? null,
    },
  }
}

/** Alle sichtbaren Einträge (global und eigener Mandant) zu Art und Schlüssel. */
export async function ladeReferenzdaten<W>(
  tx: Tx,
  art: string,
  schluessel: string,
): Promise<ReferenzEintrag<W>[]> {
  const rows = await tx.execute<{
    id: string
    mandant_id: string | null
    wert: W
    gueltig_von: string
    gueltig_bis: string | null
    quelle: string
    hinweis: string | null
    geprueft_am: string
    pruefen_bis: string
    erfasst_am: string
  }>(sql`select id, mandant_id, wert, gueltig_von, gueltig_bis, quelle, hinweis, geprueft_am, pruefen_bis,
              to_char(erfasst_am at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as erfasst_am
         from referenzdaten where art = ${art} and schluessel = ${schluessel}`)
  return rows.map((r) => ({
    id: r.id,
    mandantId: r.mandant_id,
    wert: r.wert,
    gueltigVon: r.gueltig_von,
    gueltigBis: r.gueltig_bis,
    quelle: r.quelle,
    hinweis: r.hinweis,
    geprueftAm: r.geprueft_am,
    pruefenBis: r.pruefen_bis,
    erfasstAm: r.erfasst_am,
  }))
}

function heute(): string {
  return new Date().toISOString().slice(0, 10)
}
