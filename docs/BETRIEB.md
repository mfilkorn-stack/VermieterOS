# Betrieb

Runbook für Produktion auf einem Hetzner-Cloud-Server. Entscheidungen dazu in ADR 0008. Alle Dateien für den Server liegen in `ops/`.

## Aufbau

Ein Server, Docker Compose, sechs Dienste:

| Dienst     | Image                                         | Aufgabe                                                                                  |
| ---------- | --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `caddy`    | `caddy:2-alpine`                              | TLS (Let's Encrypt), Reverse Proxy, Sicherheits-Header. Einzige offene Ports 80 und 443. |
| `web`      | `ghcr.io/mfilkorn-stack/vermieteros`          | Next.js, App-Rolle `vermieteros_app`                                                     |
| `worker`   | dasselbe Image, `node worker/dist/worker.mjs` | Mail-Abruf, KI-Sortierung, Belege auslesen; Rolle `vermieteros_worker`                   |
| `migrate`  | dasselbe Image, `node db/dist/migrate.mjs`    | Migrationen mit `vermieteros_owner`, nur beim Deployment                                 |
| `postgres` | `postgres:16`                                 | Datenbank, Volume `pgdata`, Rollen beim ersten Start aus `postgres-init.sh`              |
| `ops`      | `ghcr.io/mfilkorn-stack/vermieteros-ops`      | Zeitplan für Backup, Integritätsprüfung und Restore-Test                                 |

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
cp -n env.beispiel .env && chmod 600 .env    # -n überschreibt keine vorhandene .env; Passwörter mit: openssl rand -hex 24
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

**Anhänge im normalen Posteingang:** In jeder Mail, auch ohne Zuordnung, lässt sich ein PDF- oder Bild-Anhang mit „Als Beleg auslesen“ direkt in den Belegeingang übernehmen oder über „Als Dokument ablegen“ an Mietverhältnis bzw. Objekt ablegen. Belege, Mietverträge (am Mietverhältnis) und Kaufverträge (am Objekt) werden dabei sofort ausgelesen; die Felder sind vorbelegt und werden erst mit Bestätigung übernommen. Ein bereits abgelegter Anhang zeigt „Beleg öffnen“ bzw. „Dokument öffnen“ statt einer zweiten Ablage. „Beleg“ ist keine Dokumentart mehr: Rechnungen gehören unter Belege, Dokumente mit Art „Beleg“ aus älteren Ständen verlinken dorthin.

**Zuordnung:** Eine Mail gehört zu einem Mietverhältnis (automatisch über Absender oder Verlauf, sonst von Hand), zu einem Objekt (WEG, Behörde, Versorger) oder zu einem Handwerker; beides setzt ein Mensch. „Erledigt“ schließt eine Mail ohne Ziel ab (Werbung, am Telefon geklärt). Nur Mails ohne Ziel und nicht erledigt zählen als „nicht zugeordnet“ im Menü und auf der Übersicht. Objektakte und Handwerker zeigen die ihnen zugeordneten Mails.

**Vorbelegung beim Buchen:** Werte mit am PDF geprüfter Fundstelle; bei Fotos und Scans ebenfalls alle Werte, gebucht wird dann erst nach dem Haken „am Beleg geprüft“ (Herkunft „Foto oder Scan, von Hand geprüft“). Das Objekt kommt in dieser Reihenfolge: beim Hochladen gewählt oder aus dem Ticket, dann eine Anschrift oder Objektbezeichnung, die wörtlich im Beleg steht, dann der Vorschlag der KI. Betrifft ein Beleg mehrere Objekte (z. B. Steuerberatung für alle), wird gleichmäßig aufgeteilt. Belege sind steuerlich aufbewahrungspflichtig (mindestens zehn Jahre); sie liegen unveränderlich im Object Storage und werden nie gelöscht, auch nicht nach „Aus dem Eingang nehmen“.

### Mailversand

Die App verschickt Mails für Kontobestätigung, Einladungen in den Mandanten und das Mieterportal über SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_BENUTZER`, `SMTP_PASSWORT`, `MAIL_ABSENDER` in der `.env`). Welcher Anbieter, entscheidet nur die Umgebung:

| Anbieter                  | Kosten                         | Einrichtung                                                                    |
| ------------------------- | ------------------------------ | ------------------------------------------------------------------------------ |
| Brevo                     | kostenlos bis 300 Mails am Tag | `smtp-relay.brevo.com`, Port 587, SMTP-Schlüssel aus dem Konto; AVV im Konto   |
| eigener Mail-Hoster       | im Paket enthalten             | SMTP-Daten des Postfachs, z. B. `noreply@`; Versandlimits des Hosters beachten |
| Amazon SES (eu-central-1) | etwa 0,10 USD je 1000 Mails    | Domain verifizieren, Sandbox verlassen, SMTP-Zugangsdaten erzeugen             |

**Handwerkeraufträge** gehen aus dem Ticket („Auftrag an Handwerker“) über denselben SMTP wie Antworten, mit dem ersten aktiven Vermietungs-Postfach als Reply-To; Mangelfotos des Tickets hängen auf Wunsch an (zusammen höchstens 15 MB). Der Auftrag wird vor dem Versand in `antworten` vermerkt (Bezug `ticket_id`, Empfänger `handwerker_id`), ein nur gemeldetes Ticket steht danach auf „beauftragt“. Ohne `SMTP_HOST` öffnet der Knopf das Mailprogramm, dann ohne Vermerk.

**Dokumente über alle Immobilien** stehen unter „Dokumente“ (Reiter der Übersicht), filterbar nach Immobilie, Art und Suchtext; Belege haben ihre eigene Liste.

**Tickets aus Dateien:** Unter „Ticket anlegen“ lässt sich eine Mängelmeldung oder ein Schreiben als PDF oder Foto hochladen. Mit KI-Schlüssel schlägt die Aufgabe `ticket_extraktion` Titel, Beschreibung und Priorität vor; das Formular ist vorbelegt, erst das Anlegen schreibt das Ticket. Die Datei liegt bis dahin als Dokument am Objekt und hängt danach am Ticket (der Eintrag am Objekt gilt als ersetzt).

**Nachrichten aus dem Mieterportal** stehen im Posteingang unter „Aus dem Mieterportal“, solange sie unbeantwortet sind, und lassen sich dort wie Mails beantworten: Die Antwort geht per Mail an die Portal-Adresse (Reply-To auf das erste aktive Vermietungs-Postfach) und erscheint im Portal unter „Ihre Nachrichten“ sowie im Verlauf des Mietverhältnisses.

**Löschen im Posteingang** legt eine Mail in den Papierkorb (Reiter „Papierkorb“), von dort lässt sie sich wiederherstellen. Gelöschte Mails fehlen in Liste, Zählern und Verläufen, bleiben aber gespeichert (Tabelle `nachricht_loeschungen`, append-only): Der Abruf erkennt bereits geholte Mails an ihrer Prüfsumme, eine wirklich entfernte Mail käme beim nächsten Abruf zurück. Im Postfach beim Mailanbieter ändert sich nichts.

**Menü:** fünf Bereiche (Übersicht, Posteingang, Tickets, Finanzen, Abschluss & Steuer). Die Übersicht zeigt Häuser und Eigentumswohnungen und legt sie an („Haus anlegen“, „Eigentumswohnung anlegen“); `/objekte` leitet dorthin. Verwandte Seiten stehen als Reiter oben auf der Seite: Übersicht · Mieter · Dokumente, Tickets · Handwerker, Belege · Journal · Betriebskosten, Jahresabschluss · Steuer. Unten in der Seitenleiste führt der eigene Name zu den Einstellungen: Profil (Sicherheit, Datenschutz, Eigentümerschaft wechseln, Abmelden) · Eigentümer · Zugänge · Postfächer · Referenzdaten. Die Adressen sind unverändert.

**Löschen** von Haus/Eigentumswohnung, Einheit und Mietverhältnis steht eingeklappt am Ende der jeweiligen Seite (Akte, Einheit bearbeiten, Mietverhältnisse der Einheit) und braucht einen Haken zur Bestätigung. Es geht von unten nach oben: erst Mietverhältnisse, dann Einheiten, dann das Haus. Hängt noch etwas daran (Buchungen, Tickets, Dokumente, Zähler, Betriebskostenabrechnungen, Steuerpakete, Darlehen, Portal-Zugänge, Mails), nennt die Seite es, und Löschen ist gesperrt. Gedacht ist Löschen für Fehleingaben; ein echtes Mietverhältnis mit Verlauf wird beendet (Mietende), nicht gelöscht. Gelöscht wird per Storno aller Versionen (`packages/db/src/loeschen.ts`): Der Eintrag verschwindet aus allen Listen, das Ledger behält ihn mit Zeitpunkt, Person und Grund. Mit dem Mietverhältnis gehen seine Konditionen und die Personen der Mietpartei, mit dem Haus Notfallkarte und Wissensbasis.
