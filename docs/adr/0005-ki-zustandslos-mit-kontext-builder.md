# ADR 0005 · KI ist zustandslos und liest nur über den Kontext-Builder

Status: angenommen · 06.10.2026

## Kontext

Kapitel 6 des Architekturplans: Die KI darf nie mit veralteten Daten arbeiten. Acht Regeln, die im Code verankert sein müssen.

## Entscheidung

Alle KI-Aufrufe laufen über `packages/ki`. Ein Kontext-Builder liest ausschließlich aus `*_aktuell`-Sichten und Dokumenten mit Status `gueltig` und erzeugt einen Versionsstempel (Ledger-Sequenz, Dokument-Prüfsummen, Prompt-Version, Modell). Jede Ausgabe wird als Vorschlag mit Stempel und Ablaufdatum gespeichert. Vor Übernahme oder Versand wird der Stempel gegen den aktuellen Ledger-Stand geprüft. Fakten (Beträge, Daten, Namen, Telefonnummern) stehen im Entwurf als Platzhalter und werden vom Renderer aus dem Ledger gefüllt. Prompts sind versioniert und laufen vor jeder Änderung gegen ein Golden-Set echter Beispiele.

## Konsequenzen

Kein KI-Chatverlauf als Faktenquelle, kein eigener Speicher. Jeder Aufruf kostet den vollen Kontext; Prompt-Caching für den stabilen Teil (Hausinfos, Vorlagen) hält die Kosten im Rahmen. Wer die KI direkt aus `apps/` aufruft, verletzt die Architektur; ein Test in `packages/ki` (`architektur.test.ts`) verbietet den Import des SDK außerhalb des Pakets. Das Repository hat kein ESLint, der Test ersetzt die ursprünglich geplante Lint-Regel.

**Umsetzung (WP 1.4):** Vorschläge und Entscheidungen sind zwei append-only Tabellen; der Status ergibt sich aus der Entscheidung oder dem Ablauf (Sicht `ki_vorschlaege_aktuell`). Ein überholter Stempel wird beim Prüfen als Entscheidung `veraltet` festgehalten. Bestätigen darf nur ein Mensch (Check-Constraint). Der Modellaufruf läuft außerhalb jeder Datenbanktransaktion; Kontext und Stempel werden in einer Transaktion gelesen, der Vorschlag in einer zweiten geschrieben. Das Modell sieht nur den Platzhalter-Katalog, nie die Werte.
