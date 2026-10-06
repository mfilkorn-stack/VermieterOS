# ADR 0003 · Entitäts-Versionen mit Feld-Herkunft

Status: angenommen · 06.10.2026

## Kontext

Der Architekturplan fordert, dass jedes Feld eine Historie mit Gültigkeit, Erfassungszeitpunkt, Quelle und Begründung hat. Eine generische Feld-Historie (eine Zeile pro Feldänderung) macht jede Lesesicht zur Pivot-Abfrage und verliert Typsicherheit.

## Entscheidung

Pro Entität eine Identitätstabelle (`objekte`) und eine append-only Versionstabelle (`objekt_versionen`) mit allen Fachfeldern als typisierten Spalten. Zwei Zeitachsen: `gueltig_ab` (fachlich) und `erfasst_am` (technisch). Herkunft wird pro geändertem Feld als JSON (`herkunft`) an der Version gespeichert. Sichten `*_aktuell` und Funktionen `*_stand(id, stichtag, erfasst_bis)` liefern den Lesestand. Storno setzt `storniert_am`.

## Konsequenzen

Jede neue Version kopiert alle Fachfelder (Speicher ist billig, Klarheit nicht). Die Frage „welches Feld hat sich geändert“ wird aus dem Diff zweier Versionen oder aus `herkunft` beantwortet. Das Muster ist mechanisch wiederholbar und wird für jede Entität gleich gebaut.
