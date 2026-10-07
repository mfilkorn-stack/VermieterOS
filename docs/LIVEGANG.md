# Erster Livegang

Checkliste für das erste Produktiv-Deployment. Die Einzelheiten stehen in [BETRIEB.md](BETRIEB.md), hier nur Reihenfolge und Abnahme. Jeder Schritt ist erledigt, wenn sein Prüfpunkt stimmt.

## 1 · Vorbedingungen im Repository

- [x] WP 2.5 bis 2.7, Livegang-Vorbereitung und Domain sind in `main`
- [ ] CI auf `main` grün, Job „images“ hat beide Images veröffentlicht
- [ ] Tag notieren: GitHub → Packages → `vermieteros` → `sha-<kurz>` des letzten Merge-Commits

## 2 · Entscheidungen vorab

| Frage            | Empfehlung                                                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain           | `www.vermieteros.app` für die App, `vermieteros.app` leitet dorthin um (`DOMAIN_UMLEITUNG`); Mails von `noreply@vermieteros.app`                                    |
| Wer registriert  | Nur die eigene Adresse in `REGISTRIERUNG_ERLAUBT`; alle anderen kommen per Einladung                                                                                |
| KI               | Zum Start aus (`ANTHROPIC_API_KEY` leer). Erst einschalten, wenn der Auftragsverarbeitungsvertrag mit Anthropic abgeschlossen ist (BETRIEB „KI-Schlüssel“)          |
| Backup-Schlüssel | Restore-Test vom eigenen Rechner statt Schlüssel auf dem Server, wenn der Server möglichst wenig wissen soll; sonst Kopie unter `geheim/backup.key` (BETRIEB, oben) |

## 3 · Geheimnisse erzeugen (eigener Rechner)

Alles sofort in den Passwortmanager, den Backup-Schlüssel zusätzlich ausgedruckt an einen zweiten Ort.

```sh
age-keygen -o vermieteros-backup.key          # Zeile "public key: age1…" → BACKUP_EMPFAENGER
openssl rand -base64 32                       # BETTER_AUTH_SECRET
openssl rand -base64 32                       # POSTFACH_SCHLUESSEL
for v in POSTGRES VOS_OWNER VOS_APP VOS_WORKER VOS_SICHERUNG; do
  echo "${v}_PASSWORT=$(openssl rand -hex 24)"
done
```

- [ ] Backup-Schlüssel offline an zwei Orten
- [ ] Sieben Werte im Passwortmanager

## 4 · Hetzner

- [ ] Projekt anlegen
- [ ] Object Storage, Standort wie der Server (z. B. `fsn1`): Bucket `…-dokumente` und Bucket `…-backup`, je ein eigener Zugangsschlüssel. Endpoint notieren
- [ ] Cloud-Firewall: eingehend 22/TCP nur von der eigenen IP, 80/TCP, 443/TCP und 443/UDP
- [ ] Server: Ubuntu 24.04, x86, 4 GB RAM, Standort wie Object Storage, Firewall zuweisen, Hetzner-Backups an
- [ ] „Cloud config“: Inhalt von `ops/cloud-init.yml`, eigener SSH-Public-Key eingetragen
- [ ] Prüfpunkt: `ssh betrieb@<server-ip>` klappt, `ssh root@…` und Passwort-Login werden abgewiesen, `docker compose version` läuft

## 5 · DNS

- [ ] A- und AAAA-Eintrag für `www.vermieteros.app` und für `vermieteros.app` auf den Server, TTL 300
- [ ] Keine Weiterleitung beim Registrar einrichten: `.app` erzwingt HTTPS (HSTS-Preload), das Zertifikat für beide Namen holt Caddy
- [ ] Prüfpunkt: `dig +short www.vermieteros.app` und `dig +short vermieteros.app` liefern die Server-IP. Erst dann deployen, sonst scheitert das Zertifikat

## 6 · Mailversand: im MVP ausgelassen

Der erste Livegang läuft ohne Mailversand: `SMTP_HOST` bleibt leer. Was das bedeutet:

| Funktion                            | ohne Mailversand                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Registrieren, Anmelden, 2FA         | geht; die E-Mail-Adresse bleibt unbestätigt                                                                  |
| Objekte, Belege, Abrechnung, Steuer | geht vollständig                                                                                             |
| Einladungen in den Mandanten        | gehen nicht: Annehmen verlangt eine bestätigte Adresse. Miteigentümer und Steuerberater erst mit Mailversand |
| Mieterportal                        | Einladungslink erscheint in der App zum persönlichen Weitergeben                                             |
| BK-Abrechnung an Mieter             | PDF herunterladen und per Post oder eigener Mail schicken, Versand in der App vermerken                      |

Nachholen, sobald es gebraucht wird (geplant über IONOS):

