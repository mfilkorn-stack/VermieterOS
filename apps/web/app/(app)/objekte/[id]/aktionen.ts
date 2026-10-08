'use server'

import {
  fachdaten,
  letzteVersion,
  portalZugaengeZuMv,
  widerrufePortalZugang,
  type Tx,
} from '@vermieteros/db'
import {
  DarlehenDaten,
  EinheitDaten,
  MietkonditionDaten,
  MietverhaeltnisDaten,
  ObjektDaten,
  PersonDaten,
} from '@vermieteros/schema'
import { sql } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import type { GrundbuchRoh } from '@/components/grundbuch-editor'
import type { NebenkostenRoh } from '@/components/nebenkosten-editor'
import {
  bruch,
  datum,
  dezimal,
  euro,
  Eingabefehler,
  haken,
  json,
  pflicht,
  text,
  zodText,
} from '@/lib/eingabe'
import { fehlertext, type FormStatus } from '@/lib/form-status'
import { mitMandant, verlange, type MandantKontext } from '@/lib/sitzung'
import { setzeHinweis } from '@/lib/hinweis'
import { speichere } from '@/lib/speichern'
import { heuteBerlin } from '@/lib/zeit'
import { grundbuchAusRoh, nebenkostenAusRoh } from '@/lib/umwandeln'

