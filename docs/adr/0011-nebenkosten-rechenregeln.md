# ADR 0011 · Betriebskosten: Monate, eine Rundung je Zeile, Leerstand als Rest

Status: angenommen · 07.10.2026 · WP 2.1, ändert PLAN 2.1 („tagesgenaue Zeitanteile“)

## Entscheidung

**Zeitanteil nach Monaten.** Bei unterjährigem Mieterwechsel zählt jeder volle Kalendermonat 1, ein angebrochener Monat seinen Tagesanteil (16.–31. Januar = 16/31). Bei Wechsel zum Monatsersten, dem Normalfall, ergeben sich volle Monate wie in den bisherigen Abrechnungen der Vermieter.

**Eine Rundung je Zeile.** Der Mieteranteil einer Kostenart ist Gesamtkosten × Schlüsselanteil × Zeitanteil, einmal kaufmännisch auf den Cent gerundet. Die Summe ist die Summe der angezeigten Zeilen.

**Leerstand als Rest.** Je Kostenart ist der Anteil des Vermieters der Jahresanteil der Einheit minus die Mieteranteile. So geht die Rechnung je Einheit auf den Cent auf; Rundungsreste von wenigen Cent bleiben beim Vermieter. Beim Personenschlüssel gibt es keinen Leerstand, die Gesamt-Personenmonate verteilen ihn schon.

**Vorauszahlungen nur für den Abrechnungszeitraum des Mieters**, berechnet aus den Monatsbeträgen der Konditionen (`vorauszahlungSoll`).

**Schlüssel:** Wohnfläche (§ 556a Abs. 1 BGB), Einheiten, Miteigentumsanteile (nur wenn vereinbart), Personenmonate, direkt (Grundsteuerbescheid, Messdienst). Bei Eigentumswohnungen kommen Gesamtkosten und Gesamtfläche aus der Hausgeldabrechnung der WEG, nicht aus dem Journal.

## Begründung

Sollwert ist eine echte Abrechnung 2022 (Eigentumswohnung, Mieter ab Februar). Ihre Kostenzeilen rechnet der Kern auf höchstens einen Cent genau nach. Die Unterschiede liegen alle an Stellen, an denen das Original Mieter angreifbar macht:

- Das Original rundet zweimal (erst Jahresanteil, dann 11/12) und summiert ungerundete Werte. Dadurch weicht die Summe um 2 Cent von den Zeilen ab.
- Das Original rechnet Vorauszahlungen für zwölf Monate an, obwohl die Kosten nur auf elf Monate verteilt sind. Die Nachzahlung war dadurch um 146 € zu niedrig.

Monate statt Tage, weil Miete monatlich gezahlt wird und Mieter das ohne Kalender nachrechnen können.

## Konsequenzen

Heizkosten bei Nutzerwechsel nur nach Monaten zu teilen genügt der HeizKV nicht (§ 9b: Zwischenablesung, sonst Gradtagzahlen). Der Kern rechnet dennoch und gibt einen Hinweis aus; die richtige Aufteilung liefert der Messdienst, sie kommt als Betrag mit Schlüssel „direkt“ je Mietverhältnis (WP 2.2).
