import type { BelegFeld } from '@vermieteros/ki'
import type { Behandlung, BetrkvKostenart, Steuerkategorie } from '@vermieteros/schema'

export const STEUERKATEGORIE_TEXT: Record<Steuerkategorie, string> = {
  mieteinnahmen: 'Mieteinnahmen',
  umlagen: 'Umlagen (Vorauszahlungen, Nachzahlungen)',
  sonstige_einnahmen: 'Sonstige Einnahmen',
  erhaltungsaufwand: 'Erhaltungsaufwand',
  betriebskosten: 'Laufende Betriebskosten',
  verwaltungskosten: 'Verwaltungskosten',
  schuldzinsen: 'Schuldzinsen',
  geldbeschaffungskosten: 'Geldbeschaffungskosten',
  sonstige_werbungskosten: 'Sonstige Werbungskosten',
  herstellungskosten: 'Herstellungskosten (über AfA)',
  anschaffungskosten: 'Anschaffungskosten (über AfA)',
  nicht_abziehbar: 'Nicht abziehbar (privat)',
}

/** § 2 BetrKV mit Nummer, damit die Zuordnung prüfbar bleibt. */
export const KOSTENART_TEXT: Record<BetrkvKostenart, string> = {
  grundsteuer: '1 Grundsteuer',
  wasserversorgung: '2 Wasserversorgung',
  entwaesserung: '3 Entwässerung',
  heizung: '4 Heizung',
  warmwasser: '5 Warmwasser',
  verbundene_anlagen: '6 Verbundene Heiz- und Warmwasseranlagen',
  aufzug: '7 Aufzug',
  strassenreinigung_muell: '8 Straßenreinigung und Müllbeseitigung',
  gebaeudereinigung: '9 Gebäudereinigung und Ungezieferbekämpfung',
  gartenpflege: '10 Gartenpflege',
  beleuchtung: '11 Beleuchtung',
  schornsteinreinigung: '12 Schornsteinreinigung',
  versicherung: '13 Sach- und Haftpflichtversicherung',
  hauswart: '14 Hauswart',
  antenne_kabel: '15 Antenne, Breitbandnetz',
  waeschepflege: '16 Wäschepflege',
  sonstige_betriebskosten: '17 Sonstige Betriebskosten',
}

export const BEHANDLUNG_TEXT: Record<Behandlung, string> = {
  einnahme: 'Einnahme',
  sofort: 'sofort abziehbar',
  verteilt: 'verteilt',
  afa: 'über die AfA',
  privat: 'privat, nicht abziehbar',
}

export const BELEG_FELD_TEXT: Record<BelegFeld, string> = {
  lieferant: 'Lieferant',
  rechnungsnummer: 'Rechnungsnummer',
  rechnungsdatum: 'Rechnungsdatum',
  betrag_brutto: 'Betrag (brutto)',
  umsatzsteuer: 'Umsatzsteuer',
  leistung_von: 'Leistung von',
  leistung_bis: 'Leistung bis',
  zahlungsdatum: 'Zahlungsdatum',
}
