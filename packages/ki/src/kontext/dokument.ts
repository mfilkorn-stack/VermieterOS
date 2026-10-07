import { ladeDokument, ladeZuordnungsKandidaten, type Tx } from '@vermieteros/db'
import { seitenTexte } from '../pdf'
import { Referenzen, type Kontext } from './kontext'

/** Woher die Datei kommt: der Object Storage (in Tests ein Ersatz). */
export type DateiQuelle = { holen(schluessel: string): Promise<Buffer> }

export type DokumentKontextDaten = {
  titel: string
  typ: string
  dateiname: string
  mime: string
  /** Text je Seite, für die Prüfung der Fundstellen; leer bei Scans */
  seiten: string[]
  datei: Uint8Array
  /** Bekannte Angaben zum Mietverhältnis, nur zur Orientierung des Modells */
  mietverhaeltnis: { einheit: string; objekt: string; mieter: string[] } | null
}

/**
 * Kontext für die Extraktion aus einem Dokument (PLAN 4.1): nur gültige Dokumente,
 * die Datei geht als Dokumentblock an das Modell, die Prüfsumme in den Stempel.
 */
export async function fuerDokument(
  tx: Tx,
  dokumentId: string,
  quelle: DateiQuelle,
): Promise<Kontext<DokumentKontextDaten>> {
  const d = await ladeDokument(tx, dokumentId)
  if (!d) throw new Error(`Dokument ${dokumentId} nicht gefunden`)
  if (d.status !== 'gueltig') throw new Error('Nur gültige Dokumente werden ausgewertet')
  const datei = new Uint8Array(await quelle.holen(d.speicherSchluessel))
  const mv = d.mietverhaeltnisId
    ? (await ladeZuordnungsKandidaten(tx)).find((k) => k.mietverhaeltnisId === d.mietverhaeltnisId)
    : undefined
  const refs = new Referenzen()
    .merke('dokument', d.id)
    .merke('mietverhaeltnis', d.mietverhaeltnisId)
  return {
    bezug: { entitaet: 'dokument', id: d.id },
    daten: {
      titel: d.titel,
      typ: d.typ,
      dateiname: d.dateiname,
      mime: d.mime,
      seiten: d.mime === 'application/pdf' ? await seitenTexte(datei) : [],
      datei,
      mietverhaeltnis: mv
        ? { einheit: mv.einheit, objekt: mv.objekt, mieter: mv.mieterNamen }
        : null,
    },
    platzhalter: {},
    referenzen: refs.liste(),
    dokumentIds: [d.id],
  }
}
