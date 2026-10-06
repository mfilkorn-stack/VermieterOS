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
  'mietvertrag',
  'nachtrag',
  'uebergabeprotokoll',
  'kautionsnachweis',
  'versicherung',
  'grundbuch',
  'kaufvertrag',
  'kreditvertrag',
  'teilungserklaerung',
  'hausgeldabrechnung',
  'beleg',
  'mietspiegel',
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
