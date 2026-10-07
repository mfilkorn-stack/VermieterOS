import 'server-only'
import {
  ladeSteuerpaket,
  letzteVersion,
  schema,
  steuerBkSalden,
  steuerEigentuemer,
  steuerJournal,
  steuerMietzeiten,
  type SteuerJournalZeile,
  type SteuerMietzeitZeile,
  type Steuerpaket,
  type Tx,
} from '@vermieteros/db'
import {
  anlageV,
  anschaffungskosten,
  cent,
  type SteuerEingabe,
  type SteuerErgebnis,
  type SteuerKorrekturen,
} from '@vermieteros/rechenkern'
import { datumAnzeige, euroAnzeige, prozentText } from './format'

/**
 * Steuerpaket in der Web-App (WP 2.6): Daten eines Objekts für ein Jahr zusammentragen und mit
 * `anlageV` rechnen. Grundlage sind Stammdaten, Mietkonditionen, festgeschriebene
 * BK-Abrechnungen, Journal und die Korrekturen des Steuerpakets (ADR 0013).
 */

export type SteuerSeite = {
  objekt: { id: string; bezeichnung: string; anschrift: string[]; weg: boolean }
  mandant: string
  jahr: number
  paket: Steuerpaket | null
  status: 'offen' | 'entwurf' | 'festgeschrieben'
  korrekturen: SteuerKorrekturen
  notizen: string | null
  /** Journal des Jahres (Anteil des Objekts) */
  journal: SteuerJournalZeile[]
  mietzeiten: SteuerMietzeitZeile[]
  ergebnis: SteuerErgebnis
  grundlagen: string[]
}

export async function ladeSteuerSeite(
  tx: Tx,
  objektId: string,
  jahr: number,
): Promise<SteuerSeite | null> {
  const o = await letzteVersion(tx, 'objekt', objektId)
  if (!o) return null
  const [m] = await tx.select({ name: schema.mandanten.name }).from(schema.mandanten)
  const paket = await ladeSteuerpaket(tx, objektId, jahr)
  const v = paket?.version
  const korrekturen: SteuerKorrekturen = {
    mietausfallCent: v?.mietausfallCent ?? 0,
    hausgeld: v?.hausgeld ?? null,
    schuldzinsenCent: v?.schuldzinsenCent ?? null,
    weitere: v?.weitere ?? [],
  }

  const ak =
    o.kaufpreisCent != null && o.gebaeudeanteilPromille != null
      ? anschaffungskosten(
          cent(o.kaufpreisCent),
          o.anschaffungsnebenkosten ?? [],
          o.gebaeudeanteilPromille,
        )
      : null
  const afaBeginn = o.afaBeginn ?? o.anschaffungsdatum
  const afa =
    ak && o.afaSatzPromille != null && afaBeginn
      ? { gebaeudeCent: ak.gebaeude, satzPromille: o.afaSatzPromille, beginn: afaBeginn }
      : null

  const journal = await steuerJournal(tx, objektId, jahr)
  const mietzeiten = await steuerMietzeiten(tx, objektId)
  const eingabe: SteuerEingabe = {
    jahr,
    mietzeiten,
    bkSalden: await steuerBkSalden(tx, objektId),
    journal,
    afa,
    anschaffungsdatum: o.anschaffungsdatum ?? null,
    korrekturen,
    eigentuemer: await steuerEigentuemer(tx),
  }
  const ergebnis = anlageV(eingabe)

  const grundlagen = [
    'Mieten und Vorauszahlungen laut Mietkonditionen als gezahlt (Soll), Ausfälle als Korrektur.',
    'Ausgaben nach Zahlungstag (§ 11 EStG), Beträge brutto mit Umsatzsteuer.',
    afa
      ? [
          'AfA aus Gebäude-Anschaffungskosten ',
          euroAnzeige(afa.gebaeudeCent),
          ', Satz ',
          prozentText(afa.satzPromille) + ' %',
          ', Beginn ',
          datumAnzeige(afa.beginn),
          '.',
        ].join('')
      : 'AfA nicht berechnet: Kaufpreis, Gebäudeanteil oder AfA-Satz fehlen in den Stammdaten.',
    korrekturen.hausgeld
      ? 'Hausgeld nach BFH: gezahlt abzüglich Zuführung zur Erhaltungsrücklage, zuzüglich Entnahmen.'
      : '',
    korrekturen.schuldzinsenCent != null
      ? 'Schuldzinsen laut Zinsbescheinigung (ersetzt die Buchungen im Journal).'
      : '',
  ].filter(Boolean)

  return {
    objekt: {
      id: objektId,
      bezeichnung: o.bezeichnung,
      anschrift: [
        [o.strasse, o.hausnummer].filter(Boolean).join(' '),
        [o.plz, o.ort].filter(Boolean).join(' '),
      ].filter(Boolean),
      weg: o.weg ?? false,
    },
    mandant: m?.name ?? '',
    jahr,
    paket,
    status: v ? v.status : 'offen',
    korrekturen,
    notizen: v?.notizen ?? null,
    journal: journal.filter((j) => j.zahlungsdatum.startsWith(String(jahr))),
    mietzeiten,
    ergebnis,
    grundlagen,
  }
}

/** Jahre, für die ein Steuerpaket angeboten wird: Vorjahr und das Jahr davor. */
export function steuerJahre(heute: string): number[] {
  const j = Number(heute.slice(0, 4))
  return [j - 1, j - 2]
}

/** Zeilen für weitere Werbungskosten im Formular */
export const WEITERE_ZEILEN = 5

export const STATUS_TEXT = {
  offen: 'nicht angelegt',
  entwurf: 'Entwurf',
  festgeschrieben: 'festgeschrieben',
} as const
