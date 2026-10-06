import { z } from 'zod'
import {
  DokumentStatus,
  DokumentTyp,
  EinheitTyp,
  KautionArt,
  KonditionGrund,
  Mietart,
  ObjektArt,
  PersonRolle,
  ZaehlerArt,
  ZaehlerstandQuelle,
} from './enums'
import {
  Basispunkte,
  Cent,
  CentNichtNegativ,
  Datum,
  Email,
  Notiz,
  Plz,
  Promille,
  Text,
  Uuid,
} from './gemeinsam'

/*
 * Fachdaten einer Version, ohne Systemspalten (id, mandantId, versionNr, gueltigAb, …).
 * Ein Schema pro Entität; dieselbe Definition validiert Formular, Import und KI-Vorschlag.
 * Felder, die in der Datenbank NULL sein dürfen, sind hier `.nullish()`.
 */

export const ObjektDaten = z.object({
  bezeichnung: Text,
  strasse: Text.nullish(),
  hausnummer: z.string().trim().max(20).nullish(),
  plz: Plz.nullish(),
  ort: Text.nullish(),
  art: ObjektArt,
  baujahr: z.number().int().min(1500).max(2100).nullish(),
  weg: z.boolean().default(false),
  anschaffungsdatum: Datum.nullish(),
  kaufpreisCent: CentNichtNegativ.nullish(),
  anschaffungsnebenkostenCent: CentNichtNegativ.nullish(),
  gebaeudeanteilPromille: Promille.nullish(),
  afaSatzPromille: Promille.nullish(),
  afaBeginn: Datum.nullish(),
})
export type ObjektDaten = z.infer<typeof ObjektDaten>

export const EinheitDaten = z.object({
  bezeichnung: Text,
  lage: Text.nullish(),
  typ: EinheitTyp.default('wohnung'),
  /** Hundertstel-m² */
  wohnflaecheQm100: z.number().int().positive().nullish(),
  /** Zehntel Zimmer */
  zimmerX10: z.number().int().positive().nullish(),
  miteigentumsanteilZaehler: z.number().int().positive().nullish(),
  miteigentumsanteilNenner: z.number().int().positive().nullish(),
})
export type EinheitDaten = z.infer<typeof EinheitDaten>
export const EinheitIdentitaet = z.object({ objektId: Uuid })

export const PersonDaten = z.object({
  rolle: PersonRolle,
  anrede: z.string().trim().max(50).nullish(),
  vorname: Text.nullish(),
  nachname: Text,
  firma: Text.nullish(),
  strasse: Text.nullish(),
  hausnummer: z.string().trim().max(20).nullish(),
  plz: Plz.nullish(),
  ort: Text.nullish(),
  land: z.string().trim().length(2).default('DE'),
  email: Email.nullish(),
  telefon: z.string().trim().max(50).nullish(),
  geburtsdatum: Datum.nullish(),
  notizen: Notiz.nullish(),
})
export type PersonDaten = z.infer<typeof PersonDaten>

export const MietverhaeltnisDaten = z
  .object({
    beginn: Datum,
    ende: Datum.nullish(),
    kuendigungsfristMonate: z.number().int().min(0).max(24).default(3),
    kautionCent: CentNichtNegativ.nullish(),
    kautionArt: KautionArt.default('keine'),
    mieterIds: z.array(Uuid).min(1),
    notizen: Notiz.nullish(),
  })
  .refine((m) => !m.ende || m.ende >= m.beginn, {
    path: ['ende'],
    message: 'Ende liegt vor Beginn',
  })
export type MietverhaeltnisDaten = z.infer<typeof MietverhaeltnisDaten>
export const MietverhaeltnisIdentitaet = z.object({ einheitId: Uuid })

export const Staffelstufe = z.object({ ab: Datum, kaltmieteCent: CentNichtNegativ })
export type Staffelstufe = z.infer<typeof Staffelstufe>

/**
 * Versionierte Sollmiete, Vorauszahlungen und Belegung eines Mietverhältnisses.
 * Jede Mieterhöhung und jede Anpassung der Vorauszahlung ist eine neue Version mit `gueltigAb`.
 */
