import { z } from 'zod'
import {
  Bundesland,
  DokumentStatus,
  DokumentTyp,
  EinheitTyp,
  Gewerk,
  GrundbuchArt,
  NebenkostenArt,
  KautionArt,
  KonditionGrund,
  Mietart,
  NotfallArt,
  Prioritaet,
  ObjektArt,
  PersonRolle,
  TicketStatus,
  WissenKategorie,
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
  Telefon,
  Text,
  Uuid,
} from './gemeinsam'

/*
 * Fachdaten einer Version, ohne Systemspalten (id, mandantId, versionNr, gueltigAb, …).
 * Ein Schema pro Entität; dieselbe Definition validiert Formular, Import und KI-Vorschlag.
 * Felder, die in der Datenbank NULL sein dürfen, sind hier `.nullish()`.
 */

export const Bruch = z
  .object({ zaehler: z.number().int().nonnegative(), nenner: z.number().int().positive() })
  .refine((b) => b.zaehler <= b.nenner, { message: 'Anteil größer als 1' })
export type Bruch = z.infer<typeof Bruch>

export const Flurstueck = z.object({
  /** Gemarkung und Flurstücksnummer, z. B. „Gemarkung X, Flst. 123/4“ */
  nummer: Text,
  bezeichnung: Text.nullish(),
  flaecheQm: z.number().int().positive(),
})
export type Flurstueck = z.infer<typeof Flurstueck>

/**
 * Ein Grundbuchblatt des Objekts. Eine Eigentumswohnung mit separat gekauftem Stellplatz
 * hat zwei: Wohnungsgrundbuch mit Miteigentumsanteil, Grundbuch des Stellplatzes ohne.
 */
export const GrundbuchEintrag = z.object({
  art: GrundbuchArt,
  amtsgericht: Text,
  blatt: z.string().trim().min(1).max(50),
  /** Miteigentumsanteil an den Flurstücken; fehlt bei Alleineigentum am Flurstück. */
  miteigentumsanteil: Bruch.nullish(),
  flurstuecke: z.array(Flurstueck).min(1),
})
export type GrundbuchEintrag = z.infer<typeof GrundbuchEintrag>

export const NebenkostenPosition = z.object({
  art: NebenkostenArt,
  bezeichnung: Text.nullish(),
  betragCent: CentNichtNegativ,
  bezahltAm: Datum.nullish(),
})
export type NebenkostenPosition = z.infer<typeof NebenkostenPosition>

export const ObjektDaten = z.object({
  bezeichnung: Text,
  strasse: Text.nullish(),
  hausnummer: z.string().trim().max(20).nullish(),
  plz: Plz.nullish(),
  ort: Text.nullish(),
  bundesland: Bundesland.nullish(),
  art: ObjektArt,
  baujahr: z.number().int().min(1500).max(2100).nullish(),
  weg: z.boolean().default(false),
  grundbuch: z.array(GrundbuchEintrag).nullish(),
  /** Tag der Beurkundung; maßgeblich für die Spekulationsfrist (§ 23 EStG). */
  kaufvertragDatum: Datum.nullish(),
  /** Übergang von Nutzen und Lasten; maßgeblich für AfA und 15-%-Grenze. */
  anschaffungsdatum: Datum.nullish(),
  kaufpreisCent: CentNichtNegativ.nullish(),
  anschaffungsnebenkosten: z.array(NebenkostenPosition).nullish(),
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
export const EigentumsanteilDaten = Bruch
export type EigentumsanteilDaten = z.infer<typeof EigentumsanteilDaten>
export const EigentumsanteilIdentitaet = z.object({ personId: Uuid })

/** Wert eines Grunderwerbsteuer-Eintrags: Satz in Promille (3,5 % = 35). */
export const GrunderwerbsteuerWert = z.object({ satzPromille: z.number().int().min(0).max(100) })
export type GrunderwerbsteuerWert = z.infer<typeof GrunderwerbsteuerWert>

// ---------------------------------------------------------------------------
// Handwerker, Notfallkarte, Wissensbasis, Tickets (WP 1.6)
// ---------------------------------------------------------------------------

export const HandwerkerDaten = z.object({
  firma: Text,
  ansprechpartner: Text.nullish(),
  gewerke: z.array(Gewerk).min(1, 'Mindestens ein Gewerk'),
  telefon: Telefon.nullish(),
  notdienstTelefon: Telefon.nullish(),
  email: Email.nullish(),
  /** Erreichbar außerhalb der Geschäftszeiten */
  notdienst: z.boolean().default(false),
  /** Für welche Objekte; leer = alle */
  objektIds: z.array(Uuid).default([]),
  /** Eigene Bewertung 1 (schlecht) bis 5 (sehr gut) */
  bewertung: z.number().int().min(1).max(5).nullish(),
  notizen: Notiz.nullish(),
})
export type HandwerkerDaten = z.infer<typeof HandwerkerDaten>

/** Eine Zeile der Notfallkarte: ein Handwerker aus dem Verzeichnis oder ein freier Kontakt. */
export const NotfallEintrag = z
  .object({
    art: NotfallArt,
    handwerkerId: Uuid.nullish(),
    name: Text.nullish(),
    telefon: Telefon.nullish(),
    hinweis: Notiz.nullish(),
  })
  .refine((e) => e.handwerkerId || (e.name && e.telefon), {
    message: 'Handwerker wählen oder Name und Telefon angeben',
  })
export type NotfallEintrag = z.infer<typeof NotfallEintrag>

export const NotfallkarteDaten = z.object({ eintraege: z.array(NotfallEintrag) })
export type NotfallkarteDaten = z.infer<typeof NotfallkarteDaten>
export const NotfallkarteIdentitaet = z.object({ objektId: Uuid })

export const WissensartikelDaten = z.object({
  titel: Text,
  kategorie: WissenKategorie,
  inhalt: z.string().trim().min(1).max(20_000),
  /** Im Mieterportal sichtbar (WP 1.10) */
  mieterSichtbar: z.boolean().default(true),
})
export type WissensartikelDaten = z.infer<typeof WissensartikelDaten>
export const WissensartikelIdentitaet = z.object({ objektId: Uuid })

export const TicketDaten = z.object({
  titel: Text,
  beschreibung: Notiz.nullish(),
  status: TicketStatus.default('gemeldet'),
  prioritaet: Prioritaet.default('normal'),
  /** Beauftragter Handwerker */
  auftragnehmerId: Uuid.nullish(),
  /** Vereinbarter Termin (Zeitpunkt, ISO) */
  termin: z.iso.datetime({ offset: true }).nullish(),
  notizen: Notiz.nullish(),
})
export type TicketDaten = z.infer<typeof TicketDaten>
export const TicketIdentitaet = z.object({
  objektId: Uuid,
  einheitId: Uuid.nullish(),
  mietverhaeltnisId: Uuid.nullish(),
  /** Mail, aus der das Ticket entstanden ist */
  nachrichtId: Uuid.nullish(),
})
