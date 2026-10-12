# UX-Plan: Schritte und Verknüpfungen

Stand: Oktober 2026, nach Merge von PR #34. Grundlage ist eine Durchsicht aller Seiten in `apps/web` auf logische Wege, Rückwege, Begriffe und Formulare. Die Befunde sind mit Datei und Zeile belegt; Zeilennummern beziehen sich auf den Stand von `main` zu diesem Datum.

Die App ist funktional weit, die Wege dazwischen sind an einigen Stellen aber noch die der jeweiligen Arbeitspakete: Jede Funktion hat ihren Einstieg, die Querverbindungen fehlen. Vier Punkte wiegen am schwersten: Es gibt keine Liste der Mieter und Mietverhältnisse; die Fristzähler für Betriebskosten und Jahresabschluss sind auf dem Handy unsichtbar; Nachrichten aus dem Mieterportal lassen sich in der App nicht beantworten; wer nur Leserecht hat, findet von der Objektakte aus nicht zum Mietverhältnis.

## Leitlinien

Diese Regeln gelten für alle Pakete unten und für neue Seiten. Sie beheben die Mehrzahl der kleinen Befunde ohne eigene Aufgabe.

**Begriffe.** „Mietverhältnis“ für den Vertrag, „Mieter“ für die Personen. Der Knopf an der Einheit heißt „Mietverhältnis“, die Seite „Mietverhältnis · {Mieter}“. „Vermietung“ und „Verlauf und Dokumente“ entfallen als Bezeichnungen. Menü und Seiten verwenden dieselben Wörter: „Belege“, nicht „Belegeingang“. Kein Technikjargon in der Oberfläche (SMTP_HOST, ANTHROPIC_API_KEY, Worker, SHA-256 nur in Detailansichten).

**Brotkrumen.** Jede Unterseite trägt `Objekte / {Objektname} / … / {aktuelle Seite}`; das letzte Glied ist Text, kein Link, und nie die Objektart. Formulare haben neben dem Absenden-Knopf einen Abbrechen-Link.

**Links nach Leserecht.** Ein Link erscheint, wenn die Zielseite lesbar ist. Nur Bearbeiten-Knöpfe hängen an `schreiben`. Heute koppelt die Objektakte alle Einheiten-Knöpfe an `stammdaten:schreiben`, die Mietverhältnis-Seite verlangt aber nur `post:lesen`.

**Formulare.** Pflichtfelder sind markiert (Stern in `Feld` und `Auswahl`). Knopftexte: „{Ding} anlegen“ für Neues, „Änderungen speichern“ für Bestehendes, „Zuordnen“ fürs Zuordnen. Nach einer Aktion mit Redirect gibt es eine kurze Bestätigung („Gespeichert“, „Zugeordnet zu …“). Jeder Leerzustand hat einen Satz und einen Knopf zum nächsten Schritt.

**Hauptaktionen nicht verstecken.** `<details>` nur für Sekundäres (Verwerfen, Aus dem Eingang nehmen, Mietende). Telefonnotiz, Zuordnen und Nachmieter sind keine Sekundäraktionen.

## Pakete

Reihenfolge nach Wirkung pro Aufwand. Jedes Paket ist ein eigener Branch mit E2E-Anpassung. Aufwand grob: S bis ein Tag, M zwei bis drei Tage, L eine Woche.

### UX-1 Mieter finden (M)

Befunde N1, O2, O3, O4, B2, B3.

Neue Seite `/mietverhaeltnisse` mit Suche über Mieter, Einheit, Objekt, Kaltmiete, Mietbeginn und Status (laufend, beendet), im Hauptmenü als „Mieter“ unter „Objekte“. In der Objektakte wird der Mietername je Einheit zum Link auf das Mietverhältnis; der Knopf heißt „Mietverhältnis“ statt „Vermietung“. Die Mietverhältnis-Seite bekommt Reiter oder Sprungmarken für Verlauf, Dokumente, Konditionen und Portal, die Vermietungsseite geht darin auf oder wird von dort verlinkt. Alle Links nach Leserecht; Bearbeiten-Knöpfe nach Schreibrecht. Brotkrumen nach Leitlinie.

