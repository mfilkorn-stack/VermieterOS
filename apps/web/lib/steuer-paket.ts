import 'server-only'
import { ladeDokument, neueVersion, type Tx } from '@vermieteros/db'
import { briefPdf, steuerUebersichtBrief } from '@vermieteros/pdf'
import { sha256 } from '@vermieteros/post'
import type { SteuerpaketDaten } from '@vermieteros/schema'
import { strToU8 } from 'fflate'
import { Eingabefehler } from './eingabe'
import { datumAnzeige, euroAnzeige } from './format'
import { STEUERKATEGORIE_TEXT } from './journal-text'
import type { MandantKontext } from './sitzung'
import { objektSpeicher } from './speicher'
import type { SteuerSeite } from './steuer'
import { baueZip, centCsv, csv, sichererName, type PaketDatei } from './steuer-zip'
import { heuteBerlin } from './zeit'

/**
 * Festschreiben des Steuerpakets (WP 2.6): ZIP mit Übersicht (PDF), Journal (CSV), Belegen,
 * Prüfprotokoll und Prüfsummen als Dokument am Objekt, danach die Version „festgeschrieben“ mit
 * Überschuss und Paket. Befunde der Schwere „fehler“ müssen ausdrücklich bestätigt werden.
 */
export async function steuerFestschreiben(
  tx: Tx,
  k: MandantKontext,
  s: SteuerSeite,
  o: { befundeBestaetigt: boolean },
): Promise<string> {
  if (s.status === 'festgeschrieben')
    throw new Eingabefehler('Das Steuerpaket ist schon festgeschrieben.')
  const fehler = s.ergebnis.befunde.filter((b) => b.schwere === 'fehler')
  if (fehler.length && !o.befundeBestaetigt)
    throw new Eingabefehler(
      'Die Prüfung meldet Fehler. Mit dem Steuerberater klären und das Festschreiben bestätigen.',
    )
  const heute = heuteBerlin()
  const r = s.ergebnis
  const akteur = { art: 'nutzer' as const, id: k.nutzerId }

  const pdf = await briefPdf(
    steuerUebersichtBrief({
      mandant: s.mandant,
      objekt: s.objekt.bezeichnung,
      anschrift: s.objekt.anschrift,
      jahr: s.jahr,
      ausgestellt: heute,
      einnahmen: r.einnahmen,
      einnahmenCent: r.einnahmenCent,
      werbungskosten: r.werbungskosten,
      werbungskostenCent: r.werbungskostenCent,
      ueberschussCent: r.ueberschussCent,
      verteilt: r.verteilt,
      aufteilung: r.aufteilung,
      hinweise: r.befunde.map((b) => b.text),
      grundlagen: s.grundlagen,
    }),
  )

  const dateien: PaketDatei[] = [{ pfad: `uebersicht_${s.jahr}.pdf`, inhalt: pdf }]
  const belegPfad = new Map<string, string>()
  const fehlend: string[] = []
  for (const j of s.journal) {
    if (!j.dokumentId) continue
    const d = await ladeDokument(tx, j.dokumentId)
    if (!d) {
      fehlend.push(j.belegnummer)
      continue
    }
    const inhalt = await objektSpeicher().holen(d.speicherSchluessel)
    if (sha256(inhalt) !== d.dateiHash)
      throw new Error(`Prüfsumme des Belegs ${j.belegnummer} stimmt nicht.`)
    const pfad = `belege/${sichererName(`${j.belegnummer}_${d.dateiname}`)}`
    // Ein Beleg kann mehrere Buchungen tragen; im Paket nur einmal
    if (![...belegPfad.values()].includes(pfad))
      dateien.push({ pfad, inhalt: new Uint8Array(inhalt) })
    belegPfad.set(j.id, pfad)
  }

  dateien.push({
    pfad: `journal_${s.jahr}.csv`,
    inhalt: csv(
      [
        'Belegnummer',
        'Zahlungsdatum',
        'Kategorie',
        'Gegenpartei',
        'Beschreibung',
        'Betrag Objekt (brutto)',
        'darin USt',
        'Verteilung Jahre',
        'Beleg',
      ],
      s.journal.map((j) => [
        j.belegnummer,
        datumAnzeige(j.zahlungsdatum),
        STEUERKATEGORIE_TEXT[j.steuerkategorie as keyof typeof STEUERKATEGORIE_TEXT] ??
          j.steuerkategorie,
        j.gegenpartei,
        j.beschreibung ?? '',
        centCsv(j.betragCent),
        centCsv(j.umsatzsteuerCent),
        j.verteilungJahre ? String(j.verteilungJahre) : '',
        belegPfad.get(j.id) ?? '',
      ]),
    ),
  })

  const ohneBeleg = s.journal.filter((j) => !j.dokumentId).map((j) => j.belegnummer)
  const protokoll = [
    `Steuerpaket ${s.jahr} · ${s.objekt.bezeichnung}`,
    `Erstellt am ${datumAnzeige(heute)} von VermieterOS. Vorbereitung der Anlage V, keine Steuerberatung.`,
    '',
    `Einnahmen         ${euroAnzeige(r.einnahmenCent)}`,
    `Werbungskosten    ${euroAnzeige(r.werbungskostenCent)}`,
    `${r.ueberschussCent >= 0 ? 'Überschuss' : 'Verlust   '}        ${euroAnzeige(r.ueberschussCent)}`,
    '',
    'Grundlagen',
    ...s.grundlagen.map((g) => `- ${g}`),
    '',
    'Prüfung',
    ...(r.befunde.length
      ? r.befunde.map((b) => `- [${b.schwere}] ${b.text}`)
      : ['- keine Befunde']),
    ...(r.anschaffungsnah
      ? [
          `- Anschaffungsnahe Herstellungskosten bis ${datumAnzeige(r.anschaffungsnah.bisDatum)}: ${euroAnzeige(r.anschaffungsnah.nettoCent)} netto von ${euroAnzeige(r.anschaffungsnah.grenzeCent)} (15 %)`,
        ]
      : []),
    `- Buchungen im Jahr: ${s.journal.length}, davon ohne Beleg: ${ohneBeleg.length ? ohneBeleg.join(', ') : 'keine'}`,
    ...(fehlend.length ? [`- Beleg nicht gefunden: ${fehlend.join(', ')}`] : []),
    '',
    'Korrekturen',
    `- Mietausfall: ${euroAnzeige(s.korrekturen.mietausfallCent ?? 0)}`,
    ...(s.korrekturen.hausgeld
      ? [
          `- Hausgeld gezahlt ${euroAnzeige(s.korrekturen.hausgeld.gezahltCent)}, Zuführung Rücklage ${euroAnzeige(s.korrekturen.hausgeld.zufuehrungCent)}, Entnahme ${euroAnzeige(s.korrekturen.hausgeld.entnahmeCent)}`,
        ]
      : []),
    ...(s.korrekturen.schuldzinsenCent != null
      ? [`- Schuldzinsen laut Bescheinigung: ${euroAnzeige(s.korrekturen.schuldzinsenCent)}`]
      : []),
    ...(s.korrekturen.weitere ?? []).map((w) => `- ${w.bezeichnung}: ${euroAnzeige(w.betragCent)}`),
    ...(s.notizen ? ['', 'Notizen', s.notizen] : []),
    '',
    'Vollständigkeit prüfen: sha256sum -c manifest.sha256',
    '',
  ].join('\n')
  dateien.push({ pfad: 'pruefprotokoll.txt', inhalt: strToU8(protokoll) })

  const zip = Buffer.from(baueZip(dateien))
  const abgelegt = await objektSpeicher().ablegen(k.mandantId, 'dokument', zip, 'application/zip')
  const dok = await neueVersion(tx, {
    entitaet: 'dokument',
    mandantId: k.mandantId,
    akteur,
    gueltigAb: heute,
    identitaet: {
      objektId: s.objekt.id,
      dateiHash: abgelegt.sha256,
      speicherSchluessel: abgelegt.schluessel,
      dateiname: sichererName(
        `Steuerpaket_${s.jahr}_${s.objekt.bezeichnung.replace(/\s+/g, '_')}.zip`,
      ),
      mime: 'application/zip',
      groesseBytes: abgelegt.groesse,
    },
    daten: {
      typ: 'steuerpaket',
      status: 'gueltig',
      titel: `Steuerpaket ${s.jahr}`,
      dokumentdatum: heute,
    },
  })

  const daten: SteuerpaketDaten = {
    mietausfallCent: s.korrekturen.mietausfallCent ?? 0,
    hausgeld: s.korrekturen.hausgeld ?? null,
    schuldzinsenCent: s.korrekturen.schuldzinsenCent ?? null,
    weitere: [...(s.korrekturen.weitere ?? [])],
    notizen: s.notizen,
    status: 'festgeschrieben',
    ueberschussCent: r.ueberschussCent,
    paketDokumentId: dok.identId,
  }
  // Ohne Entwurf zuerst einen anlegen: Nach einer Korrektur (Storno) bleibt er stehen.
  const id =
    s.paket?.id ??
    (
      await neueVersion(tx, {
        entitaet: 'steuerpaket',
        mandantId: k.mandantId,
        akteur,
        gueltigAb: heute,
        identitaet: { objektId: s.objekt.id, jahr: s.jahr },
        daten: { ...daten, status: 'entwurf', ueberschussCent: null, paketDokumentId: null },
      })
    ).identId
  await neueVersion(tx, {
    entitaet: 'steuerpaket',
    mandantId: k.mandantId,
    akteur,
    gueltigAb: heute,
    identId: id,
    begruendung: 'Festschreibung',
    daten,
  })
  return dok.identId
}
