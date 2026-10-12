import { z } from 'zod'

export const HERKUNFT_QUELLEN = [
  'manuell',
  'dokument',
  'bank_csv',
  'kalkulation',
  'ki_vorschlag',
] as const
export const HerkunftQuelle = z.enum(HERKUNFT_QUELLEN)
export type HerkunftQuelle = z.infer<typeof HerkunftQuelle>

export const EIGENTUEMERSCHAFT_ARTEN = ['allein', 'ehepaar', 'bruchteil', 'gbr'] as const
export const EigentuemerschaftArt = z.enum(EIGENTUEMERSCHAFT_ARTEN)
export type EigentuemerschaftArt = z.infer<typeof EigentuemerschaftArt>

export const OBJEKT_ARTEN = ['haus', 'etw'] as const
export const ObjektArt = z.enum(OBJEKT_ARTEN)
export type ObjektArt = z.infer<typeof ObjektArt>

export const EINHEIT_TYPEN = ['wohnung', 'gewerbe', 'stellplatz', 'sonstiges'] as const
export const EinheitTyp = z.enum(EINHEIT_TYPEN)
export type EinheitTyp = z.infer<typeof EinheitTyp>

export const PERSON_ROLLEN = ['mieter', 'miteigentuemer', 'kontakt'] as const
export const PersonRolle = z.enum(PERSON_ROLLEN)
export type PersonRolle = z.infer<typeof PersonRolle>

export const KAUTION_ARTEN = ['keine', 'bar', 'buergschaft', 'sparbuch', 'versicherung'] as const
export const KautionArt = z.enum(KAUTION_ARTEN)
export type KautionArt = z.infer<typeof KautionArt>

export const MIETARTEN = ['vergleich', 'index', 'staffel'] as const
export const Mietart = z.enum(MIETARTEN)
export type Mietart = z.infer<typeof Mietart>

/** Warum eine neue Mietkondition gilt. Bestimmt später Sperrfristen und Kappung. */
export const KONDITION_GRUENDE = [
  'vertrag',
  'erhoehung_558',
  'index_557b',
  'staffel_557a',
  'modernisierung_559',
  'vereinbarung',
  'anpassung_vorauszahlung',
] as const
export const KonditionGrund = z.enum(KONDITION_GRUENDE)
export type KonditionGrund = z.infer<typeof KonditionGrund>

export const ZAEHLER_ARTEN = [
  'strom',
  'gas',
  'wasser_kalt',
  'wasser_warm',
  'waerme',
  'heizkostenverteiler',
  'sonstiges',
] as const
export const ZaehlerArt = z.enum(ZAEHLER_ARTEN)
export type ZaehlerArt = z.infer<typeof ZaehlerArt>

export const ZAEHLERSTAND_QUELLEN = [
  'manuell',
  'foto',
  'mieter',
  'schaetzung',
  'versorger',
] as const
export const ZaehlerstandQuelle = z.enum(ZAEHLERSTAND_QUELLEN)
export type ZaehlerstandQuelle = z.infer<typeof ZaehlerstandQuelle>

export const DOKUMENT_TYPEN = [
  // Mietverhältnis
  'mietvertrag',
  'nachtrag',
  'uebergabeprotokoll',
  'kautionsnachweis',
  'wohnungsgeberbestaetigung',
  // Kauf
  'expose',
  'reservierung',
  'kaufvertrag',
  'notarschreiben',
  'vollmacht',
  'grunderwerbsteuerbescheid',
  // Grundstück und Gebäude
  'grundbuch',
  'grundbuchmitteilung',
  'flurkarte',
  'bodenrichtwert',
  'grundriss',
  'energieausweis',
  'objektfoto',
  // Finanzierung
  'kreditvertrag',
  'grundschuldbestellung',
  'finanzierung',
  'zinsbescheinigung',
  // WEG und Haus
  'teilungserklaerung',
  'verwaltervertrag',
  'wirtschaftsplan',
  'hausgeldabrechnung',
  'weg_protokoll',
  'hausordnung',
  'heizkostenabrechnung',
  'betriebskostenabrechnung',
  'steuerpaket',
  // Laufend
  'grundsteuer',
  'versicherung',
  'beleg',
  'mietspiegel',
  'bescheinigung',
  'mangelfoto',
  'sonstiges',
] as const
export const DokumentTyp = z.enum(DOKUMENT_TYPEN)
export type DokumentTyp = z.infer<typeof DokumentTyp>