Begründung: Der häufigste Alltagsweg (Mieter anrufen, Mail zuordnen, Vertrag nachsehen) braucht heute drei Klicks und Schreibrecht.

### UX-2 Startseite und Zähler (M)

Befunde S1, S2, S3, N3, N5, M1, N7.

Die Startseite wird eine Übersicht „Zu erledigen“: nicht zugeordnete Mails, neue Tickets, offene Belege, fällige Betriebskosten, offene Jahresabschluss-Punkte, auslaufende Zinsbindungen, jeweils als Link mit Zahl. Darunter die Objektliste wie heute, aber die ganze Karte klickbar und die Modul-Ampeln verlinkt. Fristzeilen verlinken auf die Abrechnung. Die „Mehr“-Seite zeigt die Zähler je Eintrag, der „Mehr“-Tab trägt die Summe der Handlungszähler. Tabs je Rolle: Steuerberater bekommt Objekte, Belege, Journal, Steuer, Mehr; Tickets und Posteingang entfallen dort. Menüpunkt „Übersicht“ statt „Objekte“ auf `/`, Objekte als eigener Eintrag.

Begründung: Die Zähler existieren schon in `lib/navigation.ts`, sie sind nur nicht überall sichtbar. Auf dem Handy entgehen einem heute Fristen.

### UX-3 Posteingang aufräumen (M)

Befunde P1, P2, P4, P5, P6, B4, F6, F7 (Posteingang).

Im Nachrichtendetail links Kopfdaten, Text, Dateien; rechts Einschätzung, Zuordnung, Ticket, Antwortentwurf, Antworten. Der mailto-Knopf erscheint nur ohne SMTP; „Übernehmen“ heißt „In Antwort übernehmen“ und springt zum Antwortfeld. „Offen“ wird „Nicht zugeordnet“. Bei „Als Dokument ablegen“ ohne Zuordnung ist „Sonstiges“ vorausgewählt; „Als Beleg auslesen“ ist nur dann der primäre Knopf, wenn die Einschätzung eine Rechnung erkannt hat, sonst stehen beide Wege gleichrangig. Die Brotkrume merkt sich Filter und Suchbegriff. In der Liste wird Zuordnen ohne `<details open>` gezeigt. Ohne Postfach sagt der Leerzustand „Noch kein Postfach verbunden“ mit Knopf.

### UX-4 Portal-Nachrichten beantworten (L)

Befund P7, Po1, Po2, Po3.

Nachrichten aus dem Portal erscheinen im Posteingang wie Mails, mit Zuordnung (steht fest), Einschätzung und Antwort. Die Antwort geht per Mail an die Portal-Adresse und wird im Portal unter „Ihre Nachrichten“ mit der Frage zusammen angezeigt; dort fehlt heute jede Spur gesendeter Nachrichten. Im Portal rückt „Im Notfall“ nach oben, die Mangelseite zeigt die Notfallnummern selbst, die Marke verlinkt auf `/portal`, „Ihre Wohnung“ richtet sich nach dem Einheitstyp.

Begründung: Das Portal lädt zur Kommunikation ein, die App kann sie aber nur lesen. Das ist der größte funktionale Bruch im Audit; deshalb L und als eigenes Paket.

### UX-5 Beleg und Dokument trennen (S)

Befunde D1, D2, D3, D4, B5.

Die Art „Beleg“ verschwindet aus „Dokument hochladen“, dort steht ein Verweis auf „Belege hochladen“. In der Dokumentliste der Objektakte verlinken Belege auf `/belege/{id}` oder stehen als eigener Block „Belege zum Objekt“. Im Journal wird die Büroklammer zum Link auf den Beleg. Nach „Bestätigen und buchen“ aus einem Ticket geht es zurück zum Ticket; sonst erscheint „Gebucht als {Nummer}, nächster offener Beleg“. „Zuletzt gebucht“ bekommt den Link „Alle im Journal“, aussortierte Belege einen Reiter.

