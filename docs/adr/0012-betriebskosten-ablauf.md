# ADR 0012 · Betriebskostenabrechnung: Entwurf, Festschreibung, Versand

Status: angenommen · 07.10.2026 · WP 2.4, ergänzt ADR 0011

## Entscheidung

**Eine Abrechnung je Einheit und Jahr, als versionierte Entität `bk_abrechnung`.** Die Eingaben stehen in den Versionen:

- Zeitraum
- Kostenpositionen mit Schlüssel und Bezugsgröße
- Abrechnung des Messdienstes mit den CO2-Angaben
- abweichende Ist-Vorauszahlungen
- Notizen

Mieter, Nutzungszeiträume und Soll-Vorauszahlungen werden nicht gespeichert. Sie kommen beim Rechnen aus den Mietverhältnissen und Konditionen. Jedes Speichern ist eine neue Version, die jüngste gilt.

**Positionen aus dem Vorjahr, Beträge leer.** Eine neue Abrechnung übernimmt Bezeichnungen, Kostenarten, Schlüssel und Bezugsgrößen aus dem Vorjahr. Jeder Betrag wird neu eingetragen, die Prüfung meldet Nullbeträge. Das verhindert, dass ein Vorjahreswert unbemerkt stehen bleibt.

**Prüfung nach Regeln statt KI.** PLAN 2.4 sah eine Plausibilitätsprüfung per KI vor. Stattdessen prüft der Rechenkern nach festen Regeln:

| Regel              | Was geprüft wird                                             |
| ------------------ | ------------------------------------------------------------ |
| Frist              | § 556 Abs. 3 BGB: Warnung 60 Tage vorher, Fehler nach Ablauf |
| Grundsteuer        | fehlt sie?                                                   |
| Heizkosten         | fehlen sie?                                                  |
| Nullbeträge        | Position mit Betrag 0                                        |
| Vorjahresvergleich | Sprünge über 25 % und mindestens 50 €                        |
| Positionen         | gegenüber dem Vorjahr weggefallene Positionen                |
| Gesamtfläche       | gegenüber dem Vorjahr geändert                               |

Diese Regeln sind nachvollziehbar, kosten nichts und finden die Fehler, die in echten Abrechnungen vorkamen.

**Festschreibung.** Beim Festschreiben passiert je Mietverhältnis Folgendes:

- Ein PDF mit Anschreiben und Abrechnung im Layout der bisherigen Vorlage wird erzeugt.
- Es wird als Dokument der Art `betriebskostenabrechnung` am Mietverhältnis abgelegt und ist damit im Mieterportal sichtbar.
- Die Erläuterung der Schlüssel und der CO2-Aufteilung steht im PDF.
- Optional wird die Vorauszahlung angepasst (§ 560 Abs. 4 BGB). Das ergibt eine neue Version der Mietkondition ab dem gewählten Monat. Vorschlag ist die Summe der Kosten je Monat, auf volle Euro aufgerundet.

Die Version „festgeschrieben“ speichert das Ergebnis je Mietverhältnis mit dem Verweis auf das PDF. Danach lehnt die Datenbank weitere Versionen ab.

**Korrektur durch Storno.** Die festgeschriebene Version wird mit Grund storniert. Die ausgestellten PDFs bekommen den Status „ersetzt“, und der letzte Entwurf gilt wieder. Eine angepasste Vorauszahlung bleibt bestehen, weil sie dem Mieter schon mitgeteilt sein kann.

**Versand als Ereignis im Ledger.** Der Versand wird als Ereignis `bk_versand` festgehalten, entweder per Mail mit PDF-Anhang an die hinterlegten Adressen oder als Vermerk „per Post“ mit Datum und Notiz. Die festgeschriebene Version bleibt dabei unverändert. Der Nachweis des Zugangs steht unveränderlich in der Hash-Kette.

## Begründung

Die festgeschriebene Abrechnung ist die Grundlage einer Forderung. Deshalb darf sie sich nicht still ändern, und jede Korrektur muss mit Grund nachvollziehbar sein. Das PDF mit Prüfsumme belegt, was der Mieter bekommen hat. Das Versandereignis belegt, wann.

## Konsequenzen

- Mail als Versandweg setzt die Zustimmung des Mieters voraus. Bei Nachzahlungen ist ein Zugangsnachweis per Einwurf-Einschreiben oder Bote sicherer. Die Oberfläche weist darauf hin.
- Journalbelege werden noch nicht automatisch als Kosten übernommen. Bei Eigentumswohnungen kommen die Kosten aus der WEG-Abrechnung. Für ganze Häuser kommt die Übernahme aus dem Journal, sobald ein solches Objekt abgerechnet wird.
