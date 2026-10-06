export const RECHENKERN_VERSION = '0.0.1'

export {
  type Cent,
  cent,
  parseEuro,
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
} from './datenqualitaet'
