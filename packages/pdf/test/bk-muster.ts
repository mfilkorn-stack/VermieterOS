import type { BkBriefDaten } from '../src'

/** Musterdaten (Beträge aus dem Sollwert 2024, Namen erfunden) */
export const BK_MUSTER: BkBriefDaten = {
  vermieter: { name: 'Erika Mustermann', anschrift: ['Musterweg 1', '99999 Musterstadt'] },
  ort: 'Musterstadt',
  ausgestellt: '2025-11-11',
  empfaenger: { name: 'Max Beispiel', anschrift: ['Beispielstraße 7', '99999 Musterstadt'] },
  anrede: 'Sehr geehrter Herr Beispiel,',
  wohnung: { anschrift: ['Beispielstraße 7', '99999 Musterstadt'], lage: 'EG rechts' },
  jahr: 2024,
  zeitraum: { von: '2024-01-01', bis: '2024-12-31' },
  nutzung: { von: '2024-01-01', bis: '2024-12-31', monate: 12 },
  zeilen: [
    {
      bezeichnung: 'Heiz- und Wasserkosten laut Messdienst',
      schluessel: 'direkt',
      gesamtCent: 1_121_592,
      anteilCent: 145_510,
    },
    {
      bezeichnung: 'abzüglich CO2-Kostenanteil Vermieter (30 %, CO2KostAufG)',
      schluessel: 'direkt',
      gesamtCent: 71_526,
      anteilCent: -3_310,
    },
    { bezeichnung: 'Grundsteuer', schluessel: 'direkt', gesamtCent: 17_714, anteilCent: 17_714 },
    {
      bezeichnung: 'Gebäudeversicherung',
      schluessel: 'Wohnfläche',
      gesamtCent: 213_446,
      anteilCent: 18_975,
    },
  ],
  kostenCent: 178_889,
  vorauszahlungenCent: 226_800,
  saldoCent: -47_911,
  lohnanteil35aCent: 11_224,
  erlaeuterungen: ['Wohnfläche: Ihre Wohnung 59,72 m² von 671,79 m² gesamt.'],
  anpassung: { bisherCent: 18_900, neuCent: 15_000, ab: '2026-01-01', kaltmieteCent: 65_000 },
}
