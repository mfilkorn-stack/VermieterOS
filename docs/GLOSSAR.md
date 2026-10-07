# Glossar · verbindliche Fachbegriffe

Bezeichner im Code, in der Datenbank und in Prompts verwenden genau diese Formen. Umlaute ausgeschrieben.

| Begriff                             | Bezeichner            | Bedeutung                                                                                  |
| ----------------------------------- | --------------------- | ------------------------------------------------------------------------------------------ |
| Mandant                             | `mandant`             | Eigentümerschaft als abgeschlossener Datenbereich (ADR 0002)                               |
| Eigentümerschaft                    | `eigentuemerschaft`   | Allein, Ehepaar, Bruchteilsgemeinschaft, GbR; Attribut des Mandanten                       |
| Objekt                              | `objekt`              | Haus oder Eigentumswohnung als wirtschaftliche Einheit                                     |
| Einheit                             | `einheit`             | Vermietbare Einheit innerhalb eines Objekts                                                |
| Mietverhältnis                      | `mietverhaeltnis`     | Vertrag zwischen Mandant und Mieter über eine Einheit                                      |
| Mietkondition                       | `mietkondition`       | Versionierte Sollmiete, Vorauszahlungen, Mietart                                           |
| Person                              | `person`              | Mieter, Miteigentümer, Kontakt                                                             |
| Vorauszahlung                       | `vorauszahlung`       | Monatliche Abschlagszahlung auf Betriebs- oder Heizkosten                                  |
| Betriebskosten                      | `betriebskosten`      | Kosten nach § 2 BetrKV                                                                     |
| Umlagefähig                         | `umlagefaehig`        | Auf Mieter umlegbar nach BetrKV                                                            |
| Verteilerschlüssel                  | `verteilerschluessel` | `wohnflaeche`, `personen`, `einheiten`, `verbrauch`, `miteigentumsanteil`                  |
| Heizkosten                          | `heizkosten`          | Kosten nach HeizKV, 50–70 % nach Verbrauch                                                 |
| Abrechnungszeitraum                 | `abrechnungszeitraum` | Meist Kalenderjahr                                                                         |
| Leistungszeitraum                   | `leistungszeitraum`   | Zeitraum, auf den ein Beleg sich bezieht (Nebenkosten)                                     |
| Zahlungsdatum                       | `zahlungsdatum`       | Zu-/Abfluss (Steuer, § 11 EStG)                                                            |
| Beleg                               | `beleg`               | Rechnung, Bescheid, Quittung als Datei mit Prüfsumme                                       |
| Journal                             | `journal`             | Alle Einnahmen und Ausgaben pro Objekt und Jahr                                            |
| Journaleintrag                      | `journaleintrag`      | Eine Buchung, unveränderlich, Storno statt Löschen                                         |
| Steuerkategorie                     | `steuerkategorie`     | Zeile der Anlage V                                                                         |
| Erhaltungsaufwand                   | `erhaltungsaufwand`   | Sofort abziehbare Reparaturkosten                                                          |
| Herstellungskosten                  | `herstellungskosten`  | Aktivierungspflichtig, über AfA                                                            |
| Anschaffungsnahe Herstellungskosten | `anschaffungsnahe_hk` | 15-%-Grenze in drei Jahren nach Kauf                                                       |
| AfA                                 | `afa`                 | Absetzung für Abnutzung, Satz in Promille, Beginn als Datum                                |
| Mieterhöhung                        | `mieterhoehung`       | Verfahren nach §§ 557–559 BGB                                                              |
| Kappungsgrenze                      | `kappungsgrenze`      | 20 % bzw. 15 % in drei Jahren                                                              |
| Sperrfrist                          | `sperrfrist`          | 15 Monate seit letzter Erhöhung bzw. Mietbeginn                                            |
| Mietspiegel                         | `mietspiegel`         | Referenzdatum pro Stadt mit Gültigkeitszeitraum                                            |
| Verbraucherpreisindex               | `vpi`                 | Referenzdatum für Indexmiete                                                               |
| Kaution                             | `kaution`             | Max. drei Nettokaltmieten, getrennt geführt, keine Einnahme                                |
| Festschreibung                      | `festschreibung`      | Eingefrorener Datenstand einer versandten Abrechnung, Mieterhöhung oder eines Steuerpakets |
| Ereignis                            | `ereignis`            | Ledger-Eintrag mit Hash                                                                    |
| Version                             | `version`             | Zeile einer `*_versionen`-Tabelle                                                          |
| Gültig ab                           | `gueltig_ab`          | Fachliche Zeitachse (Datum)                                                                |
| Erfasst am                          | `erfasst_am`          | Technische Zeitachse (Zeitpunkt)                                                           |
| Herkunft                            | `herkunft`            | Quelle eines Feldwerts: `manuell`, `dokument`, `bank_csv`, `kalkulation`, `ki_vorschlag`   |
| Storno                              | `storno`              | Ungültigmachen einer Version oder eines Journaleintrags, bleibt sichtbar                   |
| Vorschlag                           | `vorschlag`           | KI-Ausgabe mit Versionsstempel und Ablaufdatum, erst nach Bestätigung Daten                |
| Versionsstempel                     | `versionsstempel`     | Ledger-Sequenz, Dokument-Hashes, Prompt-Version, Modell                                    |
| Referenzdaten                       | `referenzdaten`       | Mietspiegel, VPI, GrESt, AfA-Sätze, Kappungsgebiete mit Gültigkeit und Quelle              |
| Steuerpaket                         | `steuerpaket`         | ZIP pro Jahr und Mandant für den Steuerberater                                             |
| Notfallkarte                        | `notfallkarte`        | Notfallkontakte pro Objekt                                                                 |
| Wissensbasis                        | `wissensbasis`        | Hausordnung, Anleitungen, Müllkalender pro Objekt                                          |
| Ticket                              | `ticket`              | Mangelmeldung bis Rechnung                                                                 |
| Postfach                            | `postfach`            | IMAP-Zugang eines Mandanten, wird nur gelesen (ADR 0009)                                   |
| Nachricht                           | `nachricht`           | Eingegangene Mail; Rohfassung und Anhänge mit Prüfsumme im Object Storage                  |
| Zuordnung                           | `zuordnung`           | Verknüpfung Nachricht → Mietverhältnis; append-only, die jüngste gilt                      |
| Posteingang                         | `posteingang`         | Nachrichten eines Mandanten; „offen“ = ohne aktuelle Zuordnung                             |
| Telefonnotiz                        | `telefonnotiz`        | Gesprächsnotiz zu einem Mietverhältnis; append-only, Korrektur ersetzt die alte Fassung    |
| Verlauf                             | `verlauf`             | Mails und Telefonnotizen eines Mietverhältnisses in einer Zeitleiste                       |
