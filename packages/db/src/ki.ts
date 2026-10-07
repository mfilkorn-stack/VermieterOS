import { and, eq, sql } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import type { Tx } from './client'
import { ereignis } from './ereignis'
import {
  kiVorschlaege,
  kiVorschlagEntscheidungen,
  type Akteur,
  type KiEntscheidung,
  type KiStatus,
} from './schema/index'

/**
 * Datenzugriff für KI-Vorschläge (WP 1.4). Logik und Modellaufruf liegen in `packages/ki`.
 * Alle Funktionen laufen im Mandantenkontext (`withMandant`), RLS greift.
 */

export type Referenz = { entitaet: string; id: string }

/** Höchste Ledger-Sequenz des aktiven Mandanten (0, wenn noch nichts geschrieben ist). */
export async function ledgerStand(tx: Tx): Promise<number> {
  const [r] = await tx.execute<{ seq: string | number }>(
    sql`SELECT coalesce(max(seq), 0) AS seq FROM ereignisse`,
  )
  return Number(r?.seq ?? 0)
}

/** Ledger-Ereignisse nach `seitSeq`, die eine der Referenzen betreffen. Leer heißt: unverändert. */
export async function aenderungenSeit(
  tx: Tx,
  seitSeq: number,
  referenzen: Referenz[],
): Promise<Array<Referenz & { typ: string; seq: number }>> {
  if (referenzen.length === 0) return []
  const paare = sql.join(
    referenzen.map((r) => sql`(${r.entitaet}, ${r.id}::uuid)`),
    sql`, `,
  )
  const rows = await tx.execute<{
    entitaet: string
    entitaet_id: string
    typ: string
    seq: string
  }>(sql`
    SELECT entitaet, entitaet_id, typ, seq FROM ereignisse
    WHERE seq > ${seitSeq} AND (entitaet, entitaet_id) IN (${paare})
      -- Eigene Protokollierung der KI ändert keine Fakten.
      AND typ NOT IN ('ki_aufruf', 'ki_vorschlag', 'ki_vorschlag_entschieden')
    ORDER BY seq`)
  return rows.map((r) => ({
    entitaet: r.entitaet,
    id: r.entitaet_id,
    typ: r.typ,
    seq: Number(r.seq),
  }))
}

/** Prüfsummen der Dateien zu gültigen Dokumenten. Fehlende oder ungültige Dokumente fehlen im Ergebnis. */
export async function gueltigeDokumentHashes(
  tx: Tx,
  ids: string[],
): Promise<Record<string, string>> {
  if (ids.length === 0) return {}
  const rows = await tx.execute<{ id: string; datei_hash: string }>(sql`
    SELECT d.id, d.datei_hash FROM dokumente d
    JOIN dokumente_aktuell a ON a.dokument_id = d.id
    WHERE a.status = 'gueltig' AND d.id IN (${sql.join(
      ids.map((i) => sql`${i}::uuid`),
      sql`, `,
    )})`)
  return Object.fromEntries(rows.map((r) => [r.id, r.datei_hash]))
}

export type NeuerKiVorschlag = {
  mandantId: string
  aufgabe: string
  bezug: Referenz
  stempel: Record<string, unknown>
  ausgabe: Record<string, unknown>
  aufruf: Record<string, unknown>
  ablaufAm: string
  akteur: Akteur
}

export async function legeKiVorschlagAn(tx: Tx, v: NeuerKiVorschlag): Promise<string> {
  const id = uuidv7()
  await tx.insert(kiVorschlaege).values({
    id,
    mandantId: v.mandantId,
    aufgabe: v.aufgabe,
    bezugEntitaet: v.bezug.entitaet,
    bezugId: v.bezug.id,
    stempel: v.stempel,
    ausgabe: v.ausgabe,
    aufruf: v.aufruf,
    ablaufAm: v.ablaufAm,
    akteurArt: v.akteur.art,
    akteurId: v.akteur.id,
  })
  // Im Ledger nur Metadaten, keine Ausgabe des Modells.
  await ereignis(tx, {
    mandantId: v.mandantId,
    typ: 'ki_vorschlag',
    entitaet: 'ki_vorschlag',
    entitaetId: id,
    akteur: v.akteur,
    payload: {
      aufgabe: v.aufgabe,
      bezug: v.bezug,
      promptVersion: v.stempel['promptVersion'],
      modell: v.stempel['modell'],
      ledgerSeq: v.stempel['ledgerSeq'],
    },
  })
  return id
}

/**
 * Protokolliert einen Modellaufruf (PLAN 4.4): wer, welche Aufgabe, welcher Stempel, Erfolg.
 * Ohne Prompt-Inhalt und ohne Ausgabe.
 */
export async function protokolliereKiAufruf(
  tx: Tx,
  p: {
    mandantId: string
    bezug: Referenz
    akteur: Akteur
    payload: Record<string, unknown>
  },
): Promise<void> {
  await ereignis(tx, {
    mandantId: p.mandantId,
    typ: 'ki_aufruf',
    entitaet: 'ki_aufruf',
    entitaetId: uuidv7(),
    akteur: p.akteur,
    payload: { bezug: p.bezug, ...p.payload },
  })
}

export type KiVorschlag = {
  id: string
  aufgabe: string
  bezug: Referenz
  stempel: Record<string, unknown>
  ausgabe: Record<string, unknown>
  ablaufAm: string
  erfasstAm: string
  status: KiStatus
  entscheidungGrund: string | null
}

