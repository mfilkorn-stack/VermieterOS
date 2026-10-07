import {
  entscheideKiVorschlag,
  ladeKiVorschlag,
  legeKiVorschlagAn,
  protokolliereKiAufruf,
  withMandant,
  type Akteur,
  type Db,
  type KiVorschlag,
  type Tx,
} from '@vermieteros/db'
import { promptVersion, type Aufgabe } from './aufgabe'
import { KiFehler, kiModell, type KiClient } from './client'
import type { Kontext } from './kontext/kontext'
import { pruefeEntwurf, type EntwurfBefund } from './platzhalter'
import { erstelleStempel, pruefeStempel, Versionsstempel } from './stempel'

const SYSTEM: Akteur = { art: 'system', id: 'ki' }
const STANDARD_ABLAUF_TAGE = 14

export type KiUmgebung = {
  db: Db
  mandantId: string
  /** Wer den Vorschlag anstößt (Nutzer per Klick, System im Worker) */
  akteur: Akteur
  client: KiClient
  /** Sonst `KI_MODELL` oder das Standardmodell */
  modell?: string
}

export class EntwurfAbgelehnt extends KiFehler {
  constructor(readonly befunde: EntwurfBefund[]) {
    super(
      `Entwurf verletzt die Platzhalter-Regel: ${befunde
        .map((b) =>
          b.art === 'zahl' ? `Zahl „${b.auszug}“` : `unbekannter Platzhalter ${b.schluessel}`,
        )
        .join(', ')}`,
      'abgelehnt',
    )
  }
}

/**
 * Erzeugt einen Vorschlag: Kontext und Stempel lesen (eine Transaktion), Modell aufrufen
 * (außerhalb jeder Transaktion), Ausgabe prüfen, Vorschlag mit Stempel ablegen.
 * Jeder Aufruf wird protokolliert, auch ein gescheiterter, ohne Inhalt.
 */
export async function erzeugeVorschlag<D, A extends Record<string, unknown>>(
  u: KiUmgebung,
  aufgabe: Aufgabe<D, A>,
  baueKontext: (tx: Tx) => Promise<Kontext<D>>,
): Promise<{ id: string; ausgabe: A }> {
  const modell = u.modell ?? kiModell()
  const { kontext, stempel } = await withMandant(u.db, u.mandantId, async (tx) => {
    const kontext = await baueKontext(tx)
    const stempel = await erstelleStempel(tx, {
      mandantId: u.mandantId,
      referenzen: kontext.referenzen,
      dokumentIds: kontext.dokumentIds,
      promptVersion: promptVersion(aufgabe),
      modell,
    })
    return { kontext, stempel }
  })

  const protokoll = (payload: Record<string, unknown>) =>
    withMandant(u.db, u.mandantId, (tx) =>
      protokolliereKiAufruf(tx, {
        mandantId: u.mandantId,
        bezug: kontext.bezug,
        akteur: u.akteur,
        payload: { promptVersion: stempel.promptVersion, ledgerSeq: stempel.ledgerSeq, ...payload },
      }),
    )

  let antwort
  try {
    antwort = await u.client.erzeuge({
      modell,
      system: aufgabe.system,
      nachricht: aufgabe.nachricht(kontext.daten, kontext.platzhalter),
      schema: aufgabe.ausgabe,
      maxTokens: aufgabe.maxTokens ?? 16_000,
    })
  } catch (e) {
    await protokoll({ modell, ok: false, fehler: e instanceof KiFehler ? e.art : 'aufruf' })
    throw e
  }
  const aufruf = { modell: antwort.modell, anfrageId: antwort.anfrageId, nutzung: antwort.nutzung }

  const geprueft = aufgabe.ausgabe.safeParse(antwort.ausgabe)
  if (!geprueft.success) {
    await protokoll({ ...aufruf, ok: false, fehler: 'ungueltig' })
    throw new KiFehler(`Ausgabe passt nicht zum Schema: ${geprueft.error.message}`, 'ungueltig')
  }
  const befunde = (aufgabe.entwuerfe?.(geprueft.data) ?? []).flatMap((t) =>
    pruefeEntwurf(t, kontext.platzhalter),
  )
  if (befunde.length) {
    await protokoll({ ...aufruf, ok: false, fehler: 'entwurf', befunde: befunde.map((b) => b.art) })
    throw new EntwurfAbgelehnt(befunde)
  }

  const fachlich = aufgabe.pruefe?.(geprueft.data, kontext.daten) ?? []
  if (fachlich.length) {
    await protokoll({ ...aufruf, ok: false, fehler: 'pruefung' })
    throw new KiFehler(`Ausgabe abgelehnt: ${fachlich.join('; ')}`, 'abgelehnt')
  }

  const tage = aufgabe.ablaufTage ?? STANDARD_ABLAUF_TAGE
  const id = await withMandant(u.db, u.mandantId, async (tx) => {
    await protokolliereKiAufruf(tx, {
      mandantId: u.mandantId,
      bezug: kontext.bezug,
      akteur: u.akteur,
      payload: {
        promptVersion: stempel.promptVersion,
        ledgerSeq: stempel.ledgerSeq,
        ...aufruf,
        ok: true,
      },
    })
    return legeKiVorschlagAn(tx, {
      mandantId: u.mandantId,
      aufgabe: aufgabe.name,
      bezug: kontext.bezug,
      stempel: { ...stempel, modell: antwort.modell },
      ausgabe: geprueft.data,
      aufruf,
      ablaufAm: new Date(Date.now() + tage * 86_400_000).toISOString(),
      akteur: u.akteur,
    })
  })
  return { id, ausgabe: geprueft.data }
}

