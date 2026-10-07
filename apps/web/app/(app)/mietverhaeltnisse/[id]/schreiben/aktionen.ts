'use server'

import {
  briefPdf,
  mietschuldenfreiheit,
  vermieterbescheinigung,
  wohnungsgeberbestaetigung,
  type Brief,
} from '@vermieteros/pdf'
import { redirect } from 'next/navigation'
import { datum, Eingabefehler, haken, pflicht, text } from '@/lib/eingabe'
import { fehlertext, type FormStatus } from '@/lib/form-status'
import { datumAnzeige } from '@/lib/format'
import { parteiAusText, schreibDaten } from '@/lib/schreiben'
import { mitMandant, verlange } from '@/lib/sitzung'
import { speichere } from '@/lib/speichern'
import { objektSpeicher } from '@/lib/speicher'
import { heuteBerlin } from '@/lib/zeit'

function zeilen(d: FormData, name: string): string[] {
  return (text(d, name) ?? '')
    .split('\n')
    .map((z) => z.trim())
    .filter(Boolean)
}

/**
 * Erstellt ein Standardschreiben als PDF und legt es als Dokument „Bescheinigung“ am
 * Mietverhältnis ab: mit Prüfsumme, unveränderlich, im Verlauf nachvollziehbar.
 */
export async function schreibenErstellen(_: FormStatus, d: FormData): Promise<FormStatus> {
  let id: string
  try {
    await verlange({ stammdaten: ['schreiben'] })
    const mietverhaeltnisId = pflicht(d, 'mietverhaeltnisId', 'Mietverhältnis')
    const art = pflicht(d, 'art', 'Art')
    const vermieter = parteiAusText(pflicht(d, 'vermieter', 'Vermieter'))
    if (vermieter.anschrift.length === 0)
      throw new Eingabefehler('Bitte unter dem Namen die Anschrift des Vermieters angeben.')
    const ort = text(d, 'ort')
    const ausgestellt = datum(d, 'ausgestellt', 'Datum') ?? heuteBerlin()

    id = await mitMandant(async (tx, k) => {
      const s = await schreibDaten(tx, mietverhaeltnisId)
      if (!s) throw new Eingabefehler('Mietverhältnis nicht gefunden.')
      if (s.wohnung.anschrift.length === 0)
        throw new Eingabefehler(
          'Am Objekt fehlt die Anschrift. Bitte zuerst in den Stammdaten ergänzen.',
        )
      const gemeinsam = { vermieter, ort, ausgestellt }
      let brief: Brief
      let titel: string
      if (art === 'wohnungsgeber') {
        const vorgang = text(d, 'vorgang') === 'auszug' ? 'auszug' : 'einzug'
        const am = datum(d, 'datum', 'Datum des Ein- oder Auszugs')
        if (!am) throw new Eingabefehler('Datum des Ein- oder Auszugs fehlt.')
        const personen = zeilen(d, 'personen')
        if (personen.length === 0)
          throw new Eingabefehler('Bitte die meldepflichtigen Personen angeben.')
        const eigentuemer = text(d, 'eigentuemer')
        brief = wohnungsgeberbestaetigung({
          ...gemeinsam,
          eigentuemer: eigentuemer ? { name: eigentuemer, anschrift: [] } : null,
          vorgang,
          datum: am,
          wohnung: s.wohnung,
          personen,
        })
        titel = `Wohnungsgeberbestätigung ${vorgang === 'einzug' ? 'Einzug' : 'Auszug'} ${datumAnzeige(am)}`
      } else if (art === 'mietschuldenfreiheit') {
        if (!haken(d, 'geprueft'))
          throw new Eingabefehler('Bitte bestätigen, dass du die Zahlungen geprüft hast.')
        const stichtag = datum(d, 'stichtag', 'Stichtag') ?? ausgestellt
        brief = mietschuldenfreiheit({
          ...gemeinsam,
          mieter: s.mieter,
          wohnung: s.wohnung,
          mietbeginn: s.mv.beginn,
          mietende: s.mv.ende ?? null,
          stichtag,
          mitBetriebskosten: haken(d, 'mitBetriebskosten'),
        })
        titel = `Mietschuldenfreiheitsbescheinigung ${datumAnzeige(stichtag)}`
      } else if (art === 'vermieterbescheinigung') {
        if (!s.kondition)
          throw new Eingabefehler(
            'Ohne Miete und Vorauszahlungen gibt es keine Vermieterbescheinigung.',
          )
        brief = vermieterbescheinigung({
          ...gemeinsam,
          mieter: s.mieter,
          wohnung: s.wohnung,
          mietbeginn: s.mv.beginn,
          wohnflaeche: s.wohnflaeche,
          zimmer: s.zimmer,
          personenzahl: s.kondition.personenzahl,
          stichtag: ausgestellt,
          kaltmieteCent: s.kondition.kaltmieteCent,
          vorauszahlungBkCent: s.kondition.vorauszahlungBkCent,
          vorauszahlungHkCent: s.kondition.vorauszahlungHkCent,
          zweck: text(d, 'zweck'),
        })
        titel = `Vermieterbescheinigung ${datumAnzeige(ausgestellt)}`
      } else {
        throw new Eingabefehler('Unbekanntes Schreiben.')
      }
      const pdf = Buffer.from(await briefPdf(brief))
      const abgelegt = await objektSpeicher().ablegen(
        k.mandantId,
        'dokument',
        pdf,
        'application/pdf',
      )
      const r = await speichere(tx, k, {
        entitaet: 'dokument',
        identitaet: {
          mietverhaeltnisId,
          dateiHash: abgelegt.sha256,
          speicherSchluessel: abgelegt.schluessel,
          dateiname: `${titel.replace(/[^\p{L}\p{N} ._-]/gu, '').replace(/ +/g, '_')}.pdf`,
          mime: 'application/pdf',
          groesseBytes: abgelegt.groesse,
        },
        daten: { typ: 'bescheinigung', status: 'gueltig', titel, dokumentdatum: ausgestellt },
        gueltigAb: heuteBerlin(),
      })
      return r.identId
    })
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  redirect(`/dokumente/${id}`)
}
