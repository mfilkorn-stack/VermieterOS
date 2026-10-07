export const RECHENKERN_VERSION = '0.0.1'

export {
  type Cent,
  cent,
  parseEuro,
  parseDezimal,
  formatEuro,
  rundeKaufmaennisch,
  anteil,
  summe,
  verteile,
  tageInklusive,
  tageImJahr,
} from './geld'

export {
  MODULE,
  pruefeDatenqualitaet,
  summeBrueche,
  type Modul,
  type Schwere,
  type Ampel,
  type Befund,
  type Datenqualitaet,
  type ObjektStand,
  type EinheitStand,
  type MietverhaeltnisStand,
  type EigentumStand,
  type ReferenzStand,
} from './datenqualitaet'

export {
  istAnschaffungskosten,
  anschaffungskosten,
  afaSatzVorschlag,
  afaJahresbetrag,
  afaImJahr,
  anteiligeGrundstuecksflaeche,
  fristen,
  grenzeAnschaffungsnaheHk,
  type Anschaffungskosten,
  type AfaVorschlag,
  type Fristen,
} from './anschaffung'

export {
  referenzwert,
  grunderwerbsteuer,
  type ReferenzEintrag,
  type ReferenzStatus,
  type ReferenzErgebnis,
} from './referenz'

export {
  betriebskostenabrechnung,
  monate,
  vorauszahlungSoll,
  type Abrechnung,
  type Einheit,
  type Einzelabrechnung,
  type Hinweis,
  type Kostenposition,
  type Nutzung,
  type Verteilerschluessel,
  type Zeile,
  type Zeitraum,
} from './nebenkosten'

export {
  co2Aufteilung,
  co2Vermieterprozent,
  messdienstUebernehmen,
  type Co2Aufteilung,
  type Messdienstabrechnung,
  type Messdienstuebernahme,
} from './heizkosten'
