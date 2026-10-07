import { and, eq, getTableName, sql } from 'drizzle-orm'
import type { ZaehlerstandQuelle } from '@vermieteros/schema'
import { v7 as uuidv7 } from 'uuid'
import type { Tx } from './client'
import {
  bkAbrechnungen,
  bkAbrechnungVersionen,
  darlehen,
  darlehenVersionen,
  dokumente,
  dokumentVersionen,
  eigentumsanteile,
  eigentumsanteilVersionen,
  einheiten,
  einheitVersionen,
  ereignisse,
  handwerker,
  handwerkerVersionen,
  journalEintraege,
  mandanten,
  mietkonditionen,
  mietkonditionVersionen,
  mietverhaeltnisse,
  mietverhaeltnisVersionen,
  notfallkarten,
  notfallkarteVersionen,
  objekte,
  objektVersionen,
  personen,
  personVersionen,
  stornos,
  tickets,
  ticketVersionen,
  wissensartikel,
  wissensartikelVersionen,
  zaehler,
  zaehlerstaende,
  zaehlerVersionen,
  type Akteur,
  type EigentuemerschaftArt,
  type Herkunft,
} from './schema/index'
import { versionsSpalten } from './schema/versionierung'

/**
 * Register der versionierten Entitäten. Eine neue Entität braucht genau drei Dinge:
 * Schema (Identität + Versionen), `versionierung_einrichten(...)` in einer Migration,
 * und einen Eintrag hier.
 */
export const ENTITAETEN = {
  objekt: { identitaet: objekte, versionen: objektVersionen, fk: 'objektId' },
  einheit: { identitaet: einheiten, versionen: einheitVersionen, fk: 'einheitId' },
  person: { identitaet: personen, versionen: personVersionen, fk: 'personId' },
  mietverhaeltnis: {
    identitaet: mietverhaeltnisse,
    versionen: mietverhaeltnisVersionen,
    fk: 'mietverhaeltnisId',
  },
  mietkondition: {
    identitaet: mietkonditionen,
    versionen: mietkonditionVersionen,
    fk: 'mietkonditionId',
  },
  zaehler: { identitaet: zaehler, versionen: zaehlerVersionen, fk: 'zaehlerId' },
  darlehen: { identitaet: darlehen, versionen: darlehenVersionen, fk: 'darlehenId' },
  dokument: { identitaet: dokumente, versionen: dokumentVersionen, fk: 'dokumentId' },
  eigentumsanteil: {
    identitaet: eigentumsanteile,
    versionen: eigentumsanteilVersionen,
    fk: 'eigentumsanteilId',
  },
  handwerker: { identitaet: handwerker, versionen: handwerkerVersionen, fk: 'handwerkerId' },
  notfallkarte: {
    identitaet: notfallkarten,
    versionen: notfallkarteVersionen,
    fk: 'notfallkarteId',
  },
  wissensartikel: {
    identitaet: wissensartikel,
    versionen: wissensartikelVersionen,
    fk: 'wissensartikelId',
  },
  ticket: { identitaet: tickets, versionen: ticketVersionen, fk: 'ticketId' },
  bk_abrechnung: {
    identitaet: bkAbrechnungen,
    versionen: bkAbrechnungVersionen,
    fk: 'bkAbrechnungId',
  },
} as const

export type EntitaetName = keyof typeof ENTITAETEN

type VersionsTabelle<E extends EntitaetName> = (typeof ENTITAETEN)[E]['versionen']
type IdentTabelle<E extends EntitaetName> = (typeof ENTITAETEN)[E]['identitaet']

/** Gemeinsame Spalten, die der Ledger-Kern selbst füllt und die Fachcode nicht übergibt. */
type Systemspalten =
  | 'id'
  | 'mandantId'
  | 'versionNr'
  | 'gueltigAb'
  | 'erfasstAm'
  | 'erfasstVon'
  | 'ereignisId'
  | 'begruendung'
  | 'herkunft'
  | (typeof ENTITAETEN)[EntitaetName]['fk']

/** Fachdaten einer Version, ohne Systemspalten. */
export type VersionsDaten<E extends EntitaetName> = Omit<
  VersionsTabelle<E>['$inferInsert'],
  Systemspalten