type VorschlagZeile = {
  id: string
  aufgabe: string
  bezug_entitaet: string
  bezug_id: string
  stempel: Record<string, unknown>
  ausgabe: Record<string, unknown>
  ablauf_am: string
  erfasst_am: string
  status: KiStatus
  entscheidung_grund: string | null
}

function alsVorschlag(r: VorschlagZeile): KiVorschlag {
  return {
    id: r.id,
    aufgabe: r.aufgabe,
    bezug: { entitaet: r.bezug_entitaet, id: r.bezug_id },
    stempel: r.stempel,
    ausgabe: r.ausgabe,
    ablaufAm: new Date(r.ablauf_am).toISOString(),
    erfasstAm: new Date(r.erfasst_am).toISOString(),
    status: r.status,
    entscheidungGrund: r.entscheidung_grund,
  }
}

export async function ladeKiVorschlag(tx: Tx, id: string): Promise<KiVorschlag | null> {
  const [r] = await tx.execute<VorschlagZeile>(
    sql`SELECT * FROM ki_vorschlaege_aktuell WHERE id = ${id}`,
  )
  return r ? alsVorschlag(r) : null
}

/** Jüngster Vorschlag einer Aufgabe zu einem Bezug, z. B. der Antwortvorschlag zu einer Mail. */
export async function juengsterKiVorschlag(
  tx: Tx,
  aufgabe: string,
  bezug: Referenz,
): Promise<KiVorschlag | null> {
  const [r] = await tx
    .select({ id: kiVorschlaege.id })
    .from(kiVorschlaege)
    .where(
      and(
        eq(kiVorschlaege.aufgabe, aufgabe),
        eq(kiVorschlaege.bezugEntitaet, bezug.entitaet),
        eq(kiVorschlaege.bezugId, bezug.id),
      ),
    )
    .orderBy(sql`${kiVorschlaege.erfasstAm} DESC, ${kiVorschlaege.id} DESC`)
    .limit(1)
  return r ? ladeKiVorschlag(tx, r.id) : null
}

/** Schreibt die einzige Entscheidung zu einem Vorschlag. Eine zweite scheitert am Primärschlüssel. */
export async function entscheideKiVorschlag(
  tx: Tx,
  e: {
    mandantId: string
    vorschlagId: string
    status: KiEntscheidung
    grund?: string | null
    akteur: Akteur
  },
): Promise<void> {
  await tx.insert(kiVorschlagEntscheidungen).values({
    vorschlagId: e.vorschlagId,
    mandantId: e.mandantId,
    status: e.status,
    grund: e.grund ?? null,
    akteurArt: e.akteur.art,
    akteurId: e.akteur.id,
  })
  await ereignis(tx, {
    mandantId: e.mandantId,
    typ: 'ki_vorschlag_entschieden',
    entitaet: 'ki_vorschlag',
    entitaetId: e.vorschlagId,
    akteur: e.akteur,
    payload: { status: e.status, grund: e.grund ?? null },
  })
}

/**
 * Nachrichten der letzten Tage ohne Vorschlag dieser Aufgabe, für die automatische Sortierung
 * im Worker. Nach `maxFehlversuche` gescheiterten Aufrufen bleibt eine Nachricht liegen,
 * statt bei jedem Durchlauf erneut Kosten zu verursachen.
 */
export async function nachrichtenOhneVorschlag(
  tx: Tx,
  aufgabe: string,
  o: { seitTagen: number; limit: number; maxFehlversuche: number },
): Promise<string[]> {
  const rows = await tx.execute<{ id: string }>(sql`
    SELECT n.id FROM nachrichten n
    WHERE n.empfangen_am > now() - make_interval(days => ${o.seitTagen})
      AND NOT EXISTS (
        SELECT 1 FROM ki_vorschlaege v
        WHERE v.aufgabe = ${aufgabe} AND v.bezug_entitaet = 'nachricht' AND v.bezug_id = n.id)
      AND (SELECT count(*) FROM ereignisse e
           WHERE e.typ = 'ki_aufruf'
             AND e.payload->'bezug'->>'id' = n.id::text
             AND e.payload->>'promptVersion' LIKE ${`${aufgabe}@%`}
             AND e.payload->>'ok' = 'false') < ${o.maxFehlversuche}
    ORDER BY n.empfangen_am, n.id
    LIMIT ${o.limit}`)
  return rows.map((r) => r.id)
}

/** Jüngster offener oder bestätigter Vorschlag einer Aufgabe je Bezug, z. B. für eine Liste. */
export async function geltendeKiVorschlaege(
  tx: Tx,
  aufgabe: string,
  bezugIds: string[],
): Promise<Map<string, KiVorschlag>> {
  if (bezugIds.length === 0) return new Map()
  const rows = await tx.execute<VorschlagZeile>(sql`
    SELECT DISTINCT ON (bezug_id) * FROM ki_vorschlaege_aktuell
    WHERE aufgabe = ${aufgabe} AND status IN ('offen', 'bestaetigt')
      AND bezug_id IN (${sql.join(
        bezugIds.map((i) => sql`${i}::uuid`),
        sql`, `,
      )})
    ORDER BY bezug_id, erfasst_am DESC, id DESC`)
  return new Map(rows.map((r) => [r.bezug_id, alsVorschlag(r)]))
}
