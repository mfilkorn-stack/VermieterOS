import { getTableName, sql } from 'drizzle-orm'
import type { Tx } from './client'
import { ENTITAETEN, storniereVersion, type EntitaetName } from './ledger'
import type { Akteur } from './schema/index'

/**
 * Löschen von Häusern und Wohnungen (Objekt), Einheiten und Mietverhältnissen.
 *
 * Nichts wird physisch entfernt: alle Versionen werden storniert (Ledger, Grund, Akteur), damit
 * fallen sie aus den `_aktuell`-Sichten. Gelöscht wird nur, was nichts trägt. Hängen Buchungen,
 * Belege, Dokumente, Tickets, Mails oder Abrechnungen daran, nennt `loeschHindernisse` sie; diese
 * Daten unterliegen Aufbewahrungspflichten und dürfen nicht mit verschwinden.
 */

export type Loeschbar = 'objekt' | 'einheit' | 'mietverhaeltnis'

type Pruefung = { text: string; abfrage: ReturnType<typeof sql> }

function pruefungen(entitaet: Loeschbar, id: string): Pruefung[] {
  // Versionierte Bezüge: Identitätstabelle trägt den Fremdschlüssel, die Sicht sagt, ob der
  // Datensatz noch gilt (nicht storniert). Tabellen- und Spaltennamen sind feste Konstanten.
  const versioniert = (
    tabelle: string,
    sicht: string,
    fk: string,
    spalte: string,
    text: string,
  ): Pruefung => ({
    text,
    abfrage: sql`SELECT count(*)::int AS n FROM ${sql.identifier(tabelle)} i
      JOIN ${sql.identifier(sicht)} a ON ${sql.raw('a.' + fk)} = i.id
      WHERE ${sql.raw('i.' + spalte)} = ${id}`,
  })
  const direkt = (tabelle: string, spalte: string, text: string): Pruefung => ({
    text,
    abfrage: sql`SELECT count(*)::int AS n FROM ${sql.identifier(tabelle)} WHERE ${sql.identifier(spalte)} = ${id}`,
  })
  const buchungen = (spalte: 'objekt_id' | 'einheit_id'): Pruefung => ({
    text: 'Buchungen im Journal',
    abfrage: sql`SELECT count(*)::int AS n FROM journal_anteile a
      WHERE ${sql.raw('a.' + spalte)} = ${id}
        AND NOT EXISTS (SELECT 1 FROM stornos s WHERE s.version_id = a.eintrag_id)`,
  })
  if (entitaet === 'objekt')
    return [
      versioniert(
        'einheiten',
        'einheiten_aktuell',
        'einheit_id',
        'objekt_id',
        'Einheiten (zuerst löschen)',
      ),
      buchungen('objekt_id'),
      direkt('tickets', 'objekt_id', 'Tickets'),
      versioniert(
        'dokumente',
        'dokumente_aktuell',
        'dokument_id',
        'objekt_id',
        'Dokumente oder Belege',
      ),
      direkt('steuerpakete', 'objekt_id', 'Steuerpakete'),
      versioniert('darlehen', 'darlehen_aktuell', 'darlehen_id', 'objekt_id', 'Darlehen'),
      versioniert('zaehler', 'zaehler_aktuell', 'zaehler_id', 'objekt_id', 'Zähler'),
      direkt('nachrichten_zuordnung_aktuell', 'objekt_id', 'zugeordnete Mails'),
    ]
  if (entitaet === 'einheit')
    return [
      versioniert(
        'mietverhaeltnisse',
        'mietverhaeltnisse_aktuell',
        'mietverhaeltnis_id',
        'einheit_id',
        'Mietverhältnisse (zuerst löschen)',
      ),
      buchungen('einheit_id'),
      direkt('tickets', 'einheit_id', 'Tickets'),
      direkt('bk_abrechnungen', 'einheit_id', 'Betriebskostenabrechnungen'),
      versioniert('zaehler', 'zaehler_aktuell', 'zaehler_id', 'einheit_id', 'Zähler'),
    ]
  return [
    versioniert('dokumente', 'dokumente_aktuell', 'dokument_id', 'mietverhaeltnis_id', 'Dokumente'),
    direkt('tickets', 'mietverhaeltnis_id', 'Tickets'),
    direkt('portal_zugaenge', 'mietverhaeltnis_id', 'Zugang zum Mieterportal'),
    direkt('portal_nachrichten', 'mietverhaeltnis_id', 'Nachrichten aus dem Mieterportal'),
    direkt('antworten', 'mietverhaeltnis_id', 'verschickte Antworten'),
    direkt('telefonnotizen_aktuell', 'mietverhaeltnis_id', 'Telefonnotizen'),
    direkt('nachrichten_zuordnung_aktuell', 'mietverhaeltnis_id', 'zugeordnete Mails'),
  ]
}

