# Vermieter.OS

Eine eigene Verwaltungssoftware für private Vermieter. Kommunikation, Belege, Dokumente, Nebenkosten, Steuer, Mieterhöhung und Finanzen an einem Ort, auf einem versionierten, manipulationssicheren Datenfundament, mit KI als Assistent, die vorschlägt und nie selbst entscheidet.

- **Architekturplan** (das _Was_ und _Warum_): `docs/architektur/Vermieter.OS-Architektur_v1.1.pdf`
- **Umsetzungsplan** (das _Wie_ und _Wann_): [`docs/PLAN.md`](docs/PLAN.md)
- **Entscheidungen:** [`docs/adr/`](docs/adr/) · **Fachbegriffe:** [`docs/GLOSSAR.md`](docs/GLOSSAR.md)
- **Betrieb:** [`docs/BETRIEB.md`](docs/BETRIEB.md) · **Erster Livegang:** [`docs/LIVEGANG.md`](docs/LIVEGANG.md)
- **Vorschau** (Rundgang mit Musterdaten, nach jedem Merge auf `main` neu): https://mfilkorn-stack.github.io/VermieterOS/

## Stand

| Phase | Inhalt                         | Stand                                    |
| ----- | ------------------------------ | ---------------------------------------- |
| 0     | Fundament                      | fertig                                   |
| 1     | Kommunikation und Belegeingang | fertig                                   |
| 2     | Nebenkosten und Steuerpaket    | fertig (WP 2.3 bewusst entfallen)        |
| –     | Erster Livegang auf Hetzner    | vorbereitet, Checkliste in `LIVEGANG.md` |
| 3     | Mieterhöhung                   | offen                                    |
| 4     | Finanzen                       | offen                                    |
| 5     | Ausbau                         | offen                                    |

## Was die Software heute kann

### Fundament (Phase 0)

Alle Stammdaten sind versioniert mit zwei Zeitachsen (gültig ab, erfasst am) und Herkunft je Feld; korrigiert wird per Storno, nie per Überschreiben. Jede Änderung steht als Ereignis in einem Ledger mit Hash-Kette, eine nächtliche Prüfung erkennt Manipulation. Mandanten (Eigentümergemeinschaften) sind per Row-Level-Security in der Datenbank getrennt. Anmeldung mit Pflicht zur Zwei-Faktor-Authentifizierung, Rollen Eigentümer, Miteigentümer, Mitverwalter und Steuerberater (nur lesen und exportieren). Konten entstehen in Produktion nur per Einladung oder für freigegebene Adressen. Ein Onboarding-Assistent erfasst je Objekt Kauf, Grundbuch, Einheiten, Mietverhältnisse, Konditionen und AfA; eine Ampel zeigt die Vollständigkeit. Referenzdaten (Grunderwerbsteuer je Land) tragen eine Gültigkeit und warnen bei Ablauf. Betrieb auf einem Hetzner-Server mit Docker Compose, täglichem verschlüsseltem Backup, monatlichem Restore-Test und Totmannschaltern.

### Kommunikation und Belege (Phase 1)

- **Posteingang:** IMAP-Abruf beliebiger Postfächer im Worker, automatische Zuordnung zu Mietverhältnissen, Verlauf je Mietverhältnis mit Telefonnotizen.
- **KI-Assistent:** Sortierung nach Kategorie, Dringlichkeit und Frist sowie Antwortentwürfe. Jeder Vorschlag ist versioniert und wird geprüft; Fakten mit Fundstelle werden gegen das Dokument abgeglichen. Ohne API-Schlüssel läuft alles außer den Vorschlägen.
- **Betrieb am Objekt:** Handwerkerverzeichnis, Notfallkarte, Wissensbasis und Tickets von der Meldung bis zum Termin.
- **Dokumente:** Upload mit Prüfsumme, Typ, Gültigkeit und Ersetzen. Die KI liest Mietverträge aus, und die Werte werden mit Seitenangabe in die Stammdaten übernommen.
- **Belege und Journal:** Sammel-Upload oder eigene Beleg-Adresse, KI-Auslesung, Buchung mit Steuerkategorie, Kostenart nach BetrKV und Aufteilung auf Objekte. Fortlaufende Belegnummern, append-only, Korrektur per Storno.
- **Standardschreiben** als PDF (DIN 5008): Wohnungsgeberbestätigung, Mietschuldenfreiheit, Vermieterbescheinigung.
- **Mieterportal** ohne Passwort per Einmal-Link: Vertrag, Notfallkarte, Mängel mit Foto melden, Nachrichten, Abrechnungen.
- **Mailversand** über SMTP, anbieterneutral (z. B. Brevo).

### Nebenkosten und Steuer (Phase 2)

- **Betriebskostenabrechnung je Einheit und Jahr:** Kosten aus der WEG-Abrechnung mit Verteilerschlüsseln je Position. Die Heizkosten kommen vom Messdienst, der CO2-Anteil des Vermieters wird nach CO2KostAufG nachgerechnet und abgezogen. Zeitanteile nach Monaten, Leerstand, Lohnanteil § 35a.
- **Prüfung, Festschreibung, Versand:** Die Prüfung läuft nach Regeln (Frist, fehlende Positionen, Vorjahresvergleich). Festgeschrieben entsteht ein PDF mit Anschreiben, optional mit neuer Vorauszahlung nach § 560 BGB. Versand per Mail, Post oder Portal. Gegen echte Abrechnungen auf den Cent nachgerechnet.
- **Frist-Wächter** nach § 556 Abs. 3 BGB: Warnung ab Monat 9, Eskalation ab Monat 11.
- **Steuerpaket je Objekt und Jahr:** Einkünfte aus Vermietung als Vorbereitung der Anlage V. Dazu gehören AfA, Zinsen laut Bescheinigung, Erhaltungsaufwand sofort oder verteilt (§ 82b EStDV) und Hausgeld nach BFH. Ein 15-%-Wächter prüft die anschaffungsnahen Herstellungskosten. Das Ergebnis wird auf die Miteigentümer aufgeteilt, auf den Cent genau.
- **Paket für den Steuerberater:** Festgeschrieben entsteht ein ZIP mit Übersicht als PDF, Journal als CSV, nummerierten Belegen, Prüfprotokoll und SHA-256-Manifest.
- **Jahresabschluss:** Checkliste je Objekt (Belege, Grundsteuer, Hausgeld- und Zinsbescheinigung, Abrechnung versendet, Steuerpaket) mit Links zum Erledigen. Im laufenden Jahr dient sie als Vollständigkeits-Wächter.

