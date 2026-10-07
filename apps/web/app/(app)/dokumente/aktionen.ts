'use server'

import {
  anhangFuerDokument,
  fachdaten,
  ladeDokument,
  letzteVersion,
  type Tx,
} from '@vermieteros/db'
import {
  bestaetigeVorschlagInTx,
  erzeugeVorschlag,
  fuerDokument,
  KiFehler,
  MIETVERTRAG_EXTRAKTION,
  type MietvertragAuszug,
  verwirfVorschlag,
  werteMietvertragAus,
} from '@vermieteros/ki'
import { DokumentDaten, type Herkunft } from '@vermieteros/schema'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ERLAUBTE_TYPEN, MAX_GROESSE } from '@/lib/dokument-text'
import { datum, Eingabefehler, pflicht, text, zodText } from '@/lib/eingabe'
import { fehlertext, type FormStatus } from '@/lib/form-status'
import { kiUmgebung } from '@/lib/ki'
import { mitMandant, verlange, type MandantKontext } from '@/lib/sitzung'
import { speichere } from '@/lib/speichern'
import { objektSpeicher } from '@/lib/speicher'
import { aktuelleVertragsdaten, dokumentSeiten } from '@/lib/vertrag'
import { heuteBerlin } from '@/lib/zeit'

function daten(d: FormData, titelVorgabe: string) {
  const p = DokumentDaten.safeParse({
    typ: text(d, 'typ'),
    status: 'gueltig',
    titel: text(d, 'titel') ?? titelVorgabe,
    dokumentdatum: datum(d, 'dokumentdatum', 'Datum'),
    gueltigBis: datum(d, 'gueltigBis', 'Gültig bis'),
    notizen: text(d, 'notizen'),
  })
  if (!p.success) throw new Eingabefehler(zodText(p.error, { titel: 'Titel', typ: 'Art' }))
  return p.data
}

/** Neues Dokument wird gültig; das ersetzte bekommt eine Version „ersetzt durch“. */
async function ablegen(
  tx: Tx,
  k: MandantKontext,
  p: {
    bezug: { objektId: string | null; mietverhaeltnisId: string | null }
    datei: { schluessel: string; sha256: string; dateiname: string; mime: string; groesse: number }
    daten: ReturnType<typeof daten>
    ersetztId: string | null
  },
): Promise<string> {
  if (p.bezug.objektId && !(await letzteVersion(tx, 'objekt', p.bezug.objektId))) {
    throw new Eingabefehler('Objekt nicht gefunden.')
  }
  if (
    p.bezug.mietverhaeltnisId &&
    !(await letzteVersion(tx, 'mietverhaeltnis', p.bezug.mietverhaeltnisId))
  ) {
    throw new Eingabefehler('Mietverhältnis nicht gefunden.')
  }
  const r = await speichere(tx, k, {
    entitaet: 'dokument',
    identitaet: {
      objektId: p.bezug.objektId,
      mietverhaeltnisId: p.bezug.mietverhaeltnisId,
      dateiHash: p.datei.sha256,
      speicherSchluessel: p.datei.schluessel,
      dateiname: p.datei.dateiname,
      mime: p.datei.mime,
      groesseBytes: p.datei.groesse,
    },
    daten: p.daten,
    gueltigAb: heuteBerlin(),
  })
  if (p.ersetztId) {
    const alt = await ladeDokument(tx, p.ersetztId)
    if (!alt) throw new Eingabefehler('Das zu ersetzende Dokument gibt es nicht.')
    await speichere(tx, k, {
      entitaet: 'dokument',
      identId: alt.id,
      daten: {
        ...(await letzteVersionDaten(tx, alt.id)),
        status: 'ersetzt',
        ersetztDurch: r.identId,
      },
      gueltigAb: heuteBerlin() > alt.gueltigAb ? heuteBerlin() : alt.gueltigAb,
      begruendung: `Ersetzt durch ${p.daten.titel}`,
    })
  }
  return r.identId
}

