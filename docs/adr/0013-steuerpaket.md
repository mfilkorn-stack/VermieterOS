# ADR 0013 · Steuerpaket: Einkünfte aus Vermietung je Objekt und Jahr

Status: angenommen · 07.10.2026 · WP 2.6

## Kontext

Der Steuerberater braucht je Objekt und Jahr Einnahmen, Werbungskosten, Belege und die Aufteilung auf die Miteigentümer. Bisher entstand das Paket von Hand aus Kontoauszügen, Mietverträgen und Ordnern. Die Software rechnet keine Steuer und gibt keine Steuerberatung. Sie bereitet die Anlage V vor und macht jede Zahl nachvollziehbar.

## Entscheidung

**Rechnung im Rechenkern (`anlageV`), Eingaben aus vorhandenen Daten.** Das Steuerpaket speichert nur, was die Daten nicht wissen: Mietausfall, Hausgeld laut WEG-Abrechnung, Zinsen laut Bescheinigung und weitere Werbungskosten. Alles andere kommt bei jedem Aufruf aus Stammdaten, Mietkonditionen, festgeschriebenen BK-Abrechnungen und Journal.

**Einnahmen: Soll gilt als gezahlt.** Kaltmiete und Vorauszahlungen werden laut Mietkonditionen für die Monate des Jahres angesetzt (Monatsregel wie ADR 0011). Ausfälle erfasst der Nutzer als Korrektur. Mieteingänge im Journal zählen daneben nicht; der Kern weist darauf hin. Grund: Bis zum Bank-Abgleich (Modul 07) ist das Soll vollständiger als einzeln gebuchte Eingänge. Salden der BK-Abrechnungen zählen im Jahr des ersten Versands an das Mietverhältnis, ohne Versand im Jahr der Festschreibung. Nachzahlungen erhöhen die Einnahmen, Guthaben mindern sie.

**Ausgaben nach Zahlungstag (§ 11 EStG), brutto.** Die Behandlung folgt der Steuerkategorie des Journals:

| Kategorie                         | Behandlung                                                           |
| --------------------------------- | -------------------------------------------------------------------- |
| Erhaltungsaufwand                 | sofort, oder nach § 82b EStDV gleichmäßig auf 2 bis 5 Jahre          |
| Herstellungskosten (nachträglich) | erhöhen die AfA-Bemessungsgrundlage ab dem Zahlungsjahr, volles Jahr |
| Anschaffungskosten                | gehören in die Stammdaten (Kauf), Hinweis                            |
| Schuldzinsen                      | aus dem Journal, ersetzt durch den Betrag der Zinsbescheinigung      |
| Betriebs-, Verwaltungs-, sonstige | sofort                                                               |
| nicht abziehbar                   | ausgeschlossen                                                       |

**AfA aus den Stammdaten.** Gebäudeanteil der Anschaffungskosten (Kaufpreis plus Nebenkosten × Gebäudeanteil), Satz und Beginn am Objekt; im ersten Jahr zeitanteilig nach Monaten. Fehlen die Angaben, gibt es eine Warnung, keine AfA.

**Hausgeld nach BFH.** Abziehbar ist das gezahlte Hausgeld abzüglich der Zuführung zur Erhaltungsrücklage, zuzüglich Entnahmen aus der Rücklage für Erhaltung (BFH IX R 19/24). Die Zahlen stehen in der WEG-Jahresabrechnung und werden als Korrektur eingetragen.

**15-%-Wächter.** Erhaltungsaufwand netto (ohne Umsatzsteuer) aus den ersten drei Jahren nach Anschaffung wird gegen 15 % der Gebäude-Anschaffungskosten gerechnet (§ 6 Abs. 1 Nr. 1a EStG). Ab 80 % warnt der Kern. Über der Grenze meldet er einen Fehler. Festschreiben ist dann nur mit ausdrücklicher Bestätigung möglich, weil Ausnahmen (etwa jährlich übliche Erhaltung) der Steuerberater beurteilt. Die Bestätigung steht im Prüfprotokoll.

**Aufteilung nach Miteigentum.** Einnahmen, Werbungskosten und Ergebnis werden nach den heute gültigen Eigentumsanteilen des Mandanten verteilt, mit der Restverteilung des Rechenkerns, so dass die Summe auf den Cent aufgeht.

**Festschreibung mit Paket.** Festschreiben erzeugt ein ZIP und legt es als Dokument „Steuerpaket“ am Objekt ab. Das ZIP enthält:

- Übersicht als PDF
- Journal des Jahres als CSV (Semikolon, Dezimalkomma, UTF-8 mit BOM für Excel)
- Belege unter `belege/<Belegnummer>_<Dateiname>`
- Prüfprotokoll mit Grundlagen, Befunden und Korrekturen
- `manifest.sha256` im Format von `sha256sum -c`

Die Dateizeiten im ZIP sind fest, gleicher Inhalt ergibt dieselbe Datei. Die Datenbank verlangt für „festgeschrieben“ Überschuss und Paket und sperrt danach neue Versionen. Eine Korrektur storniert die Festschreibung mit Grund, das Paket gilt dann als ersetzt.

**Steuerberater.** Die Rolle liest alle Seiten und lädt das Paket herunter (`export: steuerpaket`), ändert aber nichts. Festschreiben verlangt Schreib- und Exportrecht.

## Nicht entschieden

- Zeilennummern der Anlage V je Formularjahr: Die Übersicht gruppiert nach Sachverhalt. Die Zuordnung zu Zeilen bleibt beim Steuerberater, bis ein Formularjahr stabil abgebildet werden kann.
- Eigentümerwechsel im Jahr: Die Aufteilung nimmt die heutigen Anteile.
- Ist-Mieten aus dem Bank-Abgleich ersetzen das Soll erst mit Modul 07.