>

/** Zusätzliche Identitätsdaten (z. B. einheit.objektId). */
export type IdentitaetsDaten<E extends EntitaetName> = Omit<
  IdentTabelle<E>['$inferInsert'],
  'id' | 'mandantId' | 'erstelltAm'
>

export type Version<E extends EntitaetName> = VersionsTabelle<E>['$inferSelect']

export type NeueVersionParams<E extends EntitaetName> = {
  entitaet: E
  mandantId: string
  akteur: Akteur
  /** Fachliche Gültigkeit, ISO-Datum. */
  gueltigAb: string
  /** Pflicht ab der zweiten Version. */
  begruendung?: string
  /** Herkunft pro geändertem Feld. */
  herkunft?: Herkunft
  daten: VersionsDaten<E>
} & (
  | { identId: string; identitaet?: undefined }
  | { identId?: undefined; identitaet: IdentitaetsDaten<E> }
)

export type NeueVersionErgebnis = {
  identId: string
  versionId: string
  versionNr: number
  ereignisId: string
  seq: number
  hash: string
}

/**
 * Schreibt eine neue Version einer Entität. Legt die Identität an, wenn keine `identId` übergeben wird.
 * Version und Ereignis entstehen in derselben Transaktion; der Hash kommt aus dem Trigger.
 * Muss innerhalb von `withMandant()` laufen.
 */
export async function neueVersion<E extends EntitaetName>(
  tx: Tx,
  params: NeueVersionParams<E>,
): Promise<NeueVersionErgebnis> {
  const def = ENTITAETEN[params.entitaet]
  const versionen = def.versionen as unknown as typeof objektVersionen
  const identitaet = def.identitaet as unknown as typeof objekte

  let identId = params.identId
  if (identId === undefined) {
    identId = uuidv7()
    await tx.insert(identitaet).values({
      id: identId,
      mandantId: params.mandantId,
      ...(params.identitaet as Record<string, unknown>),
    })
  }

  // Versionsnummer pro Identität serialisieren.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'version:' + identId}))`)
  const fkSpalte = versionen[def.fk as 'objektId']
  const [max] = await tx
    .select({ n: sql<number>`coalesce(max(${versionen.versionNr}), 0)::int` })
    .from(versionen)
    .where(eq(fkSpalte, identId))
  const versionNr = (max?.n ?? 0) + 1

  const begruendung = params.begruendung?.trim() || null
  if (versionNr > 1 && !begruendung) {
    throw new Error(`Begründung ist Pflicht ab Version 2 (${params.entitaet} ${identId})`)
  }

  const versionId = uuidv7()
  const herkunft = params.herkunft ?? {}

  const [ereignis] = await tx
    .insert(ereignisse)
    .values({
      id: uuidv7(),
      mandantId: params.mandantId,
      typ: 'version_angelegt',
      entitaet: params.entitaet,
      entitaetId: identId,
      versionId,
      akteurArt: params.akteur.art,
      akteurId: params.akteur.id,
      payload: {
        versionNr,
        gueltigAb: params.gueltigAb,
        begruendung,
        herkunft,
        daten: params.daten,
        ...(params.identitaet ? { identitaet: params.identitaet } : {}),
      },
    })
    .returning({ id: ereignisse.id, seq: ereignisse.seq, hash: ereignisse.hash })
  if (!ereignis) throw new Error('Ereignis wurde nicht geschrieben')

  await tx.insert(versionen).values({
    id: versionId,
    mandantId: params.mandantId,
    versionNr,
    gueltigAb: params.gueltigAb,
    erfasstVon: params.akteur.id,
    ereignisId: ereignis.id,
    begruendung,
    herkunft,
    [def.fk]: identId,
    ...(params.daten as Record<string, unknown>),
  } as typeof objektVersionen.$inferInsert)

  return {
    identId,
    versionId,
    versionNr,
    ereignisId: ereignis.id,
    seq: ereignis.seq,
    hash: ereignis.hash,
  }
}

export type NeuerMandantParams = {
  id: string
  name: string
  art: EigentuemerschaftArt
  steuernummer?: string
  organisationId?: string
  akteur: Akteur
}