export type Pruefung =
  | { status: 'offen'; vorschlag: KiVorschlag }
  | { status: 'bestaetigt' | 'verworfen'; vorschlag: KiVorschlag }
  | { status: 'veraltet'; vorschlag: KiVorschlag; gruende: string[] }

async function pruefeInTx(tx: Tx, mandantId: string, id: string): Promise<Pruefung> {
  const v = await ladeKiVorschlag(tx, id)
  if (!v) throw new Error(`Vorschlag ${id} nicht gefunden`)
  if (v.status === 'veraltet') {
    return { status: 'veraltet', vorschlag: v, gruende: [v.entscheidungGrund ?? 'abgelaufen'] }
  }
  if (v.status !== 'offen') return { status: v.status, vorschlag: v }
  const p = await pruefeStempel(tx, Versionsstempel.parse(v.stempel))
  if (p.aktuell) return { status: 'offen', vorschlag: v }
  await entscheideKiVorschlag(tx, {
    mandantId,
    vorschlagId: id,
    status: 'veraltet',
    grund: p.gruende.join('; '),
    akteur: SYSTEM,
  })
  return { status: 'veraltet', vorschlag: { ...v, status: 'veraltet' }, gruende: p.gruende }
}

/** Status eines Vorschlags; ein offener mit überholtem Stempel wird dabei als veraltet festgehalten. */
export function pruefeVorschlag(
  u: Pick<KiUmgebung, 'db' | 'mandantId'>,
  id: string,
): Promise<Pruefung> {
  return withMandant(u.db, u.mandantId, (tx) => pruefeInTx(tx, u.mandantId, id))
}

/**
 * „Übernehmen“ oder „Senden“: nur ein offener Vorschlag mit aktuellem Stempel wird bestätigt,
 * Prüfung und Entscheidung in einer Transaktion. Sonst kommt der Grund zurück, nichts wird bestätigt.
 */
export function bestaetigeVorschlag(
  u: Pick<KiUmgebung, 'db' | 'mandantId' | 'akteur'>,
  id: string,
): Promise<Pruefung> {
  return withMandant(u.db, u.mandantId, async (tx) => {
    const p = await pruefeInTx(tx, u.mandantId, id)
    if (p.status !== 'offen') return p
    await entscheideKiVorschlag(tx, {
      mandantId: u.mandantId,
      vorschlagId: id,
      status: 'bestaetigt',
      akteur: u.akteur,
    })
    return { status: 'bestaetigt', vorschlag: { ...p.vorschlag, status: 'bestaetigt' } }
  })
}

export function verwirfVorschlag(
  u: Pick<KiUmgebung, 'db' | 'mandantId' | 'akteur'>,
  id: string,
  grund?: string,
): Promise<void> {
  return withMandant(u.db, u.mandantId, (tx) =>
    entscheideKiVorschlag(tx, {
      mandantId: u.mandantId,
      vorschlagId: id,
      status: 'verworfen',
      grund: grund ?? null,
      akteur: u.akteur,
    }),
  )
}