- [ ] Postfach `noreply@vermieteros.app` im IONOS-Kundenbereich anlegen (E-Mail → E-Mail-Adresse erstellen), Weiterleitung an die eigene Adresse, damit Antworten von Mietern ankommen
- [ ] DNS bei IONOS: MX (setzt IONOS selbst), genau ein SPF-Eintrag mit IONOS-Include, DKIM in den E-Mail-Einstellungen aktivieren, DMARC `v=DMARC1; p=none; rua=mailto:noreply@vermieteros.app` auf `_dmarc`
- [ ] `.env`: `SMTP_HOST=smtp.ionos.de`, `SMTP_PORT=587`, `SMTP_BENUTZER=noreply@vermieteros.app`, `SMTP_PASSWORT=<Postfach-Passwort>`, dann `docker compose up -d web`
- [ ] Prüfpunkt: unter „Sicherheit“ die eigene Adresse bestätigen; die Mail kommt an, Header zeigt `spf=pass` und `dkim=pass`

## 7 · Monitoring

- [ ] healthchecks.io: vier Checks `backup` (täglich, 2 h Karenz), `integritaet` (täglich, 2 h), `restore` (monatlich, 1 Tag), `abruf` (Intervall des Mail-Abrufs, 30 min)
- [ ] Uptime-Check auf `https://www.vermieteros.app/api/gesund` (z. B. im selben Dienst oder UptimeRobot)
- [ ] Alarm an Mail und Handy

## 8 · Server einrichten

```sh
scp ops/{compose.yml,Caddyfile,postgres-init.sh,deploy.sh,env.beispiel} betrieb@<server>:/srv/vermieteros/
ssh betrieb@<server>
cd /srv/vermieteros
cp env.beispiel .env && chmod 600 .env && nano .env
sudo install -d -o 70 -g 70 -m 700 geheim
# nur wenn der Restore-Test auf dem Server laufen soll:
sudo install -o 70 -g 70 -m 400 vermieteros-backup.key geheim/backup.key
docker login ghcr.io -u <github-nutzer>       # Token (classic) nur mit read:packages
```

`.env` vollständig: `DOMAIN=www.vermieteros.app`, `DOMAIN_UMLEITUNG=vermieteros.app`, sieben Geheimnisse aus Schritt 3, `REGISTRIERUNG_ERLAUBT`, beide S3-Zugänge mit Endpoint und Region, `BACKUP_EMPFAENGER`, vier Healthcheck-URLs. `ANTHROPIC_API_KEY` und `SMTP_HOST` bleiben leer.

- [ ] Prüfpunkt: `docker compose config -q` ohne Fehler (meldet fehlende Pflichtwerte)

## 9 · Erstes Deployment

```sh
./deploy.sh sha-<kurz> --ohne-backup
docker compose ps                              # alle Dienste "running" bzw. "healthy"
docker compose logs --tail 50 web worker ops caddy
```

- [ ] Prüfpunkt: `https://www.vermieteros.app/login` lädt mit gültigem Zertifikat, `/api/gesund` antwortet 200, `https://vermieteros.app` leitet auf `https://www.vermieteros.app` um

## 10 · Abnahme

Mit Musterdaten, noch ohne echte Mieter:

- [ ] Registrieren mit der freigegebenen Adresse (ohne Mailversand bleibt sie unbestätigt, das ist im MVP so gewollt)
- [ ] Registrieren mit einer anderen Adresse wird abgewiesen
- [ ] Zwei-Faktor einrichten, ab- und wieder anmelden
- [ ] Mandant und Musterobjekt anlegen, Dokument hochladen und wieder herunterladen (Object Storage)
- [ ] Mieterportal-Einladung an eine eigene Zweitadresse: Link aus der App kopieren, im privaten Fenster öffnen, Anmeldung klappt
- [ ] Backup von Hand: `docker compose run --rm ops backup`, dann `docker compose run --rm ops integritaet`; im Backup-Bucket liegt eine `.age`-Datei
- [ ] Restore-Test einmal von Hand (BETRIEB „Von Hand sichern und prüfen“)
- [ ] Alle Healthchecks grün; einen absichtlich ausbleiben lassen und den Alarm prüfen
- [ ] Server-Neustart (`sudo reboot`): alle Dienste kommen von selbst wieder

## 11 · Danach

- Musterdaten-Mandant behalten oder stehen lassen; echte Daten in einem neuen Mandanten
- Mailversand nachholen (Schritt 6), danach Miteigentümer und Steuerberater einladen (Mitglieder), Rollen prüfen
- Postfach für den Posteingang und eine Beleg-Adresse verbinden (ohne KI läuft alles bis auf die Vorschläge)
- KI einschalten erst nach Auftragsverarbeitungsvertrag; vorher `KI_MODELL` nur mit bestandenem Golden-Set
- Updates: `./deploy.sh sha-<neu>` (sichert vorher automatisch)