/**
 * Legt einen Mandanten an. Die Policy auf `mandanten` verlangt, dass `app.mandant_id`
 * bereits auf die neue id gesetzt ist: also `withMandant(db, neueId, tx => legeMandantAn(tx, …))`.
 */
export async function legeMandantAn(
  tx: Tx,
  params: NeuerMandantParams,
): Promise<{ ereignisId: string }> {
  await tx.insert(mandanten).values({
    id: params.id,
    name: params.name,
    art: params.art,
    steuernummer: params.steuernummer ?? null,
    organisationId: params.organisationId ?? null,
  })
  const [ereignis] = await tx
    .insert(ereignisse)
    .values({
      id: uuidv7(),
      mandantId: params.id,
      typ: 'mandant_angelegt',
      entitaet: 'mandant',
      entitaetId: params.id,
      akteurArt: params.akteur.art,
      akteurId: params.akteur.id,
      payload: { name: params.name, art: params.art },
    })
    .returning({ id: ereignisse.id })
  if (!ereignis) throw new Error('Ereignis wurde nicht geschrieben')
  return { ereignisId: ereignis.id }
}

export type StornoParams = {
  entitaet: EntitaetName | 'zaehlerstand' | 'journaleintrag'
  mandantId: string
  versionId: string
  akteur: Akteur
  grund: string
}

/** Storniert eine Version. Sie bleibt lesbar, fällt aber ab jetzt aus allen Sichten. */
export async function storniereVersion(
  tx: Tx,
  params: StornoParams,
): Promise<{ ereignisId: string }> {
  const grund = params.grund.trim()
  if (!grund) throw new Error('Storno braucht einen Grund')

  const tabelle = (params.entitaet === 'zaehlerstand'
    ? zaehlerstaende
    : params.entitaet === 'journaleintrag'
      ? journalEintraege
      : ENTITAETEN[params.entitaet].versionen) as unknown as typeof objektVersionen
  const [v] = await tx
    .select({ id: tabelle.id })
    .from(tabelle)
    .where(and(eq(tabelle.id, params.versionId), eq(tabelle.mandantId, params.mandantId)))
  if (!v) throw new Error(`Version ${params.versionId} nicht gefunden`)

  const [ereignis] = await tx
    .insert(ereignisse)
    .values({
      id: uuidv7(),
      mandantId: params.mandantId,
      typ: 'version_storniert',
      entitaet: params.entitaet,
      versionId: params.versionId,
      akteurArt: params.akteur.art,
      akteurId: params.akteur.id,
      payload: { grund },
    })
    .returning({ id: ereignisse.id })
  if (!ereignis) throw new Error('Ereignis wurde nicht geschrieben')

  await tx.insert(stornos).values({
    versionId: params.versionId,
    mandantId: params.mandantId,
    entitaet: params.entitaet,
    ereignisId: ereignis.id,
    grund,
    erfasstVon: params.akteur.id,
  })
  return { ereignisId: ereignis.id }
}

export type ZaehlerstandParams = {
  mandantId: string
  akteur: Akteur
  zaehlerId: string
  /** Stand in Tausendsteln der Maßeinheit */
  standX1000: number
  abgelesenAm: string
  quelle: ZaehlerstandQuelle
  bemerkung?: string
}

/** Schreibt einen Zählerstand als Ereignis. Korrektur nur per Storno und Neuerfassung. */
export async function neuerZaehlerstand(
  tx: Tx,
  params: ZaehlerstandParams,
): Promise<{ id: string; ereignisId: string }> {
  if (!Number.isInteger(params.standX1000) || params.standX1000 < 0) {
    throw new Error('Zählerstand muss eine nichtnegative ganze Zahl (Tausendstel) sein')
  }
  const id = uuidv7()
  const [ereignis] = await tx
    .insert(ereignisse)
    .values({
      id: uuidv7(),
      mandantId: params.mandantId,
      typ: 'zaehlerstand_erfasst',
      entitaet: 'zaehlerstand',
      entitaetId: params.zaehlerId,
      versionId: id,
      akteurArt: params.akteur.art,
      akteurId: params.akteur.id,
      payload: {
        standX1000: params.standX1000,
        abgelesenAm: params.abgelesenAm,
        quelle: params.quelle,
        bemerkung: params.bemerkung ?? null,
      },
    })
    .returning({ id: ereignisse.id })
  if (!ereignis) throw new Error('Ereignis wurde nicht geschrieben')

  await tx.insert(zaehlerstaende).values({
    id,
    mandantId: params.mandantId,
    zaehlerId: params.zaehlerId,
    standX1000: params.standX1000,
    abgelesenAm: params.abgelesenAm,
    quelle: params.quelle,
    ereignisId: ereignis.id,
    erfasstVon: params.akteur.id,
    bemerkung: params.bemerkung ?? null,
  })
  return { id, ereignisId: ereignis.id }
}