export const DOKUMENT_STATUS = ['gueltig', 'ersetzt', 'abgelaufen'] as const
export const DokumentStatus = z.enum(DOKUMENT_STATUS)
export type DokumentStatus = z.infer<typeof DokumentStatus>

/**
 * Arten von Kauf-Nebenkosten. Ob eine Art zu den Anschaffungskosten zählt oder als
 * Finanzierungskosten sofort abziehbar ist, entscheidet der Rechenkern, nicht das Formular.
 */
export const NEBENKOSTEN_ARTEN = [
  'grunderwerbsteuer',
  'notar_kaufvertrag',
  'grundbuch_eigentum',
  'makler',
  'gutachten',
  'sonstige_anschaffung',
  'notar_grundschuld',
  'grundbuch_grundschuld',
  'sonstige_finanzierung',
] as const
export const NebenkostenArt = z.enum(NEBENKOSTEN_ARTEN)
export type NebenkostenArt = z.infer<typeof NebenkostenArt>

export const GRUNDBUCH_ARTEN = ['grundbuch', 'wohnungsgrundbuch', 'teileigentumsgrundbuch'] as const
export const GrundbuchArt = z.enum(GRUNDBUCH_ARTEN)
export type GrundbuchArt = z.infer<typeof GrundbuchArt>

/** Länderkürzel nach ISO 3166-2:DE ohne Präfix. */
export const BUNDESLAENDER = [
  'BW',
  'BY',
  'BE',
  'BB',
  'HB',
  'HH',
  'HE',
  'MV',
  'NI',
  'NW',
  'RP',
  'SL',
  'SN',
  'ST',
  'SH',
  'TH',
] as const
export const Bundesland = z.enum(BUNDESLAENDER)
export type Bundesland = z.infer<typeof Bundesland>

export const BUNDESLAND_NAME: Record<Bundesland, string> = {
  BW: 'Baden-Württemberg',
  BY: 'Bayern',
  BE: 'Berlin',
  BB: 'Brandenburg',
  HB: 'Bremen',
  HH: 'Hamburg',
  HE: 'Hessen',
  MV: 'Mecklenburg-Vorpommern',
  NI: 'Niedersachsen',
  NW: 'Nordrhein-Westfalen',
  RP: 'Rheinland-Pfalz',
  SL: 'Saarland',
  SN: 'Sachsen',
  ST: 'Sachsen-Anhalt',
  SH: 'Schleswig-Holstein',
  TH: 'Thüringen',
}

/** Arten von Referenzdaten. Weitere (Mietspiegel, VPI, Bodenrichtwerte) kommen mit ihren Modulen. */
export const REFERENZ_ARTEN = ['grunderwerbsteuer'] as const
export const ReferenzArt = z.enum(REFERENZ_ARTEN)
export type ReferenzArt = z.infer<typeof ReferenzArt>

/**
 * Wie eine eingegangene Nachricht einem Mietverhältnis zugeordnet wurde (WP 1.1).
 * `aufgehoben`: manuelle Zuordnung zurückgenommen, Nachricht ist wieder offen.
 */
export const ZUORDNUNG_ARTEN = [
  'verlauf',
  'absender',
  'absender_betreff',
  'manuell',
  'aufgehoben',
  /** bewusst ohne Ziel abgeschlossen (Werbung, erledigt am Telefon) */
  'erledigt',
] as const
export type ZuordnungArt = (typeof ZUORDNUNG_ARTEN)[number]

/** Telefonnotiz (WP 1.2): Wer hat angerufen? */
export const GESPRAECH_RICHTUNGEN = ['eingehend', 'ausgehend'] as const
export type GespraechRichtung = (typeof GESPRAECH_RICHTUNGEN)[number]

