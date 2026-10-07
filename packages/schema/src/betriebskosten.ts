import { z } from 'zod'
import { BetrkvKostenart } from './enums'
import { Cent, CentNichtNegativ, Datum, Notiz, Uuid } from './gemeinsam'

/**
 * Betriebskostenabrechnung einer Einheit für einen Zeitraum (WP 2.4). Die Eingaben sind
 * versioniert; gerechnet wird mit `@vermieteros/rechenkern` (ADR 0011). Mieter, Zeiträume und
 * Vorauszahlungen kommen aus den Mietverhältnissen, nicht aus diesen Daten.
 */

export const BK_STATUS = ['entwurf', 'festgeschrieben'] as const
export const BkStatus = z.enum(BK_STATUS)
export type BkStatus = z.infer<typeof BkStatus>

const Ganz = z.number().int().positive().safe()

export const BkSchluessel = z.discriminatedUnion('art', [
  /** Gesamtfläche in Hundertstel-m² */
  z.object({ art: z.literal('wohnflaeche'), gesamtQm100: Ganz }),
  z.object({ art: z.literal('einheiten'), anzahl: Ganz }),
  z.object({ art: z.literal('mea'), gesamt: Ganz }),
  z.object({
    art: z.literal('personen'),
    gesamtPersonenmonate: z.number().positive().max(100_000),
  }),
  /** Betrag der Einheit steht schon fest (Grundsteuerbescheid) */
  z.object({ art: z.literal('direkt'), einheitCent: Cent }),
])
export type BkSchluessel = z.infer<typeof BkSchluessel>

export const BkPosition = z.object({
  kostenart: BetrkvKostenart,
  bezeichnung: z.string().trim().min(1).max(120),
  gesamtCent: Cent,
  schluessel: BkSchluessel,
})
export type BkPosition = z.infer<typeof BkPosition>

/** Abrechnung des Messdienstes (WP 2.2), Beträge der Einheit */
export const BkMessdienst = z.object({
  gesamtCent: CentNichtNegativ,
  einheitCent: CentNichtNegativ,
  /** Zwischenablesung: Betrag je Mietverhältnis */
  jeNutzung: z.record(Uuid, CentNichtNegativ).nullish(),
  co2: z
    .object({
      kostenCent: CentNichtNegativ,
      kg: z.number().nonnegative().max(10_000_000),
      flaecheQm100: Ganz,
      tage: z.number().int().min(1).max(366),
      heizWwEinheitCent: CentNichtNegativ,
      heizWwGesamtCent: z.number().int().positive().safe(),
      vermieterLautMessdienstCent: CentNichtNegativ.nullish(),
    })
    .nullish(),
  lohnanteil35aCent: CentNichtNegativ.nullish(),
  /** hochgeladene Abrechnung des Messdienstes */
  dokumentId: Uuid.nullish(),
})
export type BkMessdienst = z.infer<typeof BkMessdienst>

/** Ergebnis je Mietverhältnis, beim Festschreiben gespeichert (mit dem ausgestellten PDF) */
export const BkFestschreibung = z.object({
  mietverhaeltnisId: Uuid,
  kostenCent: Cent,
  vorauszahlungenCent: Cent,
  saldoCent: Cent,
  dokumentId: Uuid,
  /** neue monatliche Vorauszahlung, falls angepasst (§ 560 Abs. 4 BGB) */
  vorauszahlungNeuCent: CentNichtNegativ.nullish(),
  vorauszahlungAb: Datum.nullish(),
})
export type BkFestschreibung = z.infer<typeof BkFestschreibung>

export const BkAbrechnungDaten = z
  .object({
    zeitraumVon: Datum,
    zeitraumBis: Datum,
    positionen: z.array(BkPosition).max(80),
    messdienst: BkMessdienst.nullish(),
    /** Ist-Vorauszahlungen je Mietverhältnis, wenn sie vom Soll abweichen */
    vorauszahlungen: z.record(Uuid, CentNichtNegativ).nullish(),
    status: BkStatus.default('entwurf'),
    notizen: Notiz.nullish(),
    /** nur bei Status „festgeschrieben“ */
    ergebnis: z.array(BkFestschreibung).nullish(),
  })
  .refine((d) => d.zeitraumBis >= d.zeitraumVon, {
    path: ['zeitraumBis'],
    message: 'Ende vor Beginn',
  })
export type BkAbrechnungDaten = z.infer<typeof BkAbrechnungDaten>
export const BkAbrechnungIdentitaet = z.object({ einheitId: Uuid, jahr: z.number().int() })