/** Gemeinsamer Rahmen: Recht prüfen, im Mandanten-Kontext schreiben, Fehler als Text. */
async function schreibe(
  daten: FormData,
  fn: (tx: Tx, k: MandantKontext, objektId: string) => Promise<string | void>,
): Promise<FormStatus> {
  let ziel: string | void
  try {
    await verlange({ stammdaten: ['schreiben'] })
    const objektId = pflicht(daten, 'objektId', 'Objekt')
    ziel = await mitMandant(async (tx, k) => {
      if (!(await letzteVersion(tx, 'objekt', objektId)))
        throw new Eingabefehler('Objekt nicht gefunden.')
      return (await fn(tx, k, objektId)) ?? `/objekte/${objektId}`
    })
    await setzeHinweis('Gespeichert.')
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  redirect(ziel as string)
}

function parse<T>(
  schema: {
    safeParse: (
      x: unknown,
    ) => { success: true; data: T } | { success: false; error: import('zod').ZodError }
  },
  roh: unknown,
  labels?: Record<string, string>,
): T {
  const r = schema.safeParse(roh)
  if (!r.success) throw new Eingabefehler(zodText(r.error, labels))
  return r.data
}

export async function stammdatenSpeichern(_: FormStatus, d: FormData): Promise<FormStatus> {
  return schreibe(d, async (tx, k, objektId) => {
    const alt = fachdaten('objekt', (await letzteVersion(tx, 'objekt', objektId))!)
    const daten = parse(ObjektDaten, {
      ...alt,
      bezeichnung: pflicht(d, 'bezeichnung', 'Bezeichnung'),
      art: pflicht(d, 'art', 'Art'),
      strasse: text(d, 'strasse'),
      hausnummer: text(d, 'hausnummer'),
      plz: text(d, 'plz'),
      ort: text(d, 'ort'),
      bundesland: text(d, 'bundesland'),
      baujahr: dezimal(d, 'baujahr', 'Baujahr', 0),
      weg: haken(d, 'weg'),
      grundbuch: grundbuchAusRoh(json<GrundbuchRoh[]>(d, 'grundbuch')),
    })
    await speichere(tx, k, {
      entitaet: 'objekt',
      identId: objektId,
      daten,
      gueltigAb: datum(d, 'giltAb', 'Gilt ab'),
      begruendung: text(d, 'begruendung'),
    })
  })
}

export async function kaufSpeichern(_: FormStatus, d: FormData): Promise<FormStatus> {
  return schreibe(d, async (tx, k, objektId) => {
    const alt = fachdaten('objekt', (await letzteVersion(tx, 'objekt', objektId))!)
    const anschaffungsdatum = datum(d, 'anschaffungsdatum', 'Übergang von Nutzen und Lasten')
    const daten = parse(ObjektDaten, {
      ...alt,
      kaufvertragDatum: datum(d, 'kaufvertragDatum', 'Datum Kaufvertrag'),
      anschaffungsdatum,
      kaufpreisCent: euro(d, 'kaufpreis', 'Kaufpreis'),
      anschaffungsnebenkosten: nebenkostenAusRoh(json<NebenkostenRoh[]>(d, 'nebenkosten')),
      gebaeudeanteilPromille: dezimal(d, 'gebaeudeanteil', 'Gebäudeanteil', 1),
      afaSatzPromille: dezimal(d, 'afaSatz', 'AfA-Satz', 1),
      afaBeginn: datum(d, 'afaBeginn', 'AfA-Beginn') ?? anschaffungsdatum,
    })
    await speichere(tx, k, {
      entitaet: 'objekt',
      identId: objektId,
      daten,
      gueltigAb: datum(d, 'giltAb', 'Gilt ab'),
      begruendung: text(d, 'begruendung'),
    })
  })
}

function einheitAusFormular(d: FormData) {
  const mea = bruch(text(d, 'meaZaehler'), text(d, 'meaNenner'), 'Miteigentumsanteil')
  return parse(EinheitDaten, {
    bezeichnung: pflicht(d, 'bezeichnung', 'Bezeichnung'),
    typ: pflicht(d, 'typ', 'Typ'),
    lage: text(d, 'lage'),
    wohnflaecheQm100: dezimal(d, 'wohnflaeche', 'Wohnfläche', 2),
    zimmerX10: dezimal(d, 'zimmer', 'Zimmer', 1),
    miteigentumsanteilZaehler: mea?.zaehler ?? null,
    miteigentumsanteilNenner: mea?.nenner ?? null,
  })
}

export async function einheitSpeichern(_: FormStatus, d: FormData): Promise<FormStatus> {
  return schreibe(d, async (tx, k, objektId) => {
    const daten = einheitAusFormular(d)
    const eid = text(d, 'einheitId')
    if (eid) {
      await speichere(tx, k, {
        entitaet: 'einheit',
        identId: eid,
        daten,
        gueltigAb: datum(d, 'giltAb', 'Gilt ab'),
        begruendung: text(d, 'begruendung'),
      })
    } else {
      const r = await speichere(tx, k, {
        entitaet: 'einheit',
        identitaet: { objektId },
        daten,
        gueltigAb: datum(d, 'giltAb', 'Gilt ab'),
      })
      // Nächster Schritt nach einer neuen Einheit: das Mietverhältnis (Hinweis in der Akte)
      return `/objekte/${objektId}?neu=${r.identId}`
    }
  })
}

export async function vermietungAnlegen(_: FormStatus, d: FormData): Promise<FormStatus> {
  return schreibe(d, async (tx, k, objektId) => {
    const einheitId = pflicht(d, 'einheitId', 'Einheit')
    const beginn = datum(d, 'beginn', 'Mietbeginn')
    if (!beginn) throw new Eingabefehler('Mietbeginn fehlt.')
    const mieterIds: string[] = []
    for (const person of personenAusFormular(d)) {
      const p = await speichere(tx, k, {
        entitaet: 'person',
        identitaet: {},
        daten: person,
        gueltigAb: beginn,
      })
      mieterIds.push(p.identId)
    }
    const mv = parse(MietverhaeltnisDaten, {
      beginn,
      ende: datum(d, 'ende', 'Mietende'),
      kuendigungsfristMonate: dezimal(d, 'kuendigungsfrist', 'Kündigungsfrist', 0) ?? 3,
      kautionCent: euro(d, 'kaution', 'Kaution'),
      kautionArt: text(d, 'kautionArt') ?? 'keine',
      mieterIds,
    })
    const m = await speichere(tx, k, {
      entitaet: 'mietverhaeltnis',
      identitaet: { einheitId },
      daten: mv,
      gueltigAb: beginn,
    })
    await speichere(tx, k, {
      entitaet: 'mietkondition',
      identitaet: { mietverhaeltnisId: m.identId },
      daten: konditionAusFormular(d),
      gueltigAb: beginn,
    })
    return `/objekte/${objektId}/einheiten/${einheitId}/vermietung`
  })
}

/** Eine oder mehrere Personen der Mietpartei aus gleichnamigen Feldern (z. B. Paar oder WG). */
function personenAusFormular(d: FormData): PersonDaten[] {
  const alle = (n: string) => d.getAll(n).map((v) => (typeof v === 'string' ? v.trim() : ''))
  const [vornamen, nachnamen, emails, telefone] = ['vorname', 'nachname', 'email', 'telefon'].map(
    alle,
  )
  const personen = nachnamen!.map((nachname, i) => {
    if (!nachname) throw new Eingabefehler(`Nachname fehlt (Person ${i + 1}).`)
    return parse(PersonDaten, {
      rolle: 'mieter',
      vorname: vornamen![i] || null,
      nachname,
      email: emails![i] || null,
      telefon: telefone![i] || null,
    })
  })
  if (personen.length === 0) throw new Eingabefehler('Nachname fehlt.')
  return personen
}

function vermietungsSeite(d: FormData, objektId: string): string {
  return `/objekte/${objektId}/einheiten/${pflicht(d, 'einheitId', 'Einheit')}/vermietung`
}

/** Personenzahl der aktuellen Mietkondition um `delta` ändern, ab `giltAb` (Betriebskosten). */
async function personenzahlAnpassen(
  tx: Tx,
  k: MandantKontext,
  mvId: string,
  delta: number,
  giltAb: string,
  begruendung: string,
) {
  const [r] = await tx.execute<{ id: string }>(
    sql`select id from mietkonditionen where mietverhaeltnis_id = ${mvId} order by erstellt_am limit 1`,
  )
  if (!r) return
  const alt = fachdaten('mietkondition', (await letzteVersion(tx, 'mietkondition', r.id))!)
  await speichere(tx, k, {
    entitaet: 'mietkondition',
    identId: r.id,
    daten: parse(MietkonditionDaten, {
      ...alt,
      personenzahl: Math.max(1, (alt.personenzahl ?? 1) + delta),
      grund: 'vereinbarung',
    }),
    gueltigAb: giltAb,
    begruendung,
  })
}

/** Kontaktdaten einer Person der Mietpartei ändern (neue Version, alte bleibt im Verlauf). */
export async function mieterBearbeiten(_: FormStatus, d: FormData): Promise<FormStatus> {
  return schreibe(d, async (tx, k, objektId) => {
    const mvId = pflicht(d, 'mietverhaeltnisId', 'Mietverhältnis')
    const personId = pflicht(d, 'personId', 'Person')
    const mv = await letzteVersion(tx, 'mietverhaeltnis', mvId)
    if (!mv?.mieterIds.includes(personId))
      throw new Eingabefehler('Die Person gehört nicht zu diesem Mietverhältnis.')
    const letzte = (await letzteVersion(tx, 'person', personId))!
    const alt = fachdaten('person', letzte)
    const heute = heuteBerlin()
    await speichere(tx, k, {
      entitaet: 'person',
      identId: personId,
      daten: parse(PersonDaten, {
        ...alt,
        vorname: text(d, 'vorname'),
        nachname: pflicht(d, 'nachname', 'Nachname'),
        email: text(d, 'email'),
        telefon: text(d, 'telefon'),
      }),
      // Neue Kontaktdaten gelten ab heute; der alte Stand bleibt im Verlauf.
      gueltigAb: heute > letzte.gueltigAb ? heute : letzte.gueltigAb,
      begruendung: text(d, 'begruendung') ?? 'Kontaktdaten aktualisiert',
    })
    return vermietungsSeite(d, objektId)
  })
}

/** Weitere Person zieht in die Mietpartei ein (z. B. neue Mitbewohnerin in der WG). */
export async function mieterEinzug(_: FormStatus, d: FormData): Promise<FormStatus> {
  return schreibe(d, async (tx, k, objektId) => {
    const mvId = pflicht(d, 'mietverhaeltnisId', 'Mietverhältnis')
    const ab = datum(d, 'ab', 'Einzug am')
    if (!ab) throw new Eingabefehler('Einzug am fehlt.')
    const alt = fachdaten('mietverhaeltnis', (await letzteVersion(tx, 'mietverhaeltnis', mvId))!)
    if (ab < alt.beginn) throw new Eingabefehler('Der Einzug liegt vor dem Mietbeginn.')
    const [person] = personenAusFormular(d)
    const p = await speichere(tx, k, {
      entitaet: 'person',
      identitaet: {},
      daten: person!,
      gueltigAb: ab,
    })
    const name = [person!.vorname, person!.nachname].filter(Boolean).join(' ')
    await speichere(tx, k, {
      entitaet: 'mietverhaeltnis',
      identId: mvId,
      daten: parse(MietverhaeltnisDaten, { ...alt, mieterIds: [...alt.mieterIds, p.identId] }),
      gueltigAb: ab,
      begruendung: 'Einzug ' + name,
    })
    if (haken(d, 'personenzahl')) await personenzahlAnpassen(tx, k, mvId, 1, ab, 'Einzug ' + name)
    return vermietungsSeite(d, objektId)
  })
}

/**
 * Eine Person verlässt die Mietpartei; das Mietverhältnis läuft mit den übrigen weiter. Ein
 * Zugang zum Mieterportal für diese Person wird gesperrt.
 */
export async function mieterAuszug(_: FormStatus, d: FormData): Promise<FormStatus> {
  return schreibe(d, async (tx, k, objektId) => {
    const mvId = pflicht(d, 'mietverhaeltnisId', 'Mietverhältnis')
    const personId = pflicht(d, 'personId', 'Person')
    const ab = datum(d, 'ab', 'Auszug am')
    if (!ab) throw new Eingabefehler('Auszug am fehlt.')
    const alt = fachdaten('mietverhaeltnis', (await letzteVersion(tx, 'mietverhaeltnis', mvId))!)
    if (!alt.mieterIds.includes(personId))
      throw new Eingabefehler('Die Person gehört nicht zu diesem Mietverhältnis.')
    if (alt.mieterIds.length < 2)
      throw new Eingabefehler(
        'Die letzte Person kann nicht ausziehen. Dafür das Mietende eintragen.',
      )
    const p = await letzteVersion(tx, 'person', personId)
    const name = [p?.vorname, p?.nachname].filter(Boolean).join(' ')
    await speichere(tx, k, {
      entitaet: 'mietverhaeltnis',
      identId: mvId,
      daten: parse(MietverhaeltnisDaten, {
        ...alt,
        mieterIds: alt.mieterIds.filter((id) => id !== personId),
      }),
      gueltigAb: ab,
      begruendung: 'Auszug ' + name,
    })
    for (const z of await portalZugaengeZuMv(tx, mvId)) {
      if (z.personId === personId && !z.widerrufenAm)
        await widerrufePortalZugang(tx, {
          mandantId: k.mandantId,
          id: z.id,
          akteur: { art: 'nutzer', id: k.nutzerId },
        })
    }
    if (haken(d, 'personenzahl')) await personenzahlAnpassen(tx, k, mvId, -1, ab, 'Auszug ' + name)
    return vermietungsSeite(d, objektId)
  })
}

function konditionAusFormular(d: FormData) {
  return parse(MietkonditionDaten, {
    kaltmieteCent: euro(d, 'kaltmiete', 'Kaltmiete'),
    vorauszahlungBkCent: euro(d, 'vorauszahlungBk', 'Vorauszahlung Betriebskosten') ?? 0,
    vorauszahlungHkCent: euro(d, 'vorauszahlungHk', 'Vorauszahlung Heizkosten') ?? 0,
    mietart: text(d, 'mietart') ?? 'vergleich',
    personenzahl: dezimal(d, 'personenzahl', 'Personenzahl', 0) ?? 1,
    grund: text(d, 'grund') ?? 'vertrag',
  })
}

export async function konditionAendern(_: FormStatus, d: FormData): Promise<FormStatus> {
  return schreibe(d, async (tx, k, objektId) => {
    const giltAb = datum(d, 'giltAb', 'Gilt ab')
    if (!giltAb) throw new Eingabefehler('Gilt ab fehlt.')
    await speichere(tx, k, {
      entitaet: 'mietkondition',
      identId: pflicht(d, 'konditionId', 'Kondition'),
      daten: konditionAusFormular(d),
      gueltigAb: giltAb,
      begruendung: text(d, 'begruendung'),
    })
    return `/objekte/${objektId}/einheiten/${pflicht(d, 'einheitId', 'Einheit')}/vermietung`
  })
}

export async function mietverhaeltnisBeenden(_: FormStatus, d: FormData): Promise<FormStatus> {
  return schreibe(d, async (tx, k, objektId) => {
    const mvId = pflicht(d, 'mietverhaeltnisId', 'Mietverhältnis')
    const alt = fachdaten('mietverhaeltnis', (await letzteVersion(tx, 'mietverhaeltnis', mvId))!)
    const daten = parse(MietverhaeltnisDaten, { ...alt, ende: datum(d, 'ende', 'Mietende') })
    await speichere(tx, k, {
      entitaet: 'mietverhaeltnis',
      identId: mvId,
      daten,
      begruendung: text(d, 'begruendung'),
    })
    return `/objekte/${objektId}/einheiten/${pflicht(d, 'einheitId', 'Einheit')}/vermietung`
  })
}

export async function darlehenSpeichern(_: FormStatus, d: FormData): Promise<FormStatus> {
  return schreibe(d, async (tx, k, objektId) => {
    const daten = parse(DarlehenDaten, {
      bank: pflicht(d, 'bank', 'Bank'),
      kennzeichen: text(d, 'kennzeichen'),
      nominalCent: euro(d, 'nominal', 'Darlehensbetrag'),
      auszahlungAm: datum(d, 'auszahlungAm', 'Auszahlung'),
      zinsBp: dezimal(d, 'zins', 'Sollzins', 2),
      tilgungBp: dezimal(d, 'tilgung', 'Tilgung', 2),
      rateCent: euro(d, 'rate', 'Rate'),
      zinsbindungBis: datum(d, 'zinsbindungBis', 'Zinsbindung bis'),
      sondertilgungCentPa: euro(d, 'sondertilgung', 'Sondertilgung'),
      restschuldCent: euro(d, 'restschuld', 'Restschuld'),
      restschuldStand: datum(d, 'restschuldStand', 'Restschuld zum'),
    })
    const did = text(d, 'darlehenId')
    if (did) {
      await speichere(tx, k, {
        entitaet: 'darlehen',
        identId: did,
        daten,
        gueltigAb: datum(d, 'giltAb', 'Gilt ab'),
        begruendung: text(d, 'begruendung'),
      })
    } else {
      await speichere(tx, k, {
        entitaet: 'darlehen',
        identitaet: { objektId },
        daten,
        gueltigAb: datum(d, 'giltAb', 'Gilt ab'),
      })
    }
  })
}
