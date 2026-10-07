'use server'

import {
  bkAbrechnungZuJahr,
  bkNutzungen,
  vermerkeBkVersand,
  portalZugaengeZuMv,
  ladeBkAbrechnung,
  ladeDokument,
  neueVersion,
  storniereVersion,
} from '@vermieteros/db'
import type { BkAbrechnungDaten } from '@vermieteros/schema'
import { redirect } from 'next/navigation'
import { ausRoh, datenAusVersion, ladeBkSeite, type BkRoh } from '@/lib/bk'
import { festschreiben } from '@/lib/bk-festschreiben'
import { euroAnzeige } from '@/lib/format'
import { sendeMail } from '@/lib/mail'
import { BASIS_URL } from '@/lib/portal'
import { schreibDaten } from '@/lib/schreiben'
import { objektSpeicher } from '@/lib/speicher'
import { datum, Eingabefehler, euro, json, pflicht } from '@/lib/eingabe'
import { fehlertext, type FormStatus } from '@/lib/form-status'
import { mitMandant, verlange } from '@/lib/sitzung'
import { heuteBerlin } from '@/lib/zeit'

/**
 * Neue Abrechnung für Einheit und Jahr. Positionen und Bezugsgrößen kommen aus dem Vorjahr,
 * die Beträge sind leer: Jede Zahl wird für das neue Jahr bewusst eingetragen.
 */
