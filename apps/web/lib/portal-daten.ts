import 'server-only'
import {
  aktuell,
  ladeNotfallkarte,
  listeDokumente,
  listeTickets,
  listeWissen,
  type PortalSitzung,
  type Tx,
} from '@vermieteros/db'
import { sql } from 'drizzle-orm'
import { PORTAL_DOKUMENTTYPEN } from './portal'
import { schreibDaten } from './schreiben'

/**
 * Was Mieter im Portal sehen, immer nur zum eigenen Mietverhältnis. Die Datenbank trennt nur
 * nach Mandant; die Einschränkung auf das Mietverhältnis passiert hier, bei jeder Abfrage.
 * Interne Felder (Notizen, Auftragnehmer, Begründungen) verlassen diese Datei nicht.
 */
export async function portalUebersicht(tx: Tx, s: PortalSitzung) {
  const d = await schreibDaten(tx, s.mietverhaeltnisId)
  if (!d) return null
  const [ort] = await tx.execute<{ objekt_id: string; kondition_id: string | null }>(sql`
    SELECT e.objekt_id,
           (SELECT k.id FROM mietkonditionen k WHERE k.mietverhaeltnis_id = m.id
            ORDER BY k.erstellt_am LIMIT 1) AS kondition_id
    FROM mietverhaeltnisse m JOIN einheiten e ON e.id = m.einheit_id
    WHERE m.id = ${s.mietverhaeltnisId}`)
  const objektId = ort!.objekt_id
  // Heute geltende Miete; eine angekündigte Erhöhung erscheint erst ab ihrem Datum.
  const kondition = ort!.kondition_id ? await aktuell(tx, 'mietkondition', ort!.kondition_id) : null
  const tickets = (await listeTickets(tx, { objektId }))
    .filter((t) => t.mietverhaeltnisId === s.mietverhaeltnisId)
    .map((t) => ({
      id: t.id,
      titel: t.titel,
      status: t.status,
      termin: t.termin,
      angelegtAm: t.angelegtAm,
    }))
  const dokumente = (await portalDokumente(tx, s)).map((x) => ({
    id: x.id,
    titel: x.titel,
    typ: x.typ,
    dokumentdatum: x.dokumentdatum,
    mime: x.mime,
  }))
  const wissen = (await listeWissen(tx, objektId)).filter((w) => w.mieterSichtbar)
  const notfall = await ladeNotfallkarte(tx, objektId)
  return {
    mieter: d.mieter,
    vermieter: d.vermieter,
    wohnung: d.wohnung,
    beginn: d.mv.beginn,
    ende: d.mv.ende ?? null,
    kondition: kondition
      ? {
          kaltmieteCent: kondition.kaltmieteCent,
          vorauszahlungBkCent: kondition.vorauszahlungBkCent,
          vorauszahlungHkCent: kondition.vorauszahlungHkCent,
          gueltigAb: kondition.gueltigAb,
        }
      : null,
    notfall: notfall?.zeilen ?? [],
    wissen: wissen.map((w) => ({
      id: w.id,
      titel: w.titel,
      kategorie: w.kategorie,
      inhalt: w.inhalt,
    })),
    dokumente,
    tickets,
  }
}

/** Gültige Vertragsdokumente des eigenen Mietverhältnisses (Vertrag vollständig, Nachträge, Protokolle). */
export async function portalDokumente(tx: Tx, s: PortalSitzung) {
  return (await listeDokumente(tx, { mietverhaeltnisId: s.mietverhaeltnisId })).filter(
    (x) =>
      x.mietverhaeltnisId === s.mietverhaeltnisId &&
      x.status === 'gueltig' &&
      PORTAL_DOKUMENTTYPEN.has(x.typ),
  )
}
