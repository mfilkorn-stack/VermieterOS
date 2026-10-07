'use server'

import {
  belegMitHash,
  bucheJournal,
  fachdaten,
  juengsterKiVorschlag,
  ladeBeleg,
  ladeDokument,
  ladeJournalEintrag,
  ladeTicket,
  letzteVersion,
  listeBelege,
  objekteFuerBeleg,
  storniereJournal,
  type BelegObjekt,
  type Tx,
} from '@vermieteros/db'
import {
  BELEG_EXTRAKTION,
  bestaetigeVorschlagInTx,
  erzeugeVorschlag,
  fuerBeleg,
  KiFehler,
  verwirfVorschlag,
  werteBelegAus,
  type BelegAuszug,
  type BelegAuswertung,
} from '@vermieteros/ki'
import {
  gleichAufteilen,
  JournalEintragDaten,
  richtungVon,
  Steuerkategorie,
  type Herkunft,
  type HerkunftEintrag,
} from '@vermieteros/schema'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ERLAUBTE_TYPEN, MAX_GROESSE } from '@/lib/dokument-text'
import { datum, Eingabefehler, euro, ganz, haken, pflicht, text, zodText } from '@/lib/eingabe'
import { fehlertext, type FormStatus } from '@/lib/form-status'
import { kiUmgebung } from '@/lib/ki'
import { mitMandant, verlange, type MandantKontext } from '@/lib/sitzung'
import { speichere } from '@/lib/speichern'
import { objektSpeicher } from '@/lib/speicher'
import { dokumentSeiten } from '@/lib/vertrag'
import { heuteBerlin } from '@/lib/zeit'

const LABELS = {
  gegenpartei: 'Lieferant bzw. Zahler',
  zahlungsdatum: 'Zahlungsdatum',
  bruttoCent: 'Betrag',
  steuerkategorie: 'Kategorie',
  anteile: 'Aufteilung',
  leistungVon: 'Leistung von',
  leistungBis: 'Leistung bis',
  kostenart: 'Kostenart',
  umsatzsteuerCent: 'Umsatzsteuer',
}

export type HochladenErgebnis = { id?: string; doppelt?: boolean; fehler?: string }

/**
 * Ein Beleg in den Eingang (Upload, Sammel-Import, Rechnung zum Ticket). Gibt es dieselbe Datei
 * schon als gültigen Beleg, entsteht kein zweiter; die Antwort nennt den vorhandenen.
 */
export async function belegHochladen(d: FormData): Promise<HochladenErgebnis> {
  try {
    await verlange({ stammdaten: ['schreiben'] })
    const datei = d.get('datei')
    if (!(datei instanceof File) || datei.size === 0)
      throw new Eingabefehler('Bitte eine Datei wählen.')
    if (datei.size > MAX_GROESSE) throw new Eingabefehler('Die Datei ist größer als 20 MB.')
    if (!ERLAUBTE_TYPEN.has(datei.type))
      throw new Eingabefehler('Erlaubt sind PDF, JPG, PNG und WebP.')
    const inhalt = Buffer.from(await datei.arrayBuffer())
    const ticketId = text(d, 'ticketId')
    let objektId = text(d, 'objektId')
    return await mitMandant(async (tx, k) => {
      if (ticketId) {
        const t = await ladeTicket(tx, ticketId)
        if (!t) throw new Eingabefehler('Ticket nicht gefunden.')
        objektId = t.objektId
      }
      if (objektId && !(await letzteVersion(tx, 'objekt', objektId)))
        throw new Eingabefehler('Objekt nicht gefunden.')
      const abgelegt = await objektSpeicher().ablegen(k.mandantId, 'dokument', inhalt, datei.type)
      const vorhanden = await belegMitHash(tx, abgelegt.sha256)
      if (vorhanden) return { id: vorhanden, doppelt: true }
      const r = await speichere(tx, k, {
        entitaet: 'dokument',
        identitaet: {
          beleg: true,
          objektId,
          ticketId,
          dateiHash: abgelegt.sha256,
          speicherSchluessel: abgelegt.schluessel,
          dateiname: datei.name,
          mime: datei.type,
          groesseBytes: abgelegt.groesse,
        },
        daten: {
          typ: 'beleg',
          status: 'gueltig',
          titel: (text(d, 'titel') ?? datei.name.replace(/\.[a-z0-9]+$/i, '')).slice(0, 200),
        },
        gueltigAb: heuteBerlin(),
      })
      return { id: r.identId }
    })
  } catch (e) {
    return { fehler: fehlertext(e) }
  } finally {
    revalidatePath('/', 'layout')
  }
}