/** Gewerke im Handwerkerverzeichnis (WP 1.6). */
export const GEWERKE = [
  'heizung_sanitaer',
  'elektro',
  'schluesseldienst',
  'dach_fassade',
  'fenster_tueren',
  'maler_boden',
  'garten',
  'reinigung',
  'hausmeister',
  'sonstiges',
] as const
export const Gewerk = z.enum(GEWERKE)
export type Gewerk = z.infer<typeof Gewerk>

/** Zeilen der Notfallkarte eines Objekts. */
export const NOTFALL_ARTEN = [
  'heizung',
  'wasser',
  'strom',
  'gas',
  'schluessel',
  'hausverwaltung',
  'sonstiges',
] as const
export const NotfallArt = z.enum(NOTFALL_ARTEN)
export type NotfallArt = z.infer<typeof NotfallArt>

export const WISSEN_KATEGORIEN = ['hausordnung', 'anleitung', 'muell', 'faq', 'sonstiges'] as const
export const WissenKategorie = z.enum(WISSEN_KATEGORIEN)
export type WissenKategorie = z.infer<typeof WissenKategorie>

/** Ticket-Ablauf: Meldung → beauftragt → Termin → erledigt → abgeschlossen (Rechnung da). */
export const TICKET_STATUS = [
  'gemeldet',
  'beauftragt',
  'termin',
  'erledigt',
  'abgeschlossen',
  'verworfen',
] as const
export const TicketStatus = z.enum(TICKET_STATUS)
export type TicketStatus = z.infer<typeof TicketStatus>

export const PRIORITAETEN = ['notfall', 'hoch', 'normal', 'niedrig'] as const
export const Prioritaet = z.enum(PRIORITAETEN)
export type Prioritaet = z.infer<typeof Prioritaet>

/** Zweck eines Postfachs (WP 1.8): Post an den Vermieter oder eigene Adresse für Belege. */
export const POSTFACH_ZWECKE = ['post', 'belege'] as const
export const PostfachZweck = z.enum(POSTFACH_ZWECKE)
export type PostfachZweck = z.infer<typeof PostfachZweck>

/** Journal (WP 1.8): Richtung einer Buchung. */
export const JOURNAL_RICHTUNGEN = ['ausgabe', 'einnahme'] as const
export const JournalRichtung = z.enum(JOURNAL_RICHTUNGEN)
export type JournalRichtung = z.infer<typeof JournalRichtung>

/**
 * Steuerkategorien, angelehnt an die Anlage V. Bewusst ohne Zeilennummern: die ändern sich mit
 * jedem Formularjahr; die Zuordnung Kategorie → Zeile gehört zum Steuerpaket (WP 2.6).
 */
export const STEUERKATEGORIEN_EINNAHME = ['mieteinnahmen', 'umlagen', 'sonstige_einnahmen'] as const
export const STEUERKATEGORIEN_AUSGABE = [
  'erhaltungsaufwand',
  'betriebskosten',
  'verwaltungskosten',
  'schuldzinsen',
  'geldbeschaffungskosten',
  'sonstige_werbungskosten',
  'herstellungskosten',
  'anschaffungskosten',
  'nicht_abziehbar',
] as const
export const STEUERKATEGORIEN = [...STEUERKATEGORIEN_EINNAHME, ...STEUERKATEGORIEN_AUSGABE] as const
export const Steuerkategorie = z.enum(STEUERKATEGORIEN)
export type Steuerkategorie = z.infer<typeof Steuerkategorie>

/** Kostenarten nach § 2 BetrKV, Nr. 1 bis 17. */
export const BETRKV_KOSTENARTEN = [
  'grundsteuer',
  'wasserversorgung',
  'entwaesserung',
  'heizung',
  'warmwasser',
  'verbundene_anlagen',
  'aufzug',
  'strassenreinigung_muell',
  'gebaeudereinigung',
  'gartenpflege',
  'beleuchtung',
  'schornsteinreinigung',
  'versicherung',
  'hauswart',
  'antenne_kabel',
  'waeschepflege',
  'sonstige_betriebskosten',
] as const
export const BetrkvKostenart = z.enum(BETRKV_KOSTENARTEN)
export type BetrkvKostenart = z.infer<typeof BetrkvKostenart>
