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