/** Für den Sammel-Import: einen Beleg auslesen, Ergebnis als Text statt Weiterleitung. */
export async function belegAuslesenDirekt(id: string): Promise<{ fehler?: string }> {
  try {
    await verlange({ stammdaten: ['schreiben'] })
    const u = await kiUmgebung()
    if (!u) return { fehler: 'Die KI ist nicht eingerichtet.' }
    await erzeugeVorschlag(u, BELEG_EXTRAKTION, (tx) => fuerBeleg(tx, id, objektSpeicher()))
    return {}
  } catch (e) {
    return { fehler: e instanceof KiFehler ? e.message : fehlertext(e) }
  }
}

export async function belegAuslesen(_: FormStatus, d: FormData): Promise<FormStatus> {
  const id = pflicht(d, 'dokumentId', 'Beleg')
  const r = await belegAuslesenDirekt(id)
  if (r.fehler) return { fehler: `Die KI konnte den Beleg nicht auslesen: ${r.fehler}` }
  revalidatePath(`/belege/${id}`)
  return {}
}

export async function belegAuswertungVerwerfen(_: FormStatus, d: FormData): Promise<FormStatus> {
  try {
    await verlange({ stammdaten: ['schreiben'] })
    const id = pflicht(d, 'dokumentId', 'Beleg')
    const u = await kiUmgebung()
    if (!u) return { fehler: 'Die KI ist nicht eingerichtet.' }
    await verwirfVorschlag(u, pflicht(d, 'vorschlagId', 'Vorschlag'), 'von Hand verworfen')
    revalidatePath(`/belege/${id}`)
    return {}
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
}

/** Kein Beleg (Werbung, doppelt, privat): aus dem Eingang nehmen, das Dokument bleibt lesbar. */
export async function belegAussortieren(_: FormStatus, d: FormData): Promise<FormStatus> {
  try {
    await verlange({ stammdaten: ['schreiben'] })
    const id = pflicht(d, 'dokumentId', 'Beleg')
    const grund = pflicht(d, 'grund', 'Grund')
    await mitMandant(async (tx, k) => {
      const alt = await ladeDokument(tx, id)
      const v = await letzteVersion(tx, 'dokument', id)
      if (!alt || !v) throw new Eingabefehler('Beleg nicht gefunden.')
      const b = await ladeBeleg(tx, id)
      if (b?.buchung)
        throw new Eingabefehler('Ein gebuchter Beleg wird über die Buchung storniert.')
      await speichere(tx, k, {
        entitaet: 'dokument',
        identId: id,
        daten: { ...fachdaten('dokument', v), status: 'abgelaufen', notizen: grund },
        gueltigAb: heuteBerlin() > alt.gueltigAb ? heuteBerlin() : alt.gueltigAb,
        begruendung: `Aus dem Belegeingang genommen: ${grund}`,
      })
    })
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  revalidatePath('/', 'layout')
  redirect('/belege')
}

/** Formular → Journaleintrag. Felder, die zur Kategorie nicht passen, werden verworfen. */
function buchungAusFormular(d: FormData, objekte: BelegObjekt[]): JournalEintragDaten {
  const kat = Steuerkategorie.safeParse(text(d, 'steuerkategorie'))
  if (!kat.success) throw new Eingabefehler('Bitte eine Kategorie wählen.')
  const k = kat.data
  const brutto = euro(d, 'brutto', 'Betrag')
  if (brutto === null) throw new Eingabefehler('Betrag fehlt.')

  const objektIds = d.getAll('anteilObjekt').map(String)
  const einheitIds = d.getAll('anteilEinheit').map(String)
  const betraege = d.getAll('anteilBetrag').map((b, i) => {
    const f = new FormData()
    f.set('b', String(b))
    return euro(f, 'b', `Anteil ${i + 1}`)
  })
  const zeilen = objektIds
    .map((o, i) => ({ objektId: o, einheitId: einheitIds[i] || null, betrag: betraege[i] ?? null }))
    .filter((z) => z.objektId)
  if (zeilen.length === 0) throw new Eingabefehler('Bitte mindestens ein Objekt wählen.')
  for (const z of zeilen) {
    const o = objekte.find((x) => x.id === z.objektId)
    if (!o) throw new Eingabefehler('Objekt nicht gefunden.')
    if (z.einheitId && !o.einheiten.some((e) => e.id === z.einheitId))
      throw new Eingabefehler(`Die Einheit gehört nicht zu ${o.bezeichnung}.`)
  }
  const leer = zeilen.every((z) => z.betrag === null)
  const gleich = gleichAufteilen(brutto, zeilen.length)
  const anteile = zeilen.map((z, i) => ({
    objektId: z.objektId,
    einheitId: z.einheitId,
    betragCent: zeilen.length === 1 ? brutto : leer ? gleich[i]! : (z.betrag ?? 0),
  }))

  const betriebskosten = k === 'betriebskosten'
  const p = JournalEintragDaten.safeParse({
    richtung: richtungVon(k),
    gegenpartei: text(d, 'gegenpartei'),
    beschreibung: text(d, 'beschreibung'),
    rechnungsnummer: text(d, 'rechnungsnummer'),
    rechnungsdatum: datum(d, 'rechnungsdatum', 'Rechnungsdatum'),
    zahlungsdatum: datum(d, 'zahlungsdatum', 'Zahlungsdatum'),
    leistungVon: datum(d, 'leistungVon', 'Leistung von'),
    leistungBis: datum(d, 'leistungBis', 'Leistung bis'),
    bruttoCent: brutto,
    umsatzsteuerCent: euro(d, 'umsatzsteuer', 'Umsatzsteuer'),
    steuerkategorie: k,
    verteilungJahre: k === 'erhaltungsaufwand' ? ganz(d, 'verteilungJahre', 'Verteilung') : null,
    kostenart: betriebskosten ? text(d, 'kostenart') : null,
    umlagefaehig: betriebskosten && haken(d, 'umlagefaehig'),
    anteile,
  })
  if (!p.success) throw new Eingabefehler(zodText(p.error, LABELS))
  return p.data
}

/**
 * Herkunft je Feld: was der gebuchte Wert mit einer am PDF belegten Fundstelle gemeinsam hat,
 * stammt aus dem Dokument (mit Seite); die übernommene Einordnung aus dem bestätigten Vorschlag.
 */
function herkunftFuer(
  daten: JournalEintragDaten,
  dokumentId: string,
  vorschlagId: string | null,
  auswertung: BelegAuswertung[],
  auszug: BelegAuszug | null,
): Herkunft {
  const belegt = new Map(
    auswertung.filter((w) => w.pruefung === 'belegt').map((w) => [w.feld, w] as const),
  )
  const paare: Array<[keyof JournalEintragDaten, BelegAuswertung['feld']]> = [
    ['gegenpartei', 'lieferant'],
    ['rechnungsnummer', 'rechnungsnummer'],
    ['rechnungsdatum', 'rechnungsdatum'],
    ['bruttoCent', 'betrag_brutto'],
    ['umsatzsteuerCent', 'umsatzsteuer'],
    ['leistungVon', 'leistung_von'],
    ['leistungBis', 'leistung_bis'],
    ['zahlungsdatum', 'zahlungsdatum'],
  ]
  const h: Herkunft = {}
  for (const [feld, quelle] of paare) {
    const w = belegt.get(quelle)
    const eintrag: HerkunftEintrag =
      w && vorschlagId && String(w.normiert) === String(daten[feld])
        ? { quelle: 'dokument', dokumentId, seite: w.seite, vorschlagId }
        : { quelle: 'manuell' }
    if (daten[feld] !== null && daten[feld] !== undefined) h[feld] = eintrag
  }
  const e = auszug?.einordnung
  const ki = (gleich: boolean): HerkunftEintrag =>
    gleich && vorschlagId ? { quelle: 'ki_vorschlag', vorschlagId } : { quelle: 'manuell' }
  h['steuerkategorie'] = ki(e?.steuerkategorie === daten.steuerkategorie)
  if (daten.kostenart) h['kostenart'] = ki(e?.kostenart === daten.kostenart)
  h['umlagefaehig'] = ki(e?.umlagefaehig === daten.umlagefaehig)
  h['anteile'] = ki(
    Boolean(e?.objekt_id) &&
      daten.anteile.length === 1 &&
      daten.anteile[0]?.objektId === e?.objekt_id,
  )
  return h
}

async function naechsterOffenerBeleg(tx: Tx, ausser: string): Promise<string | null> {
  const offen = await listeBelege(tx, { status: 'offen', limit: 2 })
  return offen.find((b) => b.id !== ausser)?.id ?? null
}

/**
 * Bucht einen Beleg: Bestätigung des KI-Vorschlags (falls einer übernommen wurde) und Buchung in
 * einer Transaktion. Danach geht es zum nächsten offenen Beleg: ein Klick pro Beleg.
 */
export async function belegBuchen(_: FormStatus, d: FormData): Promise<FormStatus> {
  let weiter: string
  try {
    await verlange({ stammdaten: ['schreiben'] })
    const dokumentId = pflicht(d, 'dokumentId', 'Beleg')
    const vorschlagId = text(d, 'vorschlagId')
    weiter = await mitMandant(async (tx, k: MandantKontext) => {
      const b = await ladeBeleg(tx, dokumentId)
      if (!b) throw new Eingabefehler('Beleg nicht gefunden.')
      if (b.buchung)
        throw new Eingabefehler(`Der Beleg ist schon gebucht (${b.buchung.belegnummer}).`)
      const daten = buchungAusFormular(d, await objekteFuerBeleg(tx))
      let auswertung: BelegAuswertung[] = []
      let auszug: BelegAuszug | null = null
      if (vorschlagId) {
        const v = await juengsterKiVorschlag(tx, BELEG_EXTRAKTION.name, {
          entitaet: 'dokument',
          id: dokumentId,
        })
        if (!v || v.id !== vorschlagId)
          throw new Eingabefehler('Der Vorschlag passt nicht zum Beleg.')
        if (v.status !== 'offen' && v.status !== 'bestaetigt')
          throw new Eingabefehler('Die Auswertung ist nicht mehr gültig. Bitte neu auslesen.')
        if (v.status === 'offen') {
          const p = await bestaetigeVorschlagInTx(
            tx,
            { mandantId: k.mandantId, akteur: { art: 'nutzer', id: k.nutzerId } },
            vorschlagId,
          )
          if (p.status === 'veraltet')
            throw new Eingabefehler(
              'Seit dem Auslesen hat sich etwas geändert. Bitte neu auslesen.',
            )
        }
        auszug = v.ausgabe as BelegAuszug
        auswertung = werteBelegAus(auszug, await dokumentSeiten(tx, dokumentId))
      }
      await bucheJournal(tx, {
        mandantId: k.mandantId,
        akteur: { art: 'nutzer', id: k.nutzerId },
        daten,
        dokumentId,
        ticketId: b.ticketId,
        vorschlagId,
        herkunft: herkunftFuer(daten, dokumentId, vorschlagId, auswertung, auszug),
      })
      const n = await naechsterOffenerBeleg(tx, dokumentId)
      return n ? `/belege/${n}` : '/belege?gebucht=1'
    })
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  revalidatePath('/', 'layout')
  redirect(weiter)
}

/** Buchung ohne Beleg: Mieteingänge (bis der Bank-Abgleich kommt), Kleinbeträge, Korrekturen. */
export async function journalBuchen(_: FormStatus, d: FormData): Promise<FormStatus> {
  let id: string
  try {
    await verlange({ stammdaten: ['schreiben'] })
    id = await mitMandant(async (tx, k) => {
      const daten = buchungAusFormular(d, await objekteFuerBeleg(tx))
      const r = await bucheJournal(tx, {
        mandantId: k.mandantId,
        akteur: { art: 'nutzer', id: k.nutzerId },
        daten,
        herkunft: Object.fromEntries(
          Object.keys(daten).map((f) => [f, { quelle: 'manuell' as const }]),
        ),
      })
      return r.id
    })
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  revalidatePath('/', 'layout')
  redirect(`/journal/${id}`)
}

/** Storno: der Eintrag bleibt sichtbar, zählt nicht mehr; ein Beleg ist danach wieder offen. */
export async function journalStornieren(_: FormStatus, d: FormData): Promise<FormStatus> {
  let ziel: string
  try {
    await verlange({ stammdaten: ['schreiben'] })
    const id = pflicht(d, 'eintragId', 'Eintrag')
    const grund = pflicht(d, 'grund', 'Grund')
    ziel = await mitMandant(async (tx, k) => {
      const e = await ladeJournalEintrag(tx, id)
      if (!e) throw new Eingabefehler('Eintrag nicht gefunden.')
      await storniereJournal(tx, {
        mandantId: k.mandantId,
        akteur: { art: 'nutzer', id: k.nutzerId },
        id,
        grund,
      })
      return e.dokumentId ? `/belege/${e.dokumentId}` : `/journal/${id}`
    })
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  revalidatePath('/', 'layout')
  redirect(ziel)
}