export async function bkAnlegen(_: FormStatus, d: FormData): Promise<FormStatus> {
  let id: string
  try {
    await verlange({ stammdaten: ['schreiben'] })
    const einheitId = pflicht(d, 'einheitId', 'Einheit')
    const jahr = Number(pflicht(d, 'jahr', 'Jahr'))
    if (!Number.isInteger(jahr) || jahr < 2000 || jahr > 2100)
      throw new Eingabefehler('Jahr zwischen 2000 und 2100.')
    id = await mitMandant(async (tx, k) => {
      const vorhanden = await bkAbrechnungZuJahr(tx, einheitId, jahr)
      if (vorhanden) return vorhanden
      const vorjahrId = await bkAbrechnungZuJahr(tx, einheitId, jahr - 1)
      const vorjahr = vorjahrId ? await ladeBkAbrechnung(tx, vorjahrId) : null
      const alt = vorjahr ? datenAusVersion(vorjahr.version) : null
      const daten: BkAbrechnungDaten = {
        zeitraumVon: `${jahr}-01-01`,
        zeitraumBis: `${jahr}-12-31`,
        positionen: (alt?.positionen ?? []).map((p) => ({
          ...p,
          gesamtCent: 0,
          schluessel:
            p.schluessel.art === 'direkt' ? { art: 'direkt', einheitCent: 0 } : p.schluessel,
        })),
        messdienst: null,
        vorauszahlungen: null,
        status: 'entwurf',
        notizen: null,
      }
      const r = await neueVersion(tx, {
        entitaet: 'bk_abrechnung',
        mandantId: k.mandantId,
        akteur: { art: 'nutzer', id: k.nutzerId },
        gueltigAb: heuteBerlin(),
        identitaet: { einheitId, jahr },
        daten,
      })
      return r.identId
    })
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  redirect(`/betriebskosten/${id}`)
}

export async function bkSpeichern(_: FormStatus, d: FormData): Promise<FormStatus> {
  const id = pflicht(d, 'id', 'Abrechnung')
  try {
    await verlange({ stammdaten: ['schreiben'] })
    const roh = json<BkRoh>(d, 'daten')
    if (!roh) throw new Eingabefehler('Keine Daten.')
    const daten = ausRoh(roh, 'entwurf')
    await mitMandant(async (tx, k) => {
      const a = await ladeBkAbrechnung(tx, id)
      if (!a) throw new Eingabefehler('Abrechnung nicht gefunden.')
      if (a.version.status === 'festgeschrieben')
        throw new Eingabefehler(
          'Die Abrechnung ist festgeschrieben und lässt sich nicht mehr ändern.',
        )
      await neueVersion(tx, {
        entitaet: 'bk_abrechnung',
        mandantId: k.mandantId,
        akteur: { art: 'nutzer', id: k.nutzerId },
        gueltigAb: heuteBerlin(),
        identId: id,
        begruendung: 'Entwurf bearbeitet',
        daten,
      })
    })
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  redirect(`/betriebskosten/${id}`)
}

/**
 * Festschreiben: PDFs je Mietverhältnis als Dokumente, optional neue Vorauszahlung, danach ist
 * die Abrechnung gesperrt. Felder je Mietverhältnis: `neu_<id>` (€) und `ab_<id>` (Datum).
 */
export async function bkFestschreiben(_: FormStatus, d: FormData): Promise<FormStatus> {
  const id = pflicht(d, 'id', 'Abrechnung')
  try {
    await verlange({ stammdaten: ['schreiben'] })
    const briefdatum = datum(d, 'briefdatum', 'Datum des Schreibens') ?? heuteBerlin()
    await mitMandant(async (tx, k) => {
      const s = await ladeBkSeite(tx, id)
      if (!s) throw new Eingabefehler('Abrechnung nicht gefunden.')
      if (s.daten.status === 'festgeschrieben')
        throw new Eingabefehler('Die Abrechnung ist schon festgeschrieben.')
      const anpassungen: Record<string, { neuCent: number; ab: string }> = {}
      for (const n of s.nutzungen) {
        const neu = euro(d, `neu_${n.mietverhaeltnisId}`, 'Neue Vorauszahlung')
        if (neu == null) continue
        const ab = datum(d, `ab_${n.mietverhaeltnisId}`, 'Anpassung ab')
        if (!ab) throw new Eingabefehler('Für die neue Vorauszahlung fehlt das Datum „ab“.')
        if (ab <= briefdatum)
          throw new Eingabefehler(
            'Die neue Vorauszahlung gilt frühestens ab dem Folgemonat des Schreibens.',
          )
        anpassungen[n.mietverhaeltnisId] = { neuCent: neu, ab }
      }
      await festschreiben(tx, k, s, { briefdatum, anpassungen })
    })
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  redirect(`/betriebskosten/${id}`)
}

/**
 * Festschreibung aufheben (Korrektur): die festgeschriebene Version wird storniert, die
 * ausgestellten PDFs gelten als ersetzt. Eine angepasste Vorauszahlung bleibt bestehen.
 */
export async function bkAufheben(_: FormStatus, d: FormData): Promise<FormStatus> {
  const id = pflicht(d, 'id', 'Abrechnung')
  try {
    await verlange({ stammdaten: ['schreiben'] })
    const grund = pflicht(d, 'grund', 'Grund der Korrektur')
    await mitMandant(async (tx, k) => {
      const a = await ladeBkAbrechnung(tx, id)
      if (!a || a.version.status !== 'festgeschrieben')
        throw new Eingabefehler('Die Abrechnung ist nicht festgeschrieben.')
      const akteur = { art: 'nutzer' as const, id: k.nutzerId }
      for (const e of a.version.ergebnis ?? []) {
        const dok = await ladeDokument(tx, e.dokumentId)
        if (!dok || dok.status !== 'gueltig') continue
        await neueVersion(tx, {
          entitaet: 'dokument',
          mandantId: k.mandantId,
          akteur,
          gueltigAb: heuteBerlin(),
          identId: e.dokumentId,
          begruendung: `Abrechnung korrigiert: ${grund}`,
          daten: {
            typ: dok.typ,
            titel: dok.titel,
            dokumentdatum: dok.dokumentdatum,
            gueltigBis: dok.gueltigBis,
            notizen: dok.notizen,
            status: 'ersetzt',
          },
        })
      }
      await storniereVersion(tx, {
        entitaet: 'bk_abrechnung',
        mandantId: k.mandantId,
        versionId: a.version.id,
        akteur,
        grund,
      })
    })
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  redirect(`/betriebskosten/${id}`)
}

async function festgeschriebenFuer(
  tx: Parameters<Parameters<typeof mitMandant>[0]>[0],
  id: string,
  mvId: string,
) {
  const a = await ladeBkAbrechnung(tx, id)
  if (!a || a.version.status !== 'festgeschrieben')
    throw new Eingabefehler('Die Abrechnung ist nicht festgeschrieben.')
  const e = a.version.ergebnis?.find((x) => x.mietverhaeltnisId === mvId)
  if (!e) throw new Eingabefehler('Für dieses Mietverhältnis gibt es keine Abrechnung.')
  return { a, e }
}

/** Abrechnung per Mail an alle Mieter mit Adresse, PDF im Anhang; Versand steht im Ledger. */
export async function bkVersenden(_: FormStatus, d: FormData): Promise<FormStatus> {
  const id = pflicht(d, 'id', 'Abrechnung')
  try {
    await verlange({ stammdaten: ['schreiben'] })
    const mvId = pflicht(d, 'mietverhaeltnisId', 'Mietverhältnis')
    const r = await mitMandant(async (tx, k) => {
      const { a, e } = await festgeschriebenFuer(tx, id, mvId)
      const n = (
        await bkNutzungen(tx, a.einheitId, a.version.zeitraumVon, a.version.zeitraumBis)
      ).find((x) => x.mietverhaeltnisId === mvId)
      if (!n?.emails.length)
        throw new Eingabefehler('Für die Mieter ist keine Mail-Adresse erfasst.')
      const dok = await ladeDokument(tx, e.dokumentId)
      if (!dok) throw new Eingabefehler('PDF nicht gefunden.')
      const sd = await schreibDaten(tx, mvId)
      const portal = (await portalZugaengeZuMv(tx, mvId)).some((z) => !z.widerrufenAm)
      return {
        a,
        e,
        n,
        dok,
        sd,
        portal,
        inhalt: await objektSpeicher().holen(dok.speicherSchluessel),
        k,
      }
    })
    const wohnung = [r.sd?.wohnung.lage, ...(r.sd?.wohnung.anschrift ?? [])]
      .filter(Boolean)
      .join(', ')
    const ergebnis =
      r.e.saldoCent > 0
        ? 'mit einer Nachzahlung von ' + euroAnzeige(r.e.saldoCent)
        : r.e.saldoCent < 0
          ? 'mit einem Guthaben von ' + euroAnzeige(-r.e.saldoCent)
          : 'ausgeglichen'
    const ok = await sendeMail({
      art: 'bk-abrechnung',
      an: r.n.emails.join(', '),
      betreff: 'Betriebskostenabrechnung ' + r.a.jahr + ' · ' + wohnung,
      text: [
        'Guten Tag,',
        '',
        'anbei erhalten Sie die Betriebskostenabrechnung ' + r.a.jahr + ' für ' + wohnung + '.',
        'Die Abrechnung endet ' + ergebnis + '. Alle Einzelheiten stehen im angehängten PDF.',
        ...(r.portal
          ? ['', 'Sie finden die Abrechnung auch im Mieterportal: ' + BASIS_URL + '/portal']
          : []),
        '',
        'Mit freundlichen Grüßen',
        r.sd?.vermieter.name ?? '',
      ].join('\n'),
      anhaenge: [{ dateiname: r.dok.dateiname, inhalt: r.inhalt, mime: r.dok.mime }],
    })
    if (!ok)
      throw new Eingabefehler(
        'Die Mail konnte nicht verschickt werden (Mailversand nicht eingerichtet oder abgelehnt).',
      )
    await mitMandant((tx, k) =>
      vermerkeBkVersand(tx, {
        mandantId: k.mandantId,
        abrechnungId: id,
        akteur: { art: 'nutzer', id: k.nutzerId },
        mietverhaeltnisId: mvId,
        dokumentId: r.e.dokumentId,
        art: 'mail',
        an: r.n.emails,
        datum: heuteBerlin(),
      }),
    )
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  redirect(`/betriebskosten/${id}`)
}

/** Versand per Post vermerken (Einwurf, Einschreiben, Bote), mit Datum für die Frist. */
export async function bkPostVermerken(_: FormStatus, d: FormData): Promise<FormStatus> {
  const id = pflicht(d, 'id', 'Abrechnung')
  try {
    await verlange({ stammdaten: ['schreiben'] })
    const mvId = pflicht(d, 'mietverhaeltnisId', 'Mietverhältnis')
    const tag = datum(d, 'datum', 'Datum') ?? heuteBerlin()
    if (tag > heuteBerlin()) throw new Eingabefehler('Das Datum liegt in der Zukunft.')
    await mitMandant(async (tx, k) => {
      const { e } = await festgeschriebenFuer(tx, id, mvId)
      await vermerkeBkVersand(tx, {
        mandantId: k.mandantId,
        abrechnungId: id,
        akteur: { art: 'nutzer', id: k.nutzerId },
        mietverhaeltnisId: mvId,
        dokumentId: e.dokumentId,
        art: 'post',
        notiz: (d.get('notiz') as string | null)?.trim() || null,
        datum: tag,
      })
    })
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  redirect(`/betriebskosten/${id}`)
}