/** Aktueller Stand einer Entität (heute, alles Erfasste). */
export async function aktuell<E extends EntitaetName>(
  tx: Tx,
  entitaet: E,
  identId: string,
): Promise<Version<E> | null> {
  const def = ENTITAETEN[entitaet]
  const sicht = sql.identifier(`${getTableName(def.identitaet)}_aktuell`)
  const fk = sql.identifier(snake(def.fk))
  const rows = await tx.execute(sql`select * from ${sicht} where ${fk} = ${identId}`)
  return rows[0] ? (camel(rows[0]) as Version<E>) : null
}

/**
 * Stand einer Entität zu einem fachlichen Stichtag, so wie er zu `erfasstBis` bekannt war.
 * Grundlage jeder Festschreibung und jeder Reproduktion.
 */
export async function stand<E extends EntitaetName>(
  tx: Tx,
  entitaet: E,
  identId: string,
  stichtag: string,
  erfasstBis?: string,
): Promise<Version<E> | null> {
  const fn = sql.identifier(`${entitaet}_stand`)
  const rows = erfasstBis
    ? await tx.execute(
        sql`select * from ${fn}(${identId}, ${stichtag}::date, ${erfasstBis}::timestamptz)`,
      )
    : await tx.execute(sql`select * from ${fn}(${identId}, ${stichtag}::date)`)
  return rows[0] ? (camel(rows[0]) as Version<E>) : null
}

export type Kettenpruefung = {
  ok: boolean
  geprueft: number
  ersterFehlerSeq: number | null
  fehler: string | null
}

/** Rechnet die Hash-Kette des Mandanten nach. */
export async function pruefeKette(tx: Tx, mandantId: string): Promise<Kettenpruefung> {
  const rows = await tx.execute<{
    ok: boolean
    geprueft: string | number
    erster_fehler_seq: string | number | null
    fehler: string | null
  }>(sql`select * from ledger_pruefe_kette(${mandantId})`)
  const r = rows[0]
  if (!r) throw new Error('Kettenprüfung lieferte kein Ergebnis')
  return {
    ok: r.ok,
    geprueft: Number(r.geprueft),
    ersterFehlerSeq: r.erster_fehler_seq === null ? null : Number(r.erster_fehler_seq),
    fehler: r.fehler,
  }
}

function snake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase())
}

/** Rohzeile (snake_case, aus Sicht oder Funktion) → Objekt mit camelCase-Schlüsseln wie im Drizzle-Schema. */
function camel(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row))
    out[k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())] = v
  return out
}

const VERSIONS_SYSTEMSPALTEN = new Set(Object.keys(versionsSpalten))

/** Fachdaten einer Versionszeile: ohne Systemspalten und ohne Verweis auf die Identität. */
export function fachdaten<E extends EntitaetName>(
  entitaet: E,
  version: Record<string, unknown>,
): VersionsDaten<E> {
  const fk = ENTITAETEN[entitaet].fk
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(version)) {
    if (!VERSIONS_SYSTEMSPALTEN.has(k) && k !== fk) out[k] = v
  }
  return out as VersionsDaten<E>
}

/**
 * Jüngste gültige Version unabhängig vom heutigen Datum (auch eine erst künftig geltende).
 * Grundlage für Formulare: eine Änderung baut immer auf dem letzten erfassten Stand auf.
 */
export async function letzteVersion<E extends EntitaetName>(
  tx: Tx,
  entitaet: E,
  identId: string,
): Promise<Version<E> | null> {
  return stand(tx, entitaet, identId, '9999-12-31')
}
