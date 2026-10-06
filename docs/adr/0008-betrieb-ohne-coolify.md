# ADR 0008 · Betrieb mit Docker Compose und Caddy, Backup mit Manifest als Anker

Status: angenommen · 06.10.2026 · ersetzt den Teil „Coolify“ aus ADR 0001

## Entscheidung

**Kein Coolify.** Produktion läuft mit Docker Compose und Caddy auf einem Hetzner-Cloud-Server. CI baut die Images und legt sie in GHCR ab. Auf dem Server deployt `ops/deploy.sh <tag>`: Backup, Migration, Neustart.

**Backup:** Ein eigenes Ops-Image auf Basis von `postgres:16-alpine` führt die Jobs aus. Es enthält `age` und `rclone` als geprüfte Release-Binärdateien und einen Zeitplan ohne Cron-Daemon. Jede Nacht sichert es so:

1. Ein Manifest hält den Kopf jeder Hash-Kette fest.
2. `pg_dump` läuft im Custom-Format und wird direkt mit age verschlüsselt.
3. Dump, Manifest und Prüfsummen gehen in einen eigenen Bucket im Hetzner Object Storage.

Gelesen wird mit einer eigenen Rolle `vermieteros_sicherung`. Sie ist nur lesend und hat BYPASSRLS.

**Prüfung:** Der Restore-Test spielt ein Backup in einen frischen Cluster im Container ein. Danach prüft er Migrationsstand, die Kettenköpfe aus dem Manifest und jede Kette. Die nächtliche Integritätsprüfung gleicht die Kettenköpfe zusätzlich mit dem letzten Manifest ab. Das Manifest ist damit der externe Anker aus PLAN.md, Kapitel 9.

## Begründung

Coolify bringt eine eigene Steuerungsebene mit Root-Zugriff auf den Host, eine eigene Datenbank und eine Weboberfläche ins Spiel. Für eine App mit einem Server ist das mehr Angriffsfläche und mehr bewegliche Teile als Nutzen. Leitprinzip 5 ist Zurückhaltung. Compose-Datei, Caddyfile und Skripte liegen im Repository, sind prüfbar und laufen in CI. Coolify könnte dieselbe Compose-Datei später trotzdem deployen.

Die Kettenprüfung allein erkennt keine Kette, die ein Angreifer mit Datenbankzugang vollständig neu berechnet. Der Abgleich mit dem Manifest erkennt sie. Die Betriebsprobe spielt diesen Angriff durch.

Die Storage Box aus der ersten Fassung von PLAN.md 7.2 entfällt als primäres Ziel. Object Storage ist S3-kompatibel und wird ab Phase 1 ohnehin für Dokumente gebraucht. Eine zweite Kopie außerhalb der Reichweite des Servers bleibt offen (docs/BETRIEB.md, Grenzen).

## Konsequenzen

Updates von Basis-Images, Werkzeug-Versionen und Prüfsummen sind Handarbeit. Die Wiederherstellung ist ein geprüftes Skript und kein Klickpfad. Die Betriebsprobe (`ops/probe.sh`) läuft in jedem CI-Durchlauf.