async function letzteVersionDaten(tx: Tx, id: string) {
  const v = await letzteVersion(tx, 'dokument', id)
  if (!v) throw new Eingabefehler('Dokument nicht gefunden.')
  return fachdaten('dokument', v)
}

export async function dokumentHochladen(_: FormStatus, d: FormData): Promise<FormStatus> {
  let id: string
  try {
    await verlange({ stammdaten: ['schreiben'] })
    const datei = d.get('datei')
    if (!(datei instanceof File) || datei.size === 0)
      throw new Eingabefehler('Bitte eine Datei wählen.')
    if (datei.size > MAX_GROESSE) throw new Eingabefehler('Die Datei ist größer als 20 MB.')
    if (!ERLAUBTE_TYPEN.has(datei.type)) {
      throw new Eingabefehler('Erlaubt sind PDF, JPG, PNG und WebP.')
    }
    const inhalt = Buffer.from(await datei.arrayBuffer())
    const objektId = text(d, 'objektId')
    const mietverhaeltnisId = text(d, 'mietverhaeltnisId')
    if (!objektId && !mietverhaeltnisId)
      throw new Eingabefehler('Objekt oder Mietverhältnis fehlt.')
    const dokumentDaten = daten(d, datei.name)
    id = await mitMandant(async (tx, k) => {
      const abgelegt = await objektSpeicher().ablegen(k.mandantId, 'dokument', inhalt, datei.type)
      return ablegen(tx, k, {
        bezug: { objektId, mietverhaeltnisId },
        datei: { ...abgelegt, dateiname: datei.name, mime: datei.type },
        daten: dokumentDaten,
        ersetztId: text(d, 'ersetztId'),
      })
    })
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  redirect(`/dokumente/${id}`)
}

/** Anhang einer zugeordneten Mail als Dokument ablegen; die Datei liegt schon im Speicher. */
export async function anhangAlsDokument(_: FormStatus, d: FormData): Promise<FormStatus> {
  let id: string
  try {
    await verlange({ stammdaten: ['schreiben'] })
    const mietverhaeltnisId = pflicht(d, 'mietverhaeltnisId', 'Mietverhältnis')
    id = await mitMandant(async (tx, k) => {
      const a = await anhangFuerDokument(tx, pflicht(d, 'anhangId', 'Anhang'))
      if (!a) throw new Eingabefehler('Anhang nicht gefunden.')
      if (!ERLAUBTE_TYPEN.has(a.mimeTyp))
        throw new Eingabefehler('Diese Dateiart wird nicht abgelegt.')
      return ablegen(tx, k, {
        bezug: { objektId: null, mietverhaeltnisId },
        datei: {
          schluessel: a.schluessel,
          sha256: a.sha256,
          dateiname: a.dateiname,
          mime: a.mimeTyp,
          groesse: a.groesse,
        },
        daten: daten(d, a.dateiname),
        ersetztId: null,
      })
    })
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  redirect(`/dokumente/${id}`)
}

/** Status „abgelaufen“ oder wieder „gültig“; „ersetzt“ entsteht nur beim Ersetzen. */
export async function dokumentStatus(_: FormStatus, d: FormData): Promise<FormStatus> {
  let id: string
  try {
    await verlange({ stammdaten: ['schreiben'] })
    id = pflicht(d, 'dokumentId', 'Dokument')
    const status = pflicht(d, 'status', 'Status')
    if (status !== 'gueltig' && status !== 'abgelaufen')
      throw new Eingabefehler('Unbekannter Status.')
    await mitMandant(async (tx, k) => {
      const alt = await ladeDokument(tx, id)
      if (!alt) throw new Eingabefehler('Dokument nicht gefunden.')
      await speichere(tx, k, {
        entitaet: 'dokument',
        identId: id,
        daten: { ...(await letzteVersionDaten(tx, id)), status },
        gueltigAb: heuteBerlin() > alt.gueltigAb ? heuteBerlin() : alt.gueltigAb,
        begruendung: `Status: ${status}`,
      })
    })
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  revalidatePath(`/dokumente/${id}`)
  return {}
}

/** Mietvertrag von der KI auslesen lassen (Vorschlag mit Stempel, Datei-Prüfsumme). */
export async function vertragAuslesen(_: FormStatus, d: FormData): Promise<FormStatus> {
  try {
    await verlange({ stammdaten: ['schreiben'] })
    const id = pflicht(d, 'dokumentId', 'Dokument')
    const u = await kiUmgebung()
    if (!u) return { fehler: 'Die KI ist nicht eingerichtet (ANTHROPIC_API_KEY).' }
    await erzeugeVorschlag(u, MIETVERTRAG_EXTRAKTION, (tx) =>
      fuerDokument(tx, id, objektSpeicher()),
    )
    revalidatePath(`/dokumente/${id}`)
    return {}
  } catch (e) {
    if (e instanceof KiFehler)
      return { fehler: `Die KI konnte den Vertrag nicht auslesen: ${e.message}` }
    return { fehler: fehlertext(e) }
  }
}

/**
 * Übernahme in die Stammdaten: nur angehakte und am PDF belegte Werte, in einer Transaktion mit
 * der Bestätigung des Vorschlags. Herkunft = Dokument mit Seite (PLAN 4.2), nicht „KI“.
 */
export async function vertragUebernehmen(_: FormStatus, d: FormData): Promise<FormStatus> {
  let id: string
  try {
    await verlange({ stammdaten: ['schreiben'] })
    id = pflicht(d, 'dokumentId', 'Dokument')
    const vorschlagId = pflicht(d, 'vorschlagId', 'Vorschlag')
    const gewaehlt = new Set(d.getAll('felder').map(String))
    if (gewaehlt.size === 0)
      throw new Eingabefehler('Bitte mindestens einen Wert zum Übernehmen anhaken.')
    await mitMandant(async (tx, k) => {
      const dok = await ladeDokument(tx, id)
      if (!dok?.mietverhaeltnisId)
        throw new Eingabefehler('Das Dokument hängt an keinem Mietverhältnis.')
      const p = await bestaetigeVorschlagInTx(
        tx,
        { mandantId: k.mandantId, akteur: { art: 'nutzer', id: k.nutzerId } },
        vorschlagId,
      )
      if (p.status === 'veraltet')
        throw new Eingabefehler('Seit dem Auslesen hat sich etwas geändert. Bitte neu auslesen.')
      if (p.status !== 'bestaetigt')
        throw new Eingabefehler('Über diesen Vorschlag ist schon entschieden.')
      const werte = werteMietvertragAus(
        p.vorschlag.ausgabe as MietvertragAuszug,
        await dokumentSeiten(tx, id),
      ).filter((w) => gewaehlt.has(w.feld) && w.pruefung === 'belegt' && w.normiert !== null)
      const herkunft = (feld: string, seite: number): Herkunft => ({
        [feld]: { quelle: 'dokument', dokumentId: id, seite, vorschlagId },
      })
      const mvFelder: Record<string, { feld: string; wert: unknown; seite: number }> = {}
      const kFelder: Record<string, { feld: string; wert: unknown; seite: number }> = {}
      for (const w of werte) {
        if (w.feld === 'mietbeginn')
          mvFelder['beginn'] = { feld: 'beginn', wert: w.normiert, seite: w.seite }
        if (w.feld === 'kaution')
          mvFelder['kautionCent'] = { feld: 'kautionCent', wert: w.normiert, seite: w.seite }
        if (w.feld === 'kuendigungsfrist_monate')
          mvFelder['kuendigungsfristMonate'] = {
            feld: 'kuendigungsfristMonate',
            wert: w.normiert,
            seite: w.seite,
          }
        if (w.feld === 'kaltmiete')
          kFelder['kaltmieteCent'] = { feld: 'kaltmieteCent', wert: w.normiert, seite: w.seite }
        if (w.feld === 'vorauszahlung_betriebskosten')
          kFelder['vorauszahlungBkCent'] = {
            feld: 'vorauszahlungBkCent',
            wert: w.normiert,
            seite: w.seite,
          }
        if (w.feld === 'vorauszahlung_heizkosten')
          kFelder['vorauszahlungHkCent'] = {
            feld: 'vorauszahlungHkCent',
            wert: w.normiert,
            seite: w.seite,
          }
      }
      const begruendung = `Übernommen aus „${dok.titel}“`
      const akt = await aktuelleVertragsdaten(tx, dok.mietverhaeltnisId)
      if (Object.keys(mvFelder).length && akt.mv) {
        const alt = fachdaten('mietverhaeltnis', akt.mv)
        await speichere(tx, k, {
          entitaet: 'mietverhaeltnis',
          identId: dok.mietverhaeltnisId,
          daten: {
            ...alt,
            ...Object.fromEntries(Object.values(mvFelder).map((f) => [f.feld, f.wert])),
          },
          gueltigAb: akt.mv.gueltigAb,
          begruendung,
          herkunft: Object.assign(
            {},
            ...Object.values(mvFelder).map((f) => herkunft(f.feld, f.seite)),
          ),
        })
      }
      if (Object.keys(kFelder).length) {
        const kWerte = Object.fromEntries(Object.values(kFelder).map((f) => [f.feld, f.wert]))
        const kHerkunft = Object.assign(
          {},
          ...Object.values(kFelder).map((f) => herkunft(f.feld, f.seite)),
        )
        if (akt.konditionId && akt.kondition) {
          await speichere(tx, k, {
            entitaet: 'mietkondition',
            identId: akt.konditionId,
            daten: { ...fachdaten('mietkondition', akt.kondition), ...kWerte },
            gueltigAb: akt.kondition.gueltigAb,
            begruendung,
            herkunft: kHerkunft,
          })
        } else if (typeof kWerte['kaltmieteCent'] === 'number') {
          const beginn =
            (mvFelder['beginn']?.wert as string | undefined) ?? akt.mv?.beginn ?? heuteBerlin()
          await speichere(tx, k, {
            entitaet: 'mietkondition',
            identitaet: { mietverhaeltnisId: dok.mietverhaeltnisId },
            daten: {
              kaltmieteCent: kWerte['kaltmieteCent'],
              vorauszahlungBkCent: (kWerte['vorauszahlungBkCent'] as number) ?? 0,
              vorauszahlungHkCent: (kWerte['vorauszahlungHkCent'] as number) ?? 0,
            },
            gueltigAb: beginn,
            herkunft: kHerkunft,
          })
        } else {
          throw new Eingabefehler('Ohne Kaltmiete lässt sich keine Mietkondition anlegen.')
        }
      }
    })
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  revalidatePath(`/dokumente/${id}`)
  return {
    hinweis: 'Übernommen. Die Werte stehen jetzt mit Herkunft „Dokument, Seite“ in den Stammdaten.',
  }
}

export async function vertragVerwerfen(_: FormStatus, d: FormData): Promise<FormStatus> {
  try {
    await verlange({ stammdaten: ['schreiben'] })
    const id = pflicht(d, 'dokumentId', 'Dokument')
    const u = await kiUmgebung()
    if (!u) return { fehler: 'Die KI ist nicht eingerichtet (ANTHROPIC_API_KEY).' }
    await verwirfVorschlag(u, pflicht(d, 'vorschlagId', 'Vorschlag'), 'von Hand verworfen')
    revalidatePath(`/dokumente/${id}`)
    return {}
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
}