### UX-6 Geführter Start (M)

Befunde On1, On2, On3, O6, O8, F7 (übrige).

Nach dem ersten Objekt zeigt die Akte eine Karte „Nächste Schritte“: Einheit anlegen, Mietverhältnis erfassen, Postfach verbinden, Notfallkarte anlegen, Mieter ins Portal einladen; erledigte Schritte sind abgehakt. Nach einer neuen Einheit führt der Weg direkt zum Mietverhältnis („Jetzt Mieter erfassen oder später“). Ein laufendes Mietverhältnis klappt „Neues Mietverhältnis“ zu („Nachmieter anlegen“). Nach dem Anlegen einer Eigentümerschaft führt der Leerzustand zu Eigentümern und erstem Objekt. Alle Leerzustände nach Leitlinie, insbesondere Tickets, Handwerker, Postfächer, Betriebskosten.

### UX-7 Formulare und Objektakte (S)

Befunde F1, F2, F3, F4, F5, B1, O1, O5, O7, O9, T2, T3, T4, T5.

Pflichtfeld-Stern in `Feld` und `Auswahl`; Knopftexte vereinheitlichen; Flash-Bestätigung nach Redirect; Brotkrumen auf allen Unterseiten; „Objekt anlegen“ auf `Feld` umstellen. Objektakte in der Reihenfolge Einheiten und Mieter, Tickets, Dokumente, Notfallkarte, Wissen, Kauf und AfA, Stammdaten, Darlehen, Journal. Icon der `Bearbeiten`-Komponente als Prop. Veraltete Texte (Einladung „Phase 1“, Notfallkarte „später“), Technikjargon, Postfach-Status über `<Status>`, „Ändern“ am Postfach ehrlich benennen. Jahr überall über `heuteBerlin()`.

## Zurückgestellt

**„Mandant“ umbenennen (T1).** Der Begriff steht in Datenbank, Code, Doku und Tests. Nur die Oberfläche umzubenennen („Eigentümerschaft“, „Zugänge“) ist möglich, bringt aber eine dauerhafte Diskrepanz zwischen Wort auf dem Bildschirm und Wort im Code. Vorschlag: Oberfläche umbenennen, Code lassen, im Glossar festhalten. Entscheidung offen.

**Zuordnung zu Objekt oder Handwerker (P3).** Mails von Handwerkern, WEG oder Behörden bleiben heute „Nicht zugeordnet“. Eine zweite Zuordnungsart ist eine Modelländerung (Zuordnung, Verlauf, Zähler, KI-Kontext). Sinnvoll, aber erst nach UX-3, wenn klar ist, wie oft das vorkommt. Kurzfristig reicht ein Status „Erledigt ohne Zuordnung“ in UX-3.

**Handwerkerauftrag per App-Mail (P8).** Gleicher Versandweg wie Mieterantworten, protokolliert im Ticket. Klein, aber erst nach UX-4, damit es einen gemeinsamen Mechanismus für ausgehende Nachrichten gibt.

**Dokumentliste über alle Objekte (N2).** Nützlich, aber selten gebraucht, solange UX-1 die Mietverträge über das Mietverhältnis erreichbar macht. Als kleines Paket nach UX-5.

## Empfohlene Reihenfolge

UX-1 und UX-2 zuerst, sie ändern den täglichen Weg am stärksten und bauen aufeinander auf (Mieterliste im Menü, Übersicht als Start). Dann UX-3 und UX-5, beide klein und klar begrenzt. UX-6 und UX-7 lassen sich nebenbei abarbeiten, UX-7 auch als Serie kleiner Commits. UX-4 zuletzt, weil es das größte Stück ist und ein Modell für ausgehende Nachrichten braucht, das mit den Antworten aus PR #36 gerade erst entsteht.

