import 'server-only'
import { fachdaten, letzteVersion, neueVersion, type Tx } from '@vermieteros/db'
import { betriebskostenabrechnungBrief, briefPdf, type BkBriefDaten } from '@vermieteros/pdf'
import type { BkFestschreibung } from '@vermieteros/schema'
import { sql } from 'drizzle-orm'
import { SCHLUESSEL_TEXT, type BkSeite } from './bk'
import { Eingabefehler } from './eingabe'
import { dezimalText, euroAnzeige } from './format'
import { schreibDaten } from './schreiben'
import type { MandantKontext } from './sitzung'
import { objektSpeicher } from './speicher'
import { heuteBerlin } from './zeit'

/**
 * Festschreiben einer Betriebskostenabrechnung (WP 2.4): je Mietverhältnis ein PDF (Anschreiben
 * und Abrechnung) als Dokument am Mietverhältnis, optional neue Vorauszahlung als Konditions-
 * version, danach die Version „festgeschrieben“ mit dem Ergebnis. Alles in einer Transaktion.
 */

/** Vorschlag für die neue Vorauszahlung: Kosten je Monat, auf volle Euro aufgerundet. */
export function vorschlagVorauszahlung(kostenCent: number, monate: number): number {
  if (monate <= 0) return 0
  return Math.ceil(kostenCent / monate / 100) * 100
}

/** Die Anpassung wirkt ab dem Monat nach Zugang des Schreibens (§ 560 Abs. 4 BGB). */
export function anpassungAbVorschlag(briefdatum: string): string {
  const [j, m] = briefdatum.split('-').map(Number) as [number, number]
  return m === 12 ? `${j + 1}-01-01` : `${j}-${String(m + 1).padStart(2, '0')}-01`
}

function anrede(
  personen: Array<{ anrede?: string | null; nachname: string; firma?: string | null }>,
) {
  const teile = personen
    .filter((p) => !p.firma && (p.anrede === 'Frau' || p.anrede === 'Herr'))
    .map((p) => (p.anrede === 'Frau' ? `Frau ${p.nachname}` : `Herr ${p.nachname}`))
  if (teile.length === 0 || teile.length !== personen.length)
    return 'Sehr geehrte Damen und Herren,'
  return (
    teile
      .map(
        (t, i) =>
          (i === 0 ? 'Sehr geehrte' : 'sehr geehrte') + (t.startsWith('Herr') ? 'r ' : ' ') + t,
      )
      .join(', ') + ','
  )
}

function erlaeuterungen(s: BkSeite & object, monate: number, gesamtMonate: number): string[] {
  const out: string[] = []
  const fl = s.wohnflaecheQm100 ?? 0
  const gesehen = new Set<string>()
  for (const p of s.daten.positionen) {
    const k = p.schluessel
    const schl = JSON.stringify(k.art === 'direkt' ? { art: 'direkt' } : k)
    if (gesehen.has(schl)) continue
    gesehen.add(schl)
    if (k.art === 'wohnflaeche')
      out.push(
        `Wohnfläche: Ihre Wohnung ${dezimalText(fl, 2)} m² von ${dezimalText(k.gesamtQm100, 2)} m² gesamt.`,
      )
    else if (k.art === 'einheiten') out.push(`Einheiten: 1 von ${k.anzahl} Einheiten.`)
    else if (k.art === 'mea')
      out.push(`Miteigentumsanteile: Anteil der Wohnung von ${k.gesamt} gesamt.`)
    else if (k.art === 'personen')
      out.push(
        `Personenmonate: Personen × Monate Ihres Haushalts von ${k.gesamtPersonenmonate} gesamt.`,
      )
  }
  if (s.daten.positionen.some((p) => p.schluessel.art === 'direkt') || s.daten.messdienst)
    out.push(
      'direkt: Betrag für Ihre Wohnung laut Grundsteuerbescheid bzw. Abrechnung des Messdienstes (Verbrauch nach Heizkostenverordnung).',
    )
  const co2 = s.ergebnis?.messdienst?.co2
  if (co2) {
    out.push(
      `CO2-Kosten nach CO2KostAufG: ${dezimalText(Math.round(co2.kgProQmJahr * 10), 1)} kg CO2 je m² und Jahr, Anteil Vermieter ${co2.vermieterProzent} %. Auf Ihre Wohnung entfallen ${euroAnzeige(co2.einheitCent)}, davon trägt der Vermieter ${euroAnzeige(co2.vermieterCent)}; dieser Betrag ist abgezogen.`,
    )
  }
  if (monate < gesamtMonate)
    out.push(
      `Zeitanteil: Kosten anteilig für ${dezimalText(Math.round(monate * 100), 2)} von ${gesamtMonate} Monaten.`,
    )
  return out
}

