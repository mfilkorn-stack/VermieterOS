# ADR 0007 · Referenzdaten mit Prüffrist, AfA-Sätze im Rechenkern

Status: angenommen · 06.10.2026

## Entscheidung

Werte von außen, die sich ohne Codeänderung ändern (Grunderwerbsteuer je Land, später Mietspiegel, VPI, Kappungsgebiete, Bodenrichtwerte), liegen in der append-only Tabelle `referenzdaten`. Jede Zeile trägt diese Angaben:

- Gültigkeit mit `gueltig_von` und `gueltig_bis`
- Quelle und Quellen-URL
- `geprueft_am` und `pruefen_bis`

Globale Werte haben `mandant_id IS NULL` und kommen nur per Migration ins System. Ein Mandant kann eigene Werte anlegen, die den globalen überdecken. Korrekturen sind neue Zeilen, und die spätere Erfassung gewinnt.

`referenzwert()` im Rechenkern liefert einen Wert immer zusammen mit einem Status: `gueltig`, `ungeprueft`, `abgelaufen` oder `fehlt`. Jeder Status außer `gueltig` wird im Datenqualitäts-Check zu einer sichtbaren Warnung. Bei der Grunderwerbsteuer ist das Datum des notariellen Kaufvertrags der Stichtag.

AfA-Sätze stehen nicht in `referenzdaten`. Sie hängen am Fertigstellungsjahr und an § 7 Abs. 4 EStG und bleiben mit Gesetzeszitat und Grenztests im Rechenkern.

## Begründung

Ein Satz, dessen Prüffrist abgelaufen ist, kann noch stimmen. Die Software darf ihn aber nicht still weiterverwenden. Deshalb rechnet sie weiter und warnt.

AfA-Sätze in einer Tabelle wären eine zweite Wahrheit neben der Fallunterscheidung im Code. Ihre Änderung kommt zudem nur mit einer Gesetzesänderung, die ohnehin Code und Tests braucht.