/** Was das Löschen verhindert, als lesbare Liste; leer heißt löschbar. */
export async function loeschHindernisse(
  tx: Tx,
  entitaet: Loeschbar,
  id: string,
): Promise<string[]> {
  const hindernisse: string[] = []
  for (const p of pruefungen(entitaet, id)) {
    const [r] = await tx.execute<{ n: number }>(p.abfrage)
    if ((r?.n ?? 0) > 0) hindernisse.push(p.text)
  }
  return hindernisse
}

/** Storniert alle noch gültigen Versionen einer Entität; liefert deren Anzahl. */
async function storniereEntitaet(
  tx: Tx,
  e: EntitaetName,
  identId: string,
  p: { mandantId: string; akteur: Akteur; grund: string },
): Promise<number> {
  const def = ENTITAETEN[e]
  const tabelle = getTableName(def.versionen)
  const spalte = (def.versionen as unknown as Record<string, { name: string }>)[def.fk]!.name
  const ids = await tx.execute<{ id: string }>(sql`
    SELECT v.id FROM ${sql.identifier(tabelle)} v
    WHERE ${sql.identifier(spalte)} = ${identId}
      AND NOT EXISTS (SELECT 1 FROM stornos s WHERE s.version_id = v.id)`)
  for (const v of ids) {
    await storniereVersion(tx, { entitaet: e, versionId: v.id, ...p })
  }
  return ids.length
}

async function identIds(tx: Tx, tabelle: string, spalte: string, id: string): Promise<string[]> {
  const rows = await tx.execute<{ id: string }>(
    sql`SELECT id FROM ${sql.identifier(tabelle)} WHERE ${sql.identifier(spalte)} = ${id}`,
  )
  return rows.map((r) => r.id)
}

/**
 * Löscht ein Haus oder eine Wohnung, eine Einheit oder ein Mietverhältnis samt dem, was nur
 * dazu gehört (Objekt: Notfallkarte, Wissen; Mietverhältnis: Konditionen und
 * die Personen der Mietpartei). Wirft, wenn `loeschHindernisse` etwas meldet.
 */
export async function loesche(
  tx: Tx,
  entitaet: Loeschbar,
  id: string,
  p: { mandantId: string; akteur: Akteur; grund: string },
): Promise<void> {
  const hindernisse = await loeschHindernisse(tx, entitaet, id)
  if (hindernisse.length)
    throw new Error('Löschen nicht möglich, es hängen noch daran: ' + hindernisse.join(', '))

  if (entitaet === 'objekt') {
    for (const n of await identIds(tx, 'notfallkarten', 'objekt_id', id))
      await storniereEntitaet(tx, 'notfallkarte', n, p)
    for (const w of await identIds(tx, 'wissensartikel', 'objekt_id', id))
      await storniereEntitaet(tx, 'wissensartikel', w, p)
  }
  if (entitaet === 'mietverhaeltnis') {
    for (const k of await identIds(tx, 'mietkonditionen', 'mietverhaeltnis_id', id))
      await storniereEntitaet(tx, 'mietkondition', k, p)
    const [mv] = await tx.execute<{ mieter_ids: string[] | null }>(sql`
      SELECT mieter_ids FROM mietverhaeltnis_versionen WHERE mietverhaeltnis_id = ${id}
      ORDER BY erfasst_am DESC LIMIT 1`)
    for (const person of mv?.mieter_ids ?? []) await storniereEntitaet(tx, 'person', person, p)
  }
  if (!(await storniereEntitaet(tx, entitaet, id, p))) throw new Error('Nicht gefunden.')
}
