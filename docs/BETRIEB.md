# Betrieb

Runbook für Produktion auf einem Hetzner-Cloud-Server. Entscheidungen dazu in ADR 0008. Alle Dateien für den Server liegen in `ops/`.

## Aufbau

Ein Server, Docker Compose, sechs Dienste:

| Dienst     | Image                                      | Aufgabe                                                                                  |
| ---------- | ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `caddy`    | `caddy:2-alpine`                           | TLS (Let's Encrypt), Reverse Proxy, Sicherheits-Header. Einzige offene Ports 80 und 443. |
| `web`      | `ghcr.io/mfilkorn-stack/vermieteros`       | Next.js, App-Rolle `vermieteros_app`                                                     |
| `migrate`  | dasselbe Image, `node db/dist/migrate.mjs` | Migrationen mit `vermieteros_owner`, nur beim Deployment                                 |
| `postgres` | `postgres:16`                              | Datenbank, Volume `pgdata`, Rollen beim ersten Start aus `postgres-init.sh`              |
| `ops`      | `ghcr.io/mfilkorn-stack/vermieteros-ops`   | Zeitplan für Backup, Integritätsprüfung und Restore-Test                                 |

Vier Datenbankrollen: `vermieteros_owner` besitzt das Schema und migriert. `vermieteros_app` ist die Laufzeitrolle der App ohne BYPASSRLS. `vermieteros_worker` sieht die Postfächer aller Mandanten und schreibt Nachrichten nur im Mandantenkontext. `vermieteros_sicherung` liest nur, dafür an RLS vorbei, und dient ausschließlich Backup und Integritätsprüfung.

Zeitplan im `ops`-Container (Europe/Berlin, außerhalb der Umstellungsstunde 02:00–03:00):

| Zeit           | Job            | Was                                                                                          |
| -------------- | -------------- | -------------------------------------------------------------------------------------------- |
| täglich 01:30  | `backup`       | Manifest der Kettenköpfe, `pg_dump`, mit age verschlüsselt, ins Object Storage               |
| täglich 04:00  | `integritaet`  | jede Hash-Kette prüfen, Kettenköpfe gegen das letzte Backup-Manifest abgleichen              |
| am 1. um 05:00 | `restore-test` | jüngstes Backup in frischen Cluster einspielen und prüfen (nur mit Schlüssel auf dem Server) |

Jeder Job meldet Start, Erfolg oder Fehler an einen Totmannschalter. Bleibt die Meldung aus, alarmiert der Monitor.

## Einrichtung

Einmalig, in dieser Reihenfolge.

### Schlüssel für die Backups

Auf dem eigenen Rechner, nicht auf dem Server:

```sh
age-keygen -o vermieteros-backup.key
```

Die Zeile `# public key: age1…` ist der Empfänger für `BACKUP_EMPFAENGER`. Die Datei selbst ist der private Schlüssel. Ohne ihn ist kein Backup lesbar. Er gehört in den Passwortmanager und zusätzlich ausgedruckt an einen zweiten Ort.

Für den monatlichen Restore-Test auf dem Server liegt eine Kopie unter `/srv/vermieteros/geheim/backup.key`. Das ist eine bewusste Abwägung: Wer den Server übernimmt, hat ohnehin die Datenbank. Die Verschlüsselung schützt die Backups vor einem Leck im Object Storage. Wer den Schlüssel nicht auf dem Server haben will, lässt die Datei weg und führt den Restore-Test monatlich vom eigenen Rechner aus (siehe unten).

### Hetzner

1. **Object Storage:** zwei Buckets anlegen, je mit eigenem Zugangsschlüssel. `vermieteros-dokumente` nimmt Mails und Anhänge auf (Worker schreibt, Web-App lädt für Downloads), `vermieteros-backup` nur Backups. Endpoint und Region notieren (z. B. `https://fsn1.your-objectstorage.com`, `fsn1`).
2. **Firewall** im Cloud-Projekt: eingehend nur 22 (am besten nur von der eigenen IP), 80 und 443 (TCP, 443 auch UDP). Docker veröffentlicht Ports an `ufw` vorbei, die Cloud-Firewall greift davor.
3. **Server:** Ubuntu 24.04, x86 (die Images sind amd64), 4 GB RAM reichen für Phase 0 und 1. Standort Falkenstein oder Nürnberg. Unter „Cloud config“ den Inhalt von `ops/cloud-init.yml` einfügen, vorher den eigenen SSH-Public-Key darin eintragen. Backups des Servers bei Hetzner zusätzlich einschalten.
4. **DNS:** A- und AAAA-Eintrag der Domain auf den Server (`www.vermieteros.app`), ebenso für den Namen in `DOMAIN_UMLEITUNG` (`vermieteros.app`), den Caddy dauerhaft auf `DOMAIN` umleitet.

### Server

```sh
ssh betrieb@<server>
cd /srv/vermieteros
# aus dem Repository: ops/compose.yml, Caddyfile, postgres-init.sh, deploy.sh, env.beispiel
cp env.beispiel .env && chmod 600 .env    # ausfüllen, Passwörter mit: openssl rand -hex 24
# Der ops-Container läuft als uid 70 (postgres) und muss das Verzeichnis lesen können.
sudo install -d -o 70 -g 70 -m 700 geheim
# optional, für den Restore-Test auf dem Server (siehe oben):
sudo install -o 70 -g 70 -m 400 vermieteros-backup.key geheim/backup.key
docker login ghcr.io -u <github-nutzer>   # Token (classic) nur mit read:packages
```

### Schlüssel für Postfach-Passwörter

```sh
openssl rand -base64 32
```

Der Wert kommt als `POSTFACH_SCHLUESSEL` in die `.env` und zusätzlich in den Passwortmanager. Web-App und Worker müssen denselben Schlüssel haben. Ohne ihn lassen sich die gespeicherten Postfach-Passwörter nicht mehr entschlüsseln und müssen neu eingegeben werden.

### KI-Schlüssel

`ANTHROPIC_API_KEY` in der `.env` schaltet die KI ein (Web und Worker). Ohne Schlüssel läuft alles außer den KI-Vorschlägen. Bevor echte Mieterdaten an die API gehen: Die Auftragsverarbeitung (DPA mit Standardvertragsklauseln) ist Teil der Commercial Terms und gilt mit deren Annahme in der Console; Text als PDF ablegen und Anthropic ins Verzeichnis der Verarbeitungstätigkeiten aufnehmen. Außerdem im Account prüfen, ob EU-Inferenz und verkürzte Aufbewahrung verfügbar sind (PLAN 4.4). Was an die KI geht, steht pro Aufruf als Ereignis `ki_aufruf` im Ledger, ohne Inhalt. `KI_MODELL` nur ändern, wenn das Golden-Set mit dem neuen Modell besteht (Workflow „KI Golden-Set“, manuell starten mit Modell). Mit Schlüssel sortiert der Worker neue Mails der letzten drei Tage automatisch, höchstens `KI_SORTIERUNG_LIMIT` (Standard 20) pro Durchlauf; nach zwei gescheiterten Versuchen bleibt eine Mail unsortiert. `KI_SORTIERUNG=aus` schaltet das ab, Einschätzungen und Entwürfe auf Knopfdruck bleiben. Für CI liegt derselbe Schlüssel als Repository-Secret `ANTHROPIC_API_KEY`; ohne Secret überspringt der wöchentliche Lauf.

### Dokumente

Dokumente liegen wie Mails im Object Storage (`mandanten/<id>/dokument/…`), unveränderlich und mit Prüfsumme; das Backup nimmt sie mit. Uploads gehen bis 20 MB (`serverActions.bodySizeLimit` in `next.config.ts`); Caddy begrenzt davor nicht. Bei Ablehnungen durch die Sicherheitsfilter beantwortet serverseitig ein anderes Claude-Modell die Anfrage (`fallbacks: "default"`); der Auftragsverarbeitungsvertrag muss das abdecken.

### Belege

Eine eigene Beleg-Adresse ist ein Postfach mit Zweck „Belege“ (eigene Adresse oder eigener Ordner per Regel im Mailprogramm). Ihre Mails erscheinen nicht im Posteingang; jeder PDF- oder Bild-Anhang wird ein Beleg, dieselbe Datei nur einmal. Mit KI-Schlüssel liest der Worker neue Belege der letzten 30 Tage aus, bei allen Mandanten (auch ohne Postfach) und unabhängig von `KI_SORTIERUNG`, höchstens `KI_BELEGE_LIMIT` (Standard 10) pro Durchlauf, nach zwei Fehlversuchen nicht mehr automatisch. Uploads im Belegeingang, Rechnungen am Ticket und Dokumente der Art „Beleg“ werden schon beim Hochladen ausgelesen; der Worker fängt auf, was dabei scheitert.

**Vorbelegung beim Buchen:** Werte mit am PDF geprüfter Fundstelle; bei Fotos und Scans ebenfalls alle Werte, gebucht wird dann erst nach dem Haken „am Beleg geprüft“ (Herkunft „Foto oder Scan, von Hand geprüft“). Das Objekt kommt in dieser Reihenfolge: beim Hochladen gewählt oder aus dem Ticket, dann eine Anschrift oder Objektbezeichnung, die wörtlich im Beleg steht, dann der Vorschlag der KI. Betrifft ein Beleg mehrere Objekte (z. B. Steuerberatung für alle), wird gleichmäßig aufgeteilt. Belege sind steuerlich aufbewahrungspflichtig (mindestens zehn Jahre); sie liegen unveränderlich im Object Storage und werden nie gelöscht, auch nicht nach „Aus dem Eingang nehmen“.

### Mailversand

Die App verschickt Mails für Kontobestätigung, Einladungen in den Mandanten und das Mieterportal über SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_BENUTZER`, `SMTP_PASSWORT`, `MAIL_ABSENDER` in der `.env`). Welcher Anbieter, entscheidet nur die Umgebung:

| Anbieter                  | Kosten                         | Einrichtung                                                                    |
| ------------------------- | ------------------------------ | ------------------------------------------------------------------------------ |
| Brevo                     | kostenlos bis 300 Mails am Tag | `smtp-relay.brevo.com`, Port 587, SMTP-Schlüssel aus dem Konto; AVV im Konto   |
| eigener Mail-Hoster       | im Paket enthalten             | SMTP-Daten des Postfachs, z. B. `noreply@`; Versandlimits des Hosters beachten |
| Amazon SES (eu-central-1) | etwa 0,10 USD je 1000 Mails    | Domain verifizieren, Sandbox verlassen, SMTP-Zugangsdaten erzeugen             |

Für jeden Anbieter SPF und DKIM für die Absender-Domain setzen, sonst landen Anmeldelinks im Spam. Ohne `SMTP_HOST` wird nichts verschickt: Einladungslinks fürs Portal erscheinen dann in der App zum persönlichen Weitergeben, Bestätigungsmails fehlen. Fehler beim Versand stehen im Log von `web`, ohne Inhalt.

Beim Start prüft `web` Verbindung und Anmeldung am SMTP-Server, ohne etwas zu verschicken. Nach jedem Deployment oder jeder Änderung an der `.env`:

```sh
docker compose logs web | grep '\[mail\]'
```

`[mail] SMTP bereit (smtp.ionos.de:587)` ist richtig. `nicht erreichbar: getaddrinfo ENOTFOUND` heißt Tippfehler im Host, `Invalid login` oder `535` falscher Benutzer oder falsches Passwort.

### Adresssuche

Objekt anlegen, Stammdaten und Eigentümer haben ein Feld „Adresse suchen“. Ein gewählter Vorschlag füllt Straße, Hausnummer, PLZ, Ort und, wo es das Feld gibt, das Bundesland. Danach zeigt das Formular „Anschrift gefunden“. Weicht man von Hand davon ab, steht dort „abweichend geändert“. Gespeichert wird, was in den Feldern steht.

Die Vorschläge kommen von Photon (OpenStreetMap, betrieben von komoot in Deutschland, ohne Schlüssel und ohne Vertrag; die öffentliche Instanz ist für faire, geringe Nutzung gedacht). Die App fragt vom Server aus an und schickt nur den Suchtext, nie Nutzer, Mandant oder IP des Browsers. `ADRESSSUCHE=aus` blendet das Feld aus, `ADRESSSUCHE_URL` zeigt auf einen eigenen Photon-Server. Ist der Dienst nicht erreichbar, sagt das Formular es und die Felder bleiben normal ausfüllbar.

**Firmensuche (Handwerker):** Das Handwerker-Formular hat ein Feld „Firma suchen“. Vorschläge sind OpenStreetMap-Einträge mit Namen über Photon, Handwerksbetriebe zuerst; die Auswahl füllt Firma, Anschrift und, wo eindeutig, das Gewerk. Telefon, E-Mail und Webseite holt die App erst nach der Auswahl, einmal pro Firma, von Nominatim (Nutzungsregeln: kein Abruf beim Tippen, höchstens einer pro Sekunde) und trägt sie nur in leere Felder ein. Nicht jeder Betrieb steht in OpenStreetMap; „Im Internet suchen“ öffnet dann eine Websuche im eigenen Browser. `FIRMENSUCHE=aus` schaltet ab, `FIRMENSUCHE_DETAILS_URL` zeigt auf ein eigenes Nominatim.

### Registrierung

In Produktion legt nicht jeder ein Konto an, der die Domain kennt. Erlaubt sind die Adressen in `REGISTRIERUNG_ERLAUBT` (kommagetrennt, typischerweise nur die eigene) und Adressen mit offener Einladung in einen Mandanten. Alle anderen bekommen „Registrierung nur mit Einladung“. Mieter brauchen kein Konto, sie nutzen das Portal. `REGISTRIERUNG=offen` hebt die Sperre auf (Tests, lokale Entwicklung; dort ist sie ohnehin aus).

**Passwort vergessen:** Link auf der Anmeldeseite, Mail mit Einmal-Link (gilt eine Stunde), danach enden alle Sitzungen des Kontos; die Zwei-Faktor-Pflicht bleibt. Ohne Mailversand gibt es keinen Weg zurück ins Konto. Passwörter stehen nirgends im Klartext, weder in Logs noch in der Datenbank (nur Hash).

### Mieterportal

Erreichbar unter `https://www.vermieteros.app/portal`. Mieter werden am Mietverhältnis (Verlauf, Karte „Mieterportal“) eingeladen und dort auch gesperrt. Anmeldelinks gelten 15 Minuten, Einladungen 7 Tage, jeweils einmal; die Sitzung hält 30 Tage. In der Datenbank stehen nur Prüfsummen der Links und Sitzungen (ADR 0010). Mängelmeldungen erscheinen als Ticket „gemeldet“, Nachrichten im Verlauf; Eigentümer, Miteigentümer und Mitverwalter bekommen dazu eine Mail.

### Monitoring

Bei healthchecks.io (oder selbst gehostet) drei Checks anlegen und die URLs in `.env` eintragen:

| Variable                  | Erwartet  | Karenz |
| ------------------------- | --------- | ------ |
| `HEALTHCHECK_BACKUP`      | täglich   | 2 h    |
| `HEALTHCHECK_INTEGRITAET` | täglich   | 2 h    |
| `HEALTHCHECK_RESTORE`     | monatlich | 1 Tag  |

Dazu ein externer Uptime-Check auf `https://www.vermieteros.app/api/gesund`. Er antwortet mit 200, wenn die App läuft und die Datenbank erreicht.

### Erstes Deployment

Reihenfolge und Abnahme stehen als Checkliste in [LIVEGANG.md](LIVEGANG.md).

Den Tag eines Images auf `main` nehmen (`sha-<kurz>`, siehe GitHub Packages):

```sh
./deploy.sh sha-1a2b3c4 --ohne-backup
```

Beim ersten Mal gibt es noch nichts zu sichern. Danach `docker compose logs ops` prüfen und einmal von Hand sichern und testen, siehe unten.

## Routine

### Deployment

```sh
./deploy.sh sha-<kurz>
```

Das Skript zieht die Images, sichert die Datenbank, migriert und startet neu. Es wartet, bis alle Dienste gesund sind. Schlägt das Backup fehl, wird nicht migriert.

### Von Hand sichern und prüfen

```sh
docker compose run --rm ops backup
docker compose run --rm ops integritaet
docker compose run --rm ops restore-test            # jüngstes Backup
docker compose run --rm ops rclone lsf ziel:<bucket>/vermieteros
```

Ohne Schlüssel auf dem Server läuft der Restore-Test auf dem eigenen Rechner. Dort wird der Container mit denselben S3-Variablen gestartet und der Schlüssel eingehängt:

```sh
docker run --rm --env-file s3.env -e BACKUP_SCHLUESSEL=/geheim/backup.key \
  -v ~/geheim:/geheim:ro ghcr.io/mfilkorn-stack/vermieteros-ops:<tag> restore-test
```

### Vorhaltung

Tägliche Backups bleiben 30 Tage. Das Backup vom Monatsersten bleibt 13 Monate. Gesteuert über `BACKUP_TAGE` und `BACKUP_MONATE`. Gelöscht wird nur nach einem erfolgreichen neuen Backup.

### Monatlich

Image-Updates: `docker compose pull` für `caddy` und `postgres` (Minor-Versionen), dann `./deploy.sh` mit dem aktuellen Tag. Ein Blick in die Monitoring-Historie. Restore-Test-Ergebnis prüfen.

## Wiederherstellung im Ernstfall

Die Datenbank ist verloren oder beschädigt. Ziel ist eine leere Datenbank mit den drei Rollen, in die das Backup eingespielt und danach geprüft wird. Das Skript `wiederherstellen` bricht ab, wenn die Zieldatenbank nicht leer ist.

1. Server neu aufsetzen wie oben oder auf dem bestehenden Server das Volume ersetzen:
   ```sh
   docker compose down
   docker volume rm vermieteros_pgdata
   ```
2. Den privaten Schlüssel aus dem Passwortmanager nach `geheim/backup.key` legen, Rechte wie bei der Einrichtung.
3. Nur Postgres starten. Die Rollen entstehen aus `postgres-init.sh`:
   ```sh
   docker compose up -d --wait postgres
   ```
4. Einspielen und prüfen. Ohne Namen nimmt das Skript das jüngste vollständige Backup:
   ```sh
   docker compose run --rm -e PGUSER=postgres -e PGPASSWORD="$(grep ^POSTGRES_PASSWORT= .env | cut -d= -f2)" \
     ops wiederherstellen [vermieteros-2026-…Z]
   ```
   Am Ende steht `OK: n Ketten intakt, n Köpfe aus dem Manifest vorhanden`.
5. Mails und Anhänge zurückkopieren, falls der Dokumenten-Bucket verloren ist. Vorhandenes wird nicht überschrieben:
   ```sh
   docker compose run --rm ops rclone copy --immutable --checksum ziel:<backup-bucket>/dokumente dokumente:<dokumente-bucket>
   ```
6. Starten: `./deploy.sh <tag> --ohne-backup`. Eine neuere App-Version migriert dabei nach.

Verloren sind die Änderungen seit dem letzten Backup, höchstens ein Tag.

## Grenzen

- **Datenverlust bis zu einem Tag.** `pg_dump` läuft nachts. Kontinuierliche WAL-Archivierung (z. B. WAL-G) kommt, sobald Mieter und Mails im System sind (Phase 1).
- **Die Backup-Zugangsdaten liegen auf dem Server.** Wer den Server übernimmt, kann Backups löschen und Manifeste ersetzen. Abhilfe: eine zweite Kopie, die der Server nicht erreicht, z. B. ein nächtlicher Abzug vom eigenen Rechner auf eine Storage Box, oder Object Lock, sobald der Bucket es unterstützt.
- **Ein Server.** Fällt er aus, bedeutet das Wiederherstellung auf einem neuen Server, rund eine Stunde mit diesem Runbook.
