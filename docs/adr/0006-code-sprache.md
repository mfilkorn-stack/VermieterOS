# ADR 0006 · Code-Sprache: Englisch technisch, Deutsch fachlich

Status: angenommen · 06.10.2026

## Entscheidung

Technische Bezeichner (Funktionen, Infrastruktur, generische Helfer) auf Englisch. Fachbegriffe mit rechtlicher oder steuerlicher Bedeutung bleiben Deutsch und werden nicht übersetzt: `mietverhaeltnis`, `vorauszahlung`, `umlagefaehig`, `kappungsgrenze`, `erhaltungsaufwand`. Umlaute werden ausgeschrieben (`ae`, `oe`, `ue`, `ss`). Tabellen- und Spaltennamen folgen derselben Regel in snake_case. Verbindlich ist `docs/GLOSSAR.md`.

## Begründung

Eine Übersetzung von „Erhaltungsaufwand“ oder „anschaffungsnahe Herstellungskosten“ wäre eine zweite Wahrheit, die niemand prüfen kann. Der Code soll von jemandem lesbar sein, der die Anlage V kennt.