export const MietkonditionDaten = z
  .object({
    kaltmieteCent: CentNichtNegativ,
    vorauszahlungBkCent: CentNichtNegativ.default(0),
    vorauszahlungHkCent: CentNichtNegativ.default(0),
    mietart: Mietart.default('vergleich'),
    staffel: z.array(Staffelstufe).nullish(),
    /** Personen im Haushalt, für den Verteilerschlüssel „Personen“ */
    personenzahl: z.number().int().min(0).max(50).default(1),
    grund: KonditionGrund.default('vertrag'),
  })
  .refine((k) => k.mietart !== 'staffel' || (k.staffel && k.staffel.length > 0), {
    path: ['staffel'],
    message: 'Staffelmiete braucht mindestens eine Stufe',
  })
export type MietkonditionDaten = z.infer<typeof MietkonditionDaten>
export const MietkonditionIdentitaet = z.object({ mietverhaeltnisId: Uuid })

export const ZaehlerDaten = z.object({
  art: ZaehlerArt,
  nummer: Text,
  /** kWh, m³, MWh, Einheiten */
  masseinheit: z.string().trim().min(1).max(20),
  eichungBis: Datum.nullish(),
  eingebautAm: Datum.nullish(),
  ausgebautAm: Datum.nullish(),
  bemerkung: Notiz.nullish(),
})
export type ZaehlerDaten = z.infer<typeof ZaehlerDaten>
export const ZaehlerIdentitaet = z.object({ objektId: Uuid, einheitId: Uuid.nullish() })

/** Ein Zählerstand ist ein Ereignis, keine Version: append-only, Storno statt Korrektur. */
export const ZaehlerstandDaten = z.object({
  zaehlerId: Uuid,
  /** Stand in Tausendsteln der Maßeinheit (12.345,678 → 12345678) */
  standX1000: z.number().int().nonnegative().safe(),
  abgelesenAm: Datum,
  quelle: ZaehlerstandQuelle,
  bemerkung: Notiz.nullish(),
})
export type ZaehlerstandDaten = z.infer<typeof ZaehlerstandDaten>

export const DarlehenDaten = z.object({
  bank: Text,
  kennzeichen: Text.nullish(),
  nominalCent: CentNichtNegativ,
  auszahlungAm: Datum.nullish(),
  zinsBp: Basispunkte,
  tilgungBp: Basispunkte.nullish(),
  rateCent: CentNichtNegativ,
  zinsbindungBis: Datum.nullish(),
  sondertilgungCentPa: CentNichtNegativ.nullish(),
  restschuldCent: CentNichtNegativ.nullish(),
  restschuldStand: Datum.nullish(),
  bemerkung: Notiz.nullish(),
})
export type DarlehenDaten = z.infer<typeof DarlehenDaten>
export const DarlehenIdentitaet = z.object({ objektId: Uuid })

/** Die Datei selbst ist Teil der Identität (unveränderlich, Prüfsumme). Versioniert wird der Status. */
export const DokumentIdentitaet = z
  .object({
    objektId: Uuid.nullish(),
    mietverhaeltnisId: Uuid.nullish(),
    dateiHash: z.string().regex(/^[0-9a-f]{64}$/, 'SHA-256 hex'),
    speicherSchluessel: z.string().min(1).max(500),
    dateiname: z.string().min(1).max(255),
    mime: z.string().min(1).max(100),
    groesseBytes: z.number().int().nonnegative(),
  })
  .refine((d) => d.objektId || d.mietverhaeltnisId, {
    message: 'Dokument hängt am Objekt oder am Mietverhältnis',
  })
export type DokumentIdentitaet = z.infer<typeof DokumentIdentitaet>

export const DokumentDaten = z.object({
  typ: DokumentTyp,
  status: DokumentStatus.default('gueltig'),
  titel: Text,
  dokumentdatum: Datum.nullish(),
  gueltigBis: Datum.nullish(),
  ersetztDurch: Uuid.nullish(),
  seiten: z.number().int().positive().nullish(),
  notizen: Notiz.nullish(),
})
export type DokumentDaten = z.infer<typeof DokumentDaten>

export { Cent }

/** Eigentumsanteil einer Person am Mandanten, als Bruch (1/2, 1/3, 5000/10000). */
export const EigentumsanteilDaten = z
  .object({
    zaehler: z.number().int().nonnegative(),
    nenner: z.number().int().positive(),
  })
  .refine((a) => a.zaehler <= a.nenner, { message: 'Anteil größer als 1' })
export type EigentumsanteilDaten = z.infer<typeof EigentumsanteilDaten>
export const EigentumsanteilIdentitaet = z.object({ personId: Uuid })