## Was noch kommt

**Erster Livegang:** Server, Object Storage, Domain, Mailversand und Monitoring nach [`docs/LIVEGANG.md`](docs/LIVEGANG.md). Danach echte Daten in einem eigenen Mandanten; die KI bleibt aus, bis der Auftragsverarbeitungsvertrag mit Anthropic steht.

**Phase 3 · Mieterhöhung:**

- Rechenkern für Sperrfrist, Kappungsgrenze, Index- und Staffelmiete, Modernisierung sowie Zustimmungs- und Wirkungsfristen
- Mietspiegel, Kappungsgebiete und VPI als versionierte Referenzdaten
- Workflow mit harten Schranken, Anschreiben und Berechnungsblatt
- juristische Prüfung der Vorlagen

**Phase 4 · Finanzen:**

- Portierung des Finanz-Rechenkerns aus der Ankaufsprüfung
- Bestandskennzahlen (Rendite, Cashflow, Miete je m² gegenüber dem Mietspiegel) aus dem Journal
- Restschuldverlauf und Radar für die Anschlussfinanzierung
- Bank-Import (CAMT/CSV) mit Abgleich gegen die Sollmieten; damit ersetzen Ist-Mieten das Soll im Steuerpaket
- offene Posten, Mahnschreiben, Kautionskonto

**Phase 5 · Ausbau:**

- Zählerstand per Foto im Portal
- WhatsApp Business
- Ankaufsprüfung als Modul mit Übergang in den Bestand
- semantische Suche
- E-Signatur und Neuvermietung
- DATEV-Export nur auf Bedarf

Vorerst zurückgestellt: eigene Zählererfassung und Heizkostenverteilung nach HeizKV (WP 2.3), erst wenn ein Haus ohne Messdienst abgerechnet wird.

## Entwicklung

```bash
pnpm install
docker compose up -d            # Postgres, Redis, S3, GreenMail (Mail), Gotenberg
cp .env.example .env            # POSTFACH_SCHLUESSEL setzen: openssl rand -base64 32
pnpm db:migrate                 # Migrationen als Besitzerrolle
pnpm dev                        # http://localhost:3000
pnpm --filter @vermieteros/worker start   # Mail-Abruf (DATABASE_URL mit Rolle vermieteros_worker)
```

Erster Start: `/registrieren`, dann Zwei-Faktor einrichten, dann Mandant anlegen. Lokal ist die Registrierung offen; Mails gehen an GreenMail (SMTP 3025, lesen per IMAP 3143) oder stehen ohne `SMTP_HOST` im Server-Log.

Tests brauchen eine erreichbare PostgreSQL-Instanz (`TEST_DATABASE_URL`, Standard: lokales Docker) und für Mail und Dokumente GreenMail und S3:

```bash
ops/testdienste.sh              # GreenMail (3025/3143) und S3 (9100) für Tests
pnpm typecheck
pnpm test
```

End-to-End-Tests (Playwright, baut und startet die App auf Port 3100 gegen eine eigene Datenbank `vermieteros_e2e`):

```bash
pnpm --filter @vermieteros/web exec playwright install chromium   # einmalig
E2E_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/vermieteros_e2e \
  pnpm --filter @vermieteros/web e2e
```

Vorschau-Rundgang lokal (Bilder und `index.html` in `apps/web/vorschau-ausgabe/`):

```bash
ops/testdienste.sh
E2E_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/vermieteros_e2e \
  pnpm --filter @vermieteros/web vorschau
```

Testdaten sind immer synthetisch (Musterobjekt, PLZ 99999); echte Namen, Adressen oder Kontodaten gehören nicht ins Repository.

## Struktur

```
apps/web             Next.js, Better Auth, UI, Mieterportal
apps/worker          Hintergrundprozess: Mail-Abruf, KI-Sortierung, Belege auslesen
packages/db          Drizzle-Schema, Migrationen, Ledger-Kern, RLS, Lesefunktionen
packages/schema      Zod-Schemas, einzige Typquelle
packages/rechenkern  reine Rechenlogik: Geld, Verteilung, AfA, Nebenkosten, Heizkosten/CO2,
                     Fristen, Anlage V, Jahresabschluss, Datenqualität
packages/ki          Anthropic-Client, Kontext-Builder, Aufgaben, Prüfungen, Golden-Set
packages/pdf         Briefe nach DIN 5008: Standardschreiben, BK-Abrechnung, Steuerübersicht
packages/post        Mail-Eingang: IMAP, Ablage im Object Storage, Zuordnung, Verschlüsselung
ops/                 Betrieb: Images, Compose, Caddy, Backup, Restore, Probe, cloud-init
docs/                Plan, ADRs, Glossar, Architekturplan, Betrieb, Livegang
```