export async function festschreiben(
  tx: Tx,
  k: MandantKontext,
  s: BkSeite & object,
  eingabe: { briefdatum: string; anpassungen: Record<string, { neuCent: number; ab: string }> },
): Promise<BkFestschreibung[]> {
  if (!s.ergebnis || s.fehler.length)
    throw new Eingabefehler('Die Abrechnung lässt sich nicht rechnen.')
  const akteur = { art: 'nutzer' as const, id: k.nutzerId }
  const ergebnis: BkFestschreibung[] = []
  for (const m of s.ergebnis.abrechnung.mieter) {
    const sd = await schreibDaten(tx, m.id)
    if (!sd) throw new Eingabefehler('Mietverhältnis nicht gefunden.')
    const personen = []
    for (const pid of sd.mv.mieterIds) {
      const p = await letzteVersion(tx, 'person', pid)
      if (p) personen.push(p)
    }
    const ausgezogen = sd.mv.ende != null && sd.mv.ende < eingabe.briefdatum
    const neueAnschrift = personen.find((p) => p.strasse && p.ort)
    const empfaengerAnschrift =
      ausgezogen && neueAnschrift
        ? [
            [neueAnschrift.strasse, neueAnschrift.hausnummer].filter(Boolean).join(' '),
            [neueAnschrift.plz, neueAnschrift.ort].filter(Boolean).join(' '),
          ]
        : sd.wohnung.anschrift

    // Anpassung der Vorauszahlung: neue Version der Kondition ab dem gewählten Datum
    const anp = eingabe.anpassungen[m.id]
    let anpassung: BkBriefDaten['anpassung'] = null
    if (anp) {
      const [kid] = await tx.execute<{ id: string }>(
        sql`SELECT id FROM mietkonditionen WHERE mietverhaeltnis_id = ${m.id} ORDER BY erstellt_am LIMIT 1`,
      )
      const alt = kid ? await letzteVersion(tx, 'mietkondition', kid.id) : null
      if (!kid || !alt) throw new Eingabefehler('Für die Anpassung fehlt die Mietkondition.')
      const bisher = alt.vorauszahlungBkCent + alt.vorauszahlungHkCent
      const hk = Math.min(alt.vorauszahlungHkCent, anp.neuCent)
      await neueVersion(tx, {
        entitaet: 'mietkondition',
        mandantId: k.mandantId,
        akteur,
        gueltigAb: anp.ab,
        identId: kid.id,
        begruendung: `Anpassung der Vorauszahlung nach Betriebskostenabrechnung ${s.jahr}`,
        daten: {
          ...fachdaten('mietkondition', alt as unknown as Record<string, unknown>),
          vorauszahlungBkCent: anp.neuCent - hk,
          vorauszahlungHkCent: hk,
          grund: 'anpassung_vorauszahlung',
        },
      })
      anpassung = {
        bisherCent: bisher,
        neuCent: anp.neuCent,
        ab: anp.ab,
        kaltmieteCent: alt.kaltmieteCent,
      }
    }

    const brief = betriebskostenabrechnungBrief({
      vermieter: sd.vermieter,
      ort: sd.ort,
      ausgestellt: eingabe.briefdatum,
      empfaenger: { name: sd.mieter.join(' und '), anschrift: empfaengerAnschrift },
      anrede: anrede(personen),
      wohnung: sd.wohnung,
      jahr: s.jahr,
      zeitraum: { von: s.daten.zeitraumVon, bis: s.daten.zeitraumBis },
      nutzung: { von: m.zeitraum.von, bis: m.zeitraum.bis, monate: m.monate },
      zeilen: m.zeilen.map((z) => ({
        bezeichnung: z.bezeichnung,
        schluessel: SCHLUESSEL_TEXT[z.schluessel],
        gesamtCent: z.gesamtCent,
        anteilCent: z.anteilCent,
      })),
      kostenCent: m.kostenCent,
      vorauszahlungenCent: m.vorauszahlungenCent,
      saldoCent: m.saldoCent,
      lohnanteil35aCent: m.lohnanteil35aCent,
      erlaeuterungen: erlaeuterungen(s, m.monate, 12),
      anpassung,
    })
    const pdf = await briefPdf(brief)
    const abgelegt = await objektSpeicher().ablegen(
      k.mandantId,
      'dokument',
      Buffer.from(pdf),
      'application/pdf',
    )
    const titel = `Betriebskostenabrechnung ${s.jahr}`
    const dok = await neueVersion(tx, {
      entitaet: 'dokument',
      mandantId: k.mandantId,
      akteur,
      gueltigAb: eingabe.briefdatum,
      identitaet: {
        objektId: s.objektId,
        mietverhaeltnisId: m.id,
        dateiHash: abgelegt.sha256,
        speicherSchluessel: abgelegt.schluessel,
        dateiname: `Betriebskostenabrechnung_${s.jahr}_${sd.mieter.join('_').replace(/[^\p{L}\p{N}_-]/gu, '')}.pdf`,
        mime: 'application/pdf',
        groesseBytes: abgelegt.groesse,
      },
      daten: {
        typ: 'betriebskostenabrechnung',
        status: 'gueltig',
        titel,
        dokumentdatum: eingabe.briefdatum,
      },
    })
    ergebnis.push({
      mietverhaeltnisId: m.id,
      kostenCent: m.kostenCent,
      vorauszahlungenCent: m.vorauszahlungenCent,
      saldoCent: m.saldoCent,
      dokumentId: dok.identId,
      vorauszahlungNeuCent: anp?.neuCent ?? null,
      vorauszahlungAb: anp?.ab ?? null,
    })
  }
  await neueVersion(tx, {
    entitaet: 'bk_abrechnung',
    mandantId: k.mandantId,
    akteur,
    // Versionen der Abrechnung tragen das Erfassungsdatum; die jüngste gilt.
    gueltigAb: heuteBerlin(),
    identId: s.id,
    begruendung: 'Festschreibung',
    daten: { ...s.daten, status: 'festgeschrieben', ergebnis },
  })
  return ergebnis
}
