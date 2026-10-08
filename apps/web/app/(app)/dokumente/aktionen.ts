'use server'

import {
  anhangFuerDokument,
  belegMitHash,
  ladeZuordnungsKandidaten,
  fachdaten,
  ladeDokument,
  letzteVersion,
  type Tx,
} from '@vermieteros/db'
import {
  BELEG_EXTRAKTION,
  bestaetigeVorschlagInTx,
  erzeugeVorschlag,
  fuerBeleg,
  fuerDokument,
  gebaeudeanteilAus,
  KAUFVERTRAG_EXTRAKTION,
  type KaufvertragAuszug,
  KiFehler,
  type Pruefergebnis,
  MIETVERTRAG_EXTRAKTION,
  type MietvertragAuszug,
  verwirfVorschlag,
  werteKaufvertragAus,
  werteMietvertragAus,
} from '@vermieteros/ki'
import {
  DokumentDaten,
  ObjektDaten,
  type GrundbuchEintrag,
  type Herkunft,
} from '@vermieteros/schema'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { DATEI_FEHLER, ERLAUBTE_TYPEN, MAX_GROESSE } from '@/lib/dokument-text'
import { datum, Eingabefehler, pflicht, text, zodText } from '@/lib/eingabe'
import { fehlertext, type FormStatus } from '@/lib/form-status'
import { kiUmgebung } from '@/lib/ki'
import { mitMandant, verlange, type MandantKontext } from '@/lib/sitzung'
import { speichere } from '@/lib/speichern'
import { objektSpeicher } from '@/lib/speicher'
import { heicZuJpeg, mimeErmitteln, mitEndung, uploadVorbereiten } from '@/lib/upload'
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
    anhangId?: string
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
  if (p.daten.typ === 'beleg') {
    const doppelt = await belegMitHash(tx, p.datei.sha256)
    if (doppelt) throw new Eingabefehler('Diesen Beleg gibt es schon im Belegeingang.')
  }
  const r = await speichere(tx, k, {
    entitaet: 'dokument',
    identitaet: {
      objektId: p.bezug.objektId,
      mietverhaeltnisId: p.bezug.mietverhaeltnisId,
      // Art „Beleg“ kommt in den Belegeingang wie ein Upload dort (Auslesen, Buchen)
      beleg: p.daten.typ === 'beleg',
      anhangId: p.anhangId ?? null,
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

/**
 * Nach dem Ablegen gleich auslesen, wie beim Sammel-Upload der Belege: Belege immer, Mietverträge
 * am Mietverhältnis und Kaufverträge am Objekt (jeweils PDF). Ein Fehler der KI hält das Ablegen
 * nicht auf; Belege versucht der Worker erneut, Verträge lassen sich per Knopf neu auslesen.
 */
async function auslesenNachAblage(id: string): Promise<string> {
  const dok = await mitMandant((tx) => ladeDokument(tx, id))
  if (!dok) return `/dokumente/${id}`
  const aufgabe =
    dok.typ === 'beleg'
      ? BELEG_EXTRAKTION
      : dok.mime !== 'application/pdf'
        ? null
        : dok.typ === 'mietvertrag' && dok.mietverhaeltnisId
          ? MIETVERTRAG_EXTRAKTION
          : dok.typ === 'kaufvertrag' && dok.objektId
            ? KAUFVERTRAG_EXTRAKTION
            : null
  const u = aufgabe ? await kiUmgebung() : null
  if (u && aufgabe) {
    try {
      if (aufgabe === BELEG_EXTRAKTION)
        await erzeugeVorschlag(u, BELEG_EXTRAKTION, (tx) => fuerBeleg(tx, id, objektSpeicher()))
      else
        await erzeugeVorschlag(u, aufgabe as typeof MIETVERTRAG_EXTRAKTION, (tx) =>
          fuerDokument(tx, id, objektSpeicher()),
        )
    } catch (e) {
      console.warn(
        '[dokument] Auslesen nach Ablage gescheitert: ' + (e instanceof Error ? e.message : e),
      )
    }
  }
  return dok.typ === 'beleg' ? `/belege/${id}` : `/dokumente/${id}`
}

export async function dokumentHochladen(_: FormStatus, d: FormData): Promise<FormStatus> {
  let id: string
  try {
    await verlange({ stammdaten: ['schreiben'] })
    const datei = d.get('datei')
    if (!(datei instanceof File) || datei.size === 0)
      throw new Eingabefehler('Bitte eine Datei wählen.')
    if (datei.size > MAX_GROESSE) throw new Eingabefehler('Die Datei ist größer als 20 MB.')
    const upload = await uploadVorbereiten(datei, ERLAUBTE_TYPEN, DATEI_FEHLER)
    const objektId = text(d, 'objektId')
    const mietverhaeltnisId = text(d, 'mietverhaeltnisId')
    if (!objektId && !mietverhaeltnisId)
      throw new Eingabefehler('Objekt oder Mietverhältnis fehlt.')
    const dokumentDaten = daten(d, upload.dateiname)
    id = await mitMandant(async (tx, k) => {
      const abgelegt = await objektSpeicher().ablegen(
        k.mandantId,
        'dokument',
        upload.inhalt,
        upload.mime,
      )
      return ablegen(tx, k, {
        bezug: { objektId, mietverhaeltnisId },
        datei: { ...abgelegt, dateiname: upload.dateiname, mime: upload.mime },
        daten: dokumentDaten,
        ersetztId: text(d, 'ersetztId'),
      })
    })
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  redirect(await auslesenNachAblage(id))
}

/**
 * Anhang einer Mail als Dokument oder Beleg ablegen; die Datei liegt schon im Speicher. Die Mail
 * muss keinem Mietverhältnis zugeordnet sein: Dokumente brauchen ein Objekt, Belege nicht.
 */
export async function anhangAlsDokument(_: FormStatus, d: FormData): Promise<FormStatus> {
  let id: string
  try {
    await verlange({ stammdaten: ['schreiben'] })
    const mietverhaeltnisId = text(d, 'mietverhaeltnisId')
    const anhangId = pflicht(d, 'anhangId', 'Anhang')
    id = await mitMandant(async (tx, k) => {
      const a = await anhangFuerDokument(tx, anhangId)
      if (!a) throw new Eingabefehler('Anhang nicht gefunden.')
      const mime = mimeErmitteln(a.mimeTyp, a.dateiname, new Uint8Array())
      let datei = {
        schluessel: a.schluessel,
        sha256: a.sha256,
        dateiname: a.dateiname,
        mime,
        groesse: a.groesse,
      }
      if (mime === 'image/heic') {
        // iPhone-Foto aus der Mail: als JPEG ablegen, das Original bleibt am Anhang.
        const jpeg = await heicZuJpeg(await objektSpeicher().holen(a.schluessel))
        const abgelegt = await objektSpeicher().ablegen(k.mandantId, 'dokument', jpeg, 'image/jpeg')
        datei = { ...abgelegt, dateiname: mitEndung(a.dateiname, 'jpg'), mime: 'image/jpeg' }
      } else if (!ERLAUBTE_TYPEN.has(mime)) {
        throw new Eingabefehler('Diese Dateiart wird nicht abgelegt.')
      }
      const dokumentDaten = daten(d, datei.dateiname)
      // Objekt: gewählt oder das Objekt des Mietverhältnisses (Kaufvertrag braucht es)
      const objektId =
        text(d, 'objektId') ??
        (mietverhaeltnisId
          ? ((await ladeZuordnungsKandidaten(tx)).find(
              (x) => x.mietverhaeltnisId === mietverhaeltnisId,
            )?.objektId ?? null)
          : null)
      if (!objektId && !mietverhaeltnisId && dokumentDaten.typ !== 'beleg')
        throw new Eingabefehler('Bitte ein Objekt wählen (nur Belege dürfen ohne Objekt sein).')
      return ablegen(tx, k, {
        bezug: { objektId, mietverhaeltnisId },
        datei,
        daten: dokumentDaten,
        ersetztId: null,
        anhangId,
      })
    })
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  redirect(await auslesenNachAblage(id))
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

/**
 * Belegte Werte (Zitat steht im PDF) und Werte aus Scans ohne Textebene. Scans lassen sich nicht
 * automatisch prüfen; sie sind vorbelegt, die Übernahme verlangt aber die Bestätigung der Prüfung.
 */
function uebernehmbar(p: Pruefergebnis): boolean {
  return p === 'belegt' || p === 'scan'
}
const SCAN_HINWEIS = 'Scan ohne Textebene, von Hand geprüft'

/** Übernahme aus einem Scan nur mit dem Haken „am Dokument geprüft“ (ScanBestaetigung). */
function pruefeScanBestaetigung(d: FormData, werte: Array<{ pruefung: Pruefergebnis }>) {
  if (werte.some((w) => w.pruefung === 'scan') && text(d, 'scanGeprueft') !== 'ja')
    throw new Eingabefehler('Bitte bestätigen, dass du die Werte aus dem Scan geprüft hast.')
}

/** Miet- oder Kaufvertrag von der KI auslesen lassen (Vorschlag mit Stempel, Datei-Prüfsumme). */
export async function vertragAuslesen(_: FormStatus, d: FormData): Promise<FormStatus> {
  try {
    await verlange({ stammdaten: ['schreiben'] })
    const id = pflicht(d, 'dokumentId', 'Dokument')
    const u = await kiUmgebung()
    if (!u) return { fehler: 'Die KI ist nicht eingerichtet (ANTHROPIC_API_KEY).' }
    const typ = (await mitMandant((tx) => ladeDokument(tx, id)))?.typ
    const kontext = (tx: Tx) => fuerDokument(tx, id, objektSpeicher())
    if (typ === 'kaufvertrag') await erzeugeVorschlag(u, KAUFVERTRAG_EXTRAKTION, kontext)
    else await erzeugeVorschlag(u, MIETVERTRAG_EXTRAKTION, kontext)
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
      ).filter((w) => gewaehlt.has(w.feld) && uebernehmbar(w.pruefung) && w.normiert !== null)
      pruefeScanBestaetigung(d, werte)
      const hinweis = werte.some((w) => w.pruefung === 'scan') ? { hinweis: SCAN_HINWEIS } : {}
      const herkunft = (feld: string, seite: number): Herkunft => ({
        [feld]: { quelle: 'dokument', dokumentId: id, seite, vorschlagId, ...hinweis },
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

/**
 * Kaufvertrag in die Objektakte übernehmen: angehakte, am PDF belegte Daten und Grundbuchblätter,
 * in einer Transaktion mit der Bestätigung des Vorschlags. Grundbuchblätter mit gleichem
 * Amtsgericht und Blatt werden ersetzt, andere ergänzt. Der Gebäudeanteil folgt nur aus einer
 * ausdrücklichen Aufteilung im Vertrag.
 */
export async function kaufvertragUebernehmen(_: FormStatus, d: FormData): Promise<FormStatus> {
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
      if (!dok?.objektId) throw new Eingabefehler('Das Dokument hängt an keinem Objekt.')
      const objektVersion = await letzteVersion(tx, 'objekt', dok.objektId)
      if (!objektVersion) throw new Eingabefehler('Objekt nicht gefunden.')
      const p = await bestaetigeVorschlagInTx(
        tx,
        { mandantId: k.mandantId, akteur: { art: 'nutzer', id: k.nutzerId } },
        vorschlagId,
      )
      if (p.status === 'veraltet')
        throw new Eingabefehler('Seit dem Auslesen hat sich etwas geändert. Bitte neu auslesen.')
      if (p.status !== 'bestaetigt')
        throw new Eingabefehler('Über diesen Vorschlag ist schon entschieden.')
      const { felder, grundbuch } = werteKaufvertragAus(
        p.vorschlag.ausgabe as KaufvertragAuszug,
        await dokumentSeiten(tx, id),
      )
      const belegt = new Map(
        felder
          .filter((w) => gewaehlt.has(w.feld) && uebernehmbar(w.pruefung) && w.normiert !== null)
          .map((w) => [w.feld, w]),
      )
      const blaetter = grundbuch.filter(
        (g) => gewaehlt.has(`grundbuch_${g.index}`) && uebernehmbar(g.pruefung) && g.eintrag,
      )
      const alt = fachdaten('objekt', objektVersion)
      const neu: Record<string, unknown> = {}
      const herkunft: Herkunft = {}
      pruefeScanBestaetigung(d, [...belegt.values(), ...blaetter])
      const scan = felder.some((w) => w.pruefung === 'scan') ? { hinweis: SCAN_HINWEIS } : {}
      const quelle = (feld: string, seite: number) => {
        herkunft[feld] = { quelle: 'dokument', dokumentId: id, seite, vorschlagId, ...scan }
      }
      const datumFeld = belegt.get('kaufvertrag_datum')
      if (datumFeld) {
        neu['kaufvertragDatum'] = datumFeld.normiert
        quelle('kaufvertragDatum', datumFeld.seite)
      }
      const uebergang = belegt.get('uebergang_nutzen_lasten')
      if (uebergang) {
        neu['anschaffungsdatum'] = uebergang.normiert
        quelle('anschaffungsdatum', uebergang.seite)
      }
      const preis = belegt.get('kaufpreis')
      if (preis) {
        neu['kaufpreisCent'] = preis.normiert
        quelle('kaufpreisCent', preis.seite)
      }
      const boden = belegt.get('anteil_grund_boden')
      if (boden) {
        const kaufpreis = (neu['kaufpreisCent'] ?? alt.kaufpreisCent) as number | null | undefined
        const anteil = kaufpreis ? gebaeudeanteilAus(kaufpreis, boden.normiert as number) : null
        if (anteil === null)
          throw new Eingabefehler('Für den Gebäudeanteil fehlt ein passender Kaufpreis.')
        neu['gebaeudeanteilPromille'] = anteil
        quelle('gebaeudeanteilPromille', boden.seite)
      }
      if (blaetter.length) {
        const liste: GrundbuchEintrag[] = [...(alt.grundbuch ?? [])]
        for (const b of blaetter) {
          const e = b.eintrag!
          const i = liste.findIndex((x) => x.amtsgericht === e.amtsgericht && x.blatt === e.blatt)
          if (i >= 0) liste[i] = e
          else liste.push(e)
        }
        neu['grundbuch'] = liste
        quelle('grundbuch', blaetter[0]!.fundstellen[0]?.seite ?? 1)
      }
      await speichere(tx, k, {
        entitaet: 'objekt',
        identId: dok.objektId,
        daten: ObjektDaten.parse({ ...alt, ...neu }),
        gueltigAb: objektVersion.gueltigAb,
        begruendung: `Übernommen aus „${dok.titel}“`,
        herkunft,
      })
    })
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  revalidatePath(`/dokumente/${id}`)
  return {
    hinweis: 'Übernommen. Die Werte stehen jetzt mit Herkunft „Dokument, Seite“ in der Objektakte.',
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