## Befundliste

Kürzel wie im Audit. Schwere: hoch, mittel, niedrig.

| Kürzel | Schwere | Fundstelle                                | Befund                                                            |
| ------ | ------- | ----------------------------------------- | ----------------------------------------------------------------- |
| N1     | hoch    | `lib/navigation.ts:113-124`               | Keine Liste der Mieter oder Mietverhältnisse, kein Menüeintrag    |
| N2     | mittel  | `app/(app)/dokumente/`                    | Keine Gesamtliste der Dokumente                                   |
| N3     | hoch    | `app/(app)/mehr/page.tsx:28-36`           | „Mehr“ ohne Zähler, Fristen auf dem Handy unsichtbar              |
| N5     | mittel  | `lib/navigation.ts:70-74`                 | Start und Objektliste sind dieselbe Seite                         |
| N6     | niedrig | `app/(app)/layout.tsx:43-50`              | Datenschutz und Sicherheit führen aus der App ohne Rückweg        |
| N7     | mittel  | `lib/navigation.ts:126-132`               | Tabs passen nicht zur Rolle Steuerberater                         |
| B1     | mittel  | diverse Unterseiten                       | Keine Brotkrumen auf Formularseiten                               |
| B2     | mittel  | `vermietung/page.tsx:97-99`               | Nur grauer Link statt Brotkrumen                                  |
| B3     | mittel  | diverse                                   | Brotkrumen-Wurzel uneinheitlich, Objektart statt Name             |
| B4     | niedrig | `posteingang/[id]/page.tsx:61-64`         | Filter geht beim Zurück verloren                                  |
| B5     | mittel  | `belege/aktionen.ts:376`                  | Nach Buchen aus Ticket kein Rückweg, keine Bestätigung            |
| B6     | mittel  | `lib/jahresabschluss.ts:30-45`            | „erledigen“ ohne Rückweg, ohne Objektbezug, auch ohne Recht       |
| O1     | mittel  | `objekte/[id]/page.tsx:251-535`           | Abschnittsreihenfolge: Steuer vor Alltag                          |
| O2     | hoch    | `objekte/[id]/page.tsx:377-390`           | Mietername kein Link                                              |
| O3     | hoch    | `objekte/[id]/page.tsx:346-364`           | Links an Schreibrecht gekoppelt, Zielseite nur Leserecht          |
| O4     | mittel  | diverse                                   | Vermietung, Mietverhältnis, Mieter, Verlauf gemischt              |
| O5     | niedrig | `objekte/[id]/page.tsx:87`                | Plus-Icon auf „Journal öffnen“                                    |
| O6     | mittel  | `objekte/[id]/page.tsx:328`               | Leere Einheiten ohne Hinweis                                      |
| O7     | niedrig | `objekte/[id]/page.tsx:532`               | „Sie steht später im Mieterportal“                                |
| O8     | mittel  | `vermietung/page.tsx:242-274`             | Neuanlage immer offen, legt Doppelvermietung nahe                 |
| O9     | niedrig | `objekte/[id]/page.tsx:144`               | Jahr ohne `heuteBerlin()`                                         |
| F1     | mittel  | `components/felder.tsx:10-26`             | Pflichtfelder nicht markiert                                      |
| F2     | mittel  | diverse                                   | Knopftexte uneinheitlich                                          |
| F3     | mittel  | `components/formular.tsx:43-48`           | Keine Erfolgsmeldung nach Redirect                                |
| F4     | niedrig | `objekte/neu/page.tsx:20-60`              | Rohes Formular statt `Feld`                                       |
| F5     | niedrig | `postfaecher/page.tsx:51-79`              | „Ändern“ ändert nur Passwort und Status                           |
| F6     | mittel  | `mietverhaeltnisse/[id]/page.tsx:348`     | Telefonnotiz in `<details>` versteckt                             |
| F7     | niedrig | diverse                                   | Leerzustände ohne nächsten Schritt                                |
| P1     | mittel  | `posteingang/[id]/page.tsx:137-187`       | Mailtext erst an dritter Stelle                                   |
| P2     | mittel  | `components/ki-karten.tsx:205`            | Zwei konkurrierende Hauptknöpfe (mailto, senden)                  |
| P3     | mittel  | `components/zuordnen-formular.tsx:22-31`  | Nur Mietverhältnis zuordenbar                                     |
| P4     | mittel  | `posteingang/page.tsx:55-57`              | „Offen“ heißt nur „nicht zugeordnet“                              |
| P5     | mittel  | `posteingang/[id]/page.tsx:265-270`       | „Kaufvertrag“ als Vorauswahl bei Mail-PDFs                        |
| P6     | niedrig | `posteingang/[id]/page.tsx:218-220`       | „Als Beleg auslesen“ an jedem Anhang                              |
| P7     | hoch    | `mietverhaeltnisse/[id]/page.tsx:203-221` | Portal-Nachrichten nicht beantwortbar, im Portal unsichtbar       |
| P8     | niedrig | `tickets/[id]/page.tsx:157-163`           | Handwerkerauftrag nur per mailto, nicht protokolliert             |
| P9     | niedrig | `tickets/[id]/page.tsx:60-79`             | Ticket ohne Mieter-Link, Feld „Wo“, Karte „Weiter bearbeiten“     |
| D1     | mittel  | `belege/page.tsx:50`                      | „Belege“ vs. „Belegeingang“                                       |
| D2     | hoch    | `lib/dokument-text.ts:37`                 | Art „Beleg“ als Dokument, Belege in der Dokumentliste ohne Buchen |
| D3     | niedrig | `belege/page.tsx:117-135`                 | „Zuletzt gebucht“ ohne „alle“, Aussortierte unsichtbar            |
| D4     | niedrig | `journal/page.tsx:189`                    | Büroklammer ohne Link                                             |
| On1    | hoch    | `app/(app)/aktionen.ts:97`                | Keine geführten nächsten Schritte nach dem ersten Objekt          |
| On2    | mittel  | `objekte/[id]/aktionen.ts:52`             | Nach Einheit kein Weg zum Mieter                                  |
| On3    | niedrig | `mandanten/neu/page.tsx:7-26`             | Leere Startseite nach neuer Eigentümerschaft                      |
| S1     | hoch    | `app/(app)/page.tsx:53-104`               | Startseite ohne „Zu erledigen“                                    |
| S2     | mittel  | `app/(app)/page.tsx:58-67`                | Fristzeilen nicht verlinkt                                        |
| S3     | niedrig | `app/(app)/page.tsx:85-97`                | Karte nicht klickbar trotz Chevron                                |
| Po1    | mittel  | `portal/mangel/page.tsx:15-16`            | Verweis auf Notfallnummern, die fehlen können                     |
| Po2    | niedrig | `portal/page.tsx:23-110`                  | Notfallkarte unterhalb der Vertragsdaten                          |
| Po3    | niedrig | `portal/page.tsx:25`                      | „Ihre Wohnung“ bei Stellplatz, Marke ohne Link                    |
| T1     | mittel  | `app/(app)/layout.tsx:31-35`              | Mandant, Eigentümer, Mitglieder: drei Begriffe                    |
| T2     | niedrig | diverse                                   | Technikjargon in der Oberfläche                                   |
| T3     | niedrig | `mitglieder/page.tsx`                     | Veralteter Text „Phase 1“                                         |
| T4     | niedrig | `postfaecher/page.tsx:35`                 | Eigene Ampel statt `<Status>`                                     |
| T5     | niedrig | diverse                                   | Satzanfänge mit „Sie“ in einer Du-App                             |
| M1     | mittel  | `lib/navigation.ts:126-132`               | Tabs ohne Fristzähler, freier Platz ohne Post-Recht               |
| M2     | niedrig | `lib/navigation.ts:74`                    | Dokumente markieren keinen Tab                                    |
