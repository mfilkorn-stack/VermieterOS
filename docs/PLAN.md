# Vermieter.OS · Umsetzungsplan

Software-Plan 1.0 · Stand 06.10.2026 · setzt den Architekturplan Fassung 1.1 (`docs/architektur/`) in konkrete Bauschritte um.

Der Architekturplan sagt, _was_ gebaut wird und _warum_. Dieses Dokument sagt, _wie_ und _in welcher Reihenfolge_, bis auf die Ebene von Tabellen, Paketen und Arbeitspaketen. Wo der Architekturplan Spielraum ließ, wurden Entscheidungen getroffen; sie stehen in Kapitel 1 und als ADR unter `docs/adr/`.

---

## 1 Getroffene Entscheidungen

| Nr  | Entscheidung                                                                                                                                                                                                                                                  | Kurzbegründung                                                                                  | ADR           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------- |
| 1   | **Ein Monolith auf Hetzner**, selbst gehostet. Next.js (UI + Server) und ein Worker-Prozess aus demselben Code, ein Docker-Image, zwei Container. Kein Supabase, kein US-Backend.                                                                             | Leitprinzip 1 (Datenhoheit) und 5 (Zurückhaltung). Ein Deployment, ein Sprachraum.              | 0001          |
| 2   | **Mandant = Eigentümerschaft.** Jede Eigentümerschaft (allein, Ehepaar, Bruchteilsgemeinschaft, GbR) ist ein eigener Mandant mit eigenen Objekten, Handwerkern, Journal. Ein Nutzer kann Mitglied mehrerer Mandanten sein.                                    | Saubere RLS-Grenze, saubere Steueraufteilung nach Anteilen, kein Sonderfall „geteiltes Objekt“. | 0002          |
| 3   | **Entitäts-Versionen mit Feld-Herkunft** statt generischer Feld-Historie. Pro Entität eine Identitätstabelle und eine append-only Versionstabelle mit zwei Zeitachsen (`gueltig_ab`, `erfasst_am`). Herkunft pro geändertem Feld als JSON an der Version.     | Typsicher, abfragbar, beantwortet „welche Wohnfläche galt 2025“ exakt, ohne Pivot-Hölle.        | 0003          |
| 4   | **Better Auth** im Next.js-Prozess. Organizations-Plugin bildet Mandanten ab, TOTP-2FA für Vermieter, Magic-Link für Mieter und Handwerker.                                                                                                                   | Kein zusätzlicher Dienst, gleiche Datenbank, gleiche Typen.                                     | 0004          |
| 5   | **KI ist eine zustandslose Funktion** hinter einem Kontext-Builder. Jede Ausgabe trägt einen Versionsstempel (Ledger-Sequenz, Dokument-Prüfsummen, Prompt-Version, Modell). Fakten setzt der Code ein.                                                        | Kapitel 6 des Architekturplans, acht Regeln, im Code verankert.                                 | 0005          |
| 6   | **Code-Sprache:** technische Begriffe Englisch, Fachbegriffe Deutsch und unübersetzt (`mietverhaeltnis`, `vorauszahlung`, `umlagefaehig`). Verbindlich ist `docs/GLOSSAR.md`.                                                                                 | Fachbegriffe haben rechtliche Bedeutung; eine Übersetzung erzeugt zwei Wahrheiten.              | 0006          |
| 7   | **Geld als Integer-Cent**, nie als Float. Daten als ISO-Datum (`date`), Zeitpunkte als `timestamptz`. IDs als UUID v7.                                                                                                                                        | Rechenkern muss auf den Cent reproduzierbar sein.                                               | im Rechenkern |
| 8   | **Referenzdaten mit Prüffrist.** Externe Werte stehen versioniert in `referenzdaten`, mit Gültigkeit, Quelle und Prüffrist. Ein überfälliger oder ausgelaufener Wert erzeugt eine Warnung. AfA-Sätze bleiben im Rechenkern.                                   | Kein stilles Weiterrechnen mit veralteten Werten, keine zweite Wahrheit für Gesetzesregeln.     | 0007          |
| 9   | **Betrieb ohne Coolify:** Docker Compose und Caddy auf einem Hetzner-Server, Images aus CI über GHCR. Backup verschlüsselt ins Object Storage, Manifest der Kettenköpfe als externer Anker, Restore-Test und Integritätsprüfung im eigenen Ops-Image.         | Weniger Angriffsfläche und bewegliche Teile; alles im Repository und in CI geprüft.             | 0008          |
| 10  | **Mail-Eingang ohne Queue:** Worker als Schleife, eigene Rolle `vermieteros_worker`, Postfach nur lesen, Mails und Anhänge inhaltsadressiert im Object Storage, Zuordnung „lieber offen als falsch“. BullMQ/Redis erst mit asynchronen Aufträgen aus der App. | Ein Dienst weniger; keine falsch zugeordneten Mails; Postfach des Vermieters bleibt unberührt.  | 0009          |

---

## 2 Architektur

### 2.1 Laufzeitbild

```
                       ┌──────────────────────────────────────────────────────┐
  E-Mail (IMAP)  ──┐   │  vermieteros-web   (Next.js, App Router, Node 22)    │
  Mieterportal   ──┼──▶│  UI · Server Actions · Route Handler · Better Auth    │
  Upload/belege@ ──┘   │  liest/schreibt nur über packages/db (RLS aktiv)      │
                       └───────────────┬──────────────────────────────────────┘
                                       │ BullMQ-Jobs (Redis)
                       ┌───────────────▼──────────────────────────────────────┐
                       │  vermieteros-worker (gleiches Image, anderer Entry)   │
                       │  Mail-Abruf · KI-Aufträge · PDF (Gotenberg) ·         │
                       │  Erinnerungen · Suchindex · Integritätsprüfung ·      │
                       │  Backup-Verifikation                                  │
                       └───────────────┬──────────────────────────────────────┘
                                       │
   ┌──────────────┐   ┌────────────────▼───────────┐   ┌────────────────────┐
   │ Redis        │   │ PostgreSQL 16              │   │ Object Storage     │
   │ Queues, Rate │   │ RLS · Ledger · Versionen   │   │ Hetzner S3 (prod)  │
   │ Limits       │   │ Volltext (später pgvector) │   │ MinIO (lokal)      │
   └──────────────┘   └────────────────────────────┘   └────────────────────┘

   Externe Dienste: Claude API (Anthropic SDK) · Gotenberg (Container) · Whisper (Container, später)
   Betrieb: Hetzner Cloud · Docker Compose · Caddy (TLS) · Backup verschlüsselt ins Object Storage
```

Ein Image, zwei Startbefehle (`web`, `worker`). Der Worker ist kein eigener Dienst mit eigener Logik, er führt dieselben Paket-Funktionen aus, nur asynchron. Backup, Restore-Test und Integritätsprüfung laufen nicht im Worker, sondern im eigenen Ops-Image mit Postgres-Werkzeugen (ADR 0008).

### 2.2 Pakete

| Paket                 | Inhalt                                                                                                                                                                                 | Darf abhängen von                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `packages/schema`     | Zod-Schemas und TypeScript-Typen aller Fachobjekte. Einzige Typquelle für Formulare, API, KI-Ausgaben, Import.                                                                         | nichts                                   |
| `packages/rechenkern` | Reine, getestete Rechenlogik: Geld, Verteilung, Nebenkosten, HeizKV, Mieterhöhung, Rendite/Cashflow/IRR, AfA, 15-%-Grenze. Keine DB, keine IO.                                         | `schema`                                 |
| `packages/db`         | Drizzle-Schema, SQL-Migrationen (Trigger, RLS, Funktionen), Ledger-Kern (`schreibeVersion`, `storniere`, `festschreiben`), Sichten „aktuell“ und „Stand zum Datum“, Mandanten-Kontext. | `schema`                                 |
| `packages/ki`         | Kontext-Builder, Prompt-Register mit Versionen, Anthropic-Client, Vorschlags-Typen, Versionsstempel, Golden-Set-Tests.                                                                 | `schema`, `db` (nur lesend über Sichten) |
| `packages/pdf`        | HTML-Vorlagen (Nebenkostenabrechnung, Mieterhöhung, Standardschreiben), Gotenberg-Client, Prüfsumme pro PDF.                                                                           | `schema`, `rechenkern`                   |
| `packages/export`     | Steuerpaket: ExcelJS, CSV, ZIP mit Prüfsummenliste und Prüfprotokoll.                                                                                                                  | `schema`, `db`, `rechenkern`             |
| `apps/web`            | Next.js, Better Auth, UI, Server Actions. Keine Fachlogik, nur Orchestrierung.                                                                                                         | alle                                     |
| `apps/worker`         | Hintergrundprozess: Mail-Abruf als Schleife (ADR 0009); Queue erst mit asynchronen Aufträgen aus der App.                                                                              | alle                                     |

Regel: **Fachlogik lebt in Paketen, nie in `apps/`.** Ein Server Action ruft `rechenkern`, `db`, `ki`, mehr nicht.

### 2.3 Schreibpfad (gilt für jede Änderung)

1. Eingabe (Formular, Import, KI-Vorschlag) wird gegen das Zod-Schema validiert.
2. Mensch bestätigt. Bei Korrektur eines bestehenden Werts ist eine Begründung Pflicht.
3. `db.ledger.schreibeVersion()` öffnet eine Transaktion, setzt `app.mandant_id`, fügt die neue Version ein und schreibt ein Ereignis mit Hash. Beides oder nichts.
4. Sichten („aktuell“, „Stand zum Datum“) leiten den Lesestand ab. Nichts anderes liest die Versionstabellen direkt.
5. Nachgelagert: Suchindex-Job, Fristen-Neuberechnung, Folgen-Hinweis bei betroffenen Festschreibungen.

---

## 3 Datenfundament

### 3.1 Mandantentrennung

Jede fachliche Tabelle trägt `mandant_id`. PostgreSQL Row-Level-Security ist auf allen Tabellen aktiv und erzwungen (`FORCE ROW LEVEL SECURITY`), die Policy lautet überall `mandant_id = current_setting('app.mandant_id')::uuid`. Die Anwendung verbindet sich als Rolle `vermieteros_app` ohne `BYPASSRLS` und ohne Tabellenbesitz. Pro Request wird in einer Transaktion `set_config('app.mandant_id', …, true)` gesetzt; ohne gesetzten Wert liefert jede Abfrage null Zeilen. Migrationen laufen als Besitzerrolle `vermieteros_owner`.

Better Auth verwaltet `user`, `session`, `organization`, `member`, `invitation`. Eine `organization` **ist** der Mandant; die Tabelle `mandanten` ergänzt die fachlichen Attribute (Art der Eigentümerschaft, Anteile der Mitglieder, Steuernummer). Rollen pro Mitgliedschaft: `eigentuemer`, `miteigentuemer`, `mitverwalter`, `steuerberater` (nur lesen plus Export). Mieter und Handwerker sind keine Mitglieder, sondern Portal-Identitäten mit Magic-Link auf genau ein Mietverhältnis bzw. einen Auftrag.

### 3.2 Ledger

Tabelle `ereignisse`, append-only, eine Zeile pro fachlicher Änderung:

| Spalte                                  | Bedeutung                                                                                                  |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `id`                                    | UUID v7                                                                                                    |
| `mandant_id`                            | Mandant                                                                                                    |
| `seq`                                   | fortlaufende Nummer pro Mandant, lückenlos                                                                 |
| `typ`                                   | `version_angelegt`, `version_storniert`, `festschreibung`, `dokument_abgelegt`, `ki_vorschlag`, `login`, … |
| `entitaet`, `entitaet_id`, `version_id` | worauf sich das Ereignis bezieht                                                                           |
| `akteur_id`, `akteur_art`               | Nutzer, System-Job, Portal-Identität                                                                       |
| `erfasst_am`                            | Zeitpunkt, von der Datenbank gesetzt                                                                       |
| `payload`                               | JSON, fachlicher Inhalt                                                                                    |
| `prev_hash`, `hash`                     | SHA-256-Kette pro Mandant                                                                                  |

Der Hash wird **im Datenbank-Trigger** berechnet, nicht in der Anwendung: `hash = sha256(prev_hash ‖ mandant_id ‖ seq ‖ typ ‖ entitaet ‖ entitaet_id ‖ version_id ‖ akteur_id ‖ erfasst_am ‖ payload::text)`. Damit fällt jede Manipulation auf, auch eine direkt per SQL. Ein Advisory-Lock pro Mandant serialisiert das Anhängen. `UPDATE` und `DELETE` sind doppelt blockiert: per fehlendem Recht der App-Rolle und per Trigger, der eine Exception wirft.

Ein nächtlicher Job rechnet die Kette jedes Mandanten nach, vergleicht Suchindex mit Ledger und meldet Abweichungen als Aufgabe an den Eigentümer.

### 3.3 Versionsmuster

Jede versionierte Entität besteht aus zwei Tabellen. Beispiel Objekt:

```
objekte                          objekt_versionen
  id            uuid PK            id             uuid PK
  mandant_id    uuid               objekt_id      uuid FK
  erstellt_am   timestamptz        mandant_id     uuid
                                   version_nr     int           fortlaufend pro Objekt
                                   gueltig_ab     date          fachliche Zeitachse
                                   erfasst_am     timestamptz   technische Zeitachse
                                   erfasst_von    uuid
                                   ereignis_id    uuid FK → ereignisse
                                   begruendung    text          Pflicht ab version_nr > 1
                                   herkunft       jsonb         { feld: { quelle, dokument_id, seite, hinweis } }
                                   storniert_am   timestamptz   null = gültig
                                   -- Fachfelder:
                                   bezeichnung, strasse, plz, ort, art (haus|etw), baujahr,
                                   anschaffungsdatum, kaufpreis_cent, nebenkosten_cent,
                                   gebaeudeanteil_promille, afa_satz_promille, afa_beginn, …
```

Zwei abgeleitete Sichten pro Entität:

- `objekte_aktuell`: pro Objekt die Version mit größtem `gueltig_ab ≤ heute`, bei Gleichstand die zuletzt erfasste, nicht storniert.
- `objekt_stand(objekt_id, stichtag date, erfasst_bis timestamptz)`: gleiche Logik, aber beide Zeitachsen frei wählbar. Beantwortet „Was wussten wir am 12. April über die Wohnfläche zum 1. März?“. Das ist die Funktion, die Festschreibungen reproduzierbar macht.

**Herkunft** wird nur für Felder gespeichert, die sich in dieser Version geändert haben. Erlaubte Quellen: `manuell`, `dokument` (mit `dokument_id`, `seite`), `bank_csv` (mit `import_id`, `zeile`), `kalkulation` (mit `fall_id`), `ki_vorschlag` (mit `vorschlag_id`; nur nach Bestätigung, dann Quelle = das zugrunde liegende Dokument).

**Storno statt Löschen:** `storniert_am` wird gesetzt, ein Ereignis `version_storniert` geschrieben. Die stornierte Version bleibt lesbar, fällt aber aus allen Sichten.

### 3.4 Festschreibung und Folgen-Hinweis

Tabelle `festschreibungen`: `typ` (`nebenkostenabrechnung`, `mieterhoehung`, `steuerpaket`), `bezug_id`, `zeitraum_von/bis`, `ledger_seq` (Stand des Ledgers zum Zeitpunkt), `erfasst_bis` (technische Zeitachse für `*_stand`), `rechenkern_version`, `eingabe_snapshot` (JSON aller Eingangswerte), `ausgabe_hash` (SHA-256 des PDF/ZIP). Reproduktion heißt: `*_stand(…, erfasst_bis)` liefert dieselben Eingaben, derselbe Rechenkern liefert dieselbe Ausgabe, der Hash stimmt.

Folgen-Hinweis: Nach jeder neuen Version prüft ein Job, ob eine Festschreibung existiert, deren Zeitraum `gueltig_ab` überdeckt und deren Entität betroffen ist. Trifft das zu, entsteht eine Aufgabe „Betrifft versandte Abrechnung 2025, Korrektur prüfen“. Es wird nichts still neu gerechnet.

### 3.5 Entitäten-Katalog Phase 0

| Entität                     | Versioniert                   | Kernfelder                                                                                                                                                                                 | Hinweise                                                                                |
| --------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `mandanten`                 | nein (Stammsatz)              | art, steuernummer, anteile[]                                                                                                                                                               | 1:1 zu Better-Auth-Organization                                                         |
| `personen`                  | ja                            | name, anschrift, kontakt, rolle (mieter, miteigentuemer, kontakt)                                                                                                                          | Personen hängen am Mandanten, nicht am Mietverhältnis                                   |
| `objekte`                   | ja                            | siehe 3.3, plus WEG-Flag und Hausgeld-Bezug                                                                                                                                                | ETW werden gesondert behandelt                                                          |
| `einheiten`                 | ja                            | objekt_id, bezeichnung, lage, wohnflaeche_qm (×100), miteigentumsanteil, zimmer, einheitentyp                                                                                              | Flächen als Integer in Hundertstel-m²                                                   |
| `mietverhaeltnisse`         | ja                            | einheit_id, mieter_ids[], beginn, ende, kaution_cent, kuendigungsfrist                                                                                                                     | Personenzahl liegt auf der Mietkondition (eigene Zeitreihe)                             |
| `mietkonditionen`           | ja                            | mietverhaeltnis_id, kaltmiete_cent, vorauszahlung_bk_cent, vorauszahlung_hk_cent, mietart (vergleich, index, staffel), staffel[]                                                           | Eigene Entität, weil Mieterhöhungen hier neue Versionen erzeugen                        |
| `zaehler`, `zaehlerstaende` | Zähler ja, Stände append-only | art, nummer, einheit_id oder objekt_id; stand, datum, quelle                                                                                                                               | Stände sind Ereignisse (append-only, Storno), Sicht `zaehlerstaende_gueltig`            |
| `darlehen`                  | ja                            | objekt_id, bank, nominal_cent, zins_promille, tilgung, rate_cent, zinsbindung_bis, sondertilgung                                                                                           | Restschuldverlauf wird gerechnet, nicht gespeichert                                     |
| `dokumente`                 | ja (Status)                   | typ, status (gueltig, ersetzt, abgelaufen), datei_hash, objekt_id, mietverhaeltnis_id, ersetzt_durch                                                                                       | Datei (Hash, Schlüssel, Name) ist Teil der Identität; versioniert wird der Status       |
| `referenzdaten`             | append-only                   | art (grunderwerbsteuer; später mietspiegel, vpi, kappungsgebiet, bodenrichtwert), schluessel, wert, gueltig_von, gueltig_bis, quelle, geprueft_am, pruefen_bis, mandant_id (leer = global) | Überfällige und abgelaufene Werte lösen Warnung aus; AfA-Sätze im Rechenkern (ADR 0007) |

Datenqualitäts-Check: pro Modul eine Liste von Pflichtfeldern und Invarianten (Summe Miteigentumsanteile = 1000 ‰, Wohnfläche vorhanden, AfA-Beginn gesetzt, Miethistorie lückenlos). Das Ergebnis ist eine Ampel pro Objekt, und Module, deren Pflichtfelder fehlen, sind für dieses Objekt gesperrt.

---

## 4 KI-Architektur

### 4.1 Kontext-Builder

`packages/ki/kontext/` enthält pro Aufgabe einen Builder (`fuerAntwortvorschlag`, `fuerBelegExtraktion`, `fuerPlausibilitaet`, `fuerDokumentExtraktion`). Jeder Builder liest ausschließlich aus `*_aktuell`-Sichten und aus Dokumenten mit Status `gueltig`, und gibt zurück: den Prompt-Inhalt **und** den Versionsstempel.

```ts
type Versionsstempel = {
  mandantId: string
  ledgerSeq: number // höchste seq zum Zeitpunkt des Lesens
  dokumentHashes: Record<string, string>
  promptVersion: string // z. B. "antwortvorschlag@3"
  modell: string
  erzeugtAm: string
}
```

### 4.2 Vorschläge

Jede KI-Ausgabe landet in `ki_vorschlaege` mit Stempel, Rohausgabe, Status (`offen`, `bestaetigt`, `verworfen`, `veraltet`) und `ablauf_am` (Standard 14 Tage). Beim Klick auf „Übernehmen“ oder „Senden“ vergleicht die Anwendung den Stempel mit dem aktuellen Ledger-Stand des Mandanten. Hat sich eine im Stempel referenzierte Entität oder ein Dokument geändert, wird der Vorschlag `veraltet` und neu erzeugt. Nur `bestaetigt` fließt in eine Version, und dann mit Quelle = Dokument, nicht Quelle = KI.

### 4.3 Fakten setzt der Code ein

Entwürfe enthalten Platzhalter statt Werten: `{{mietkondition.kaltmiete}}`, `{{notfall.heizung.telefon}}`, `{{frist.nebenkosten.zugang_bis}}`. Der Renderer füllt sie aus dem Ledger zum Zeitpunkt des Versands. Ein Prompt, der einen echten Betrag ausgibt, fällt im Golden-Set-Test durch.

### 4.4 Anbindung

Offizielles TypeScript-SDK `@anthropic-ai/sdk`. Standardmodell `claude-opus-5-5` mit adaptivem Denken; die Modellwahl pro Aufgabe wird gegen das Golden-Set gemessen, ein günstigeres Modell wird nur dann eingesetzt, wenn es das Set gleich gut besteht. Belege und Verträge gehen als PDF-Dokumentblock direkt an das Modell, mit aktivierten Zitaten, so dass jede extrahierte Angabe eine Seitenangabe trägt, die direkt zur Herkunft (`dokument`, `seite`) wird. Strukturierte Ausgaben über `output_config.format` mit den Zod-Schemas aus `packages/schema`, so dass die KI-Ausgabe denselben Validierungsweg nimmt wie ein Formular. Streaming für alles, was länger dauert.

Datenschutz: Nutzung unter den Anthropic Commercial Terms (kein Training mit unseren Daten), Auftragsverarbeitungsvertrag, vor Phase 1 prüfen, ob für den Account eine EU-Inferenzregion und verkürzte Aufbewahrung verfügbar sind. Was an die KI geht, wird pro Aufruf protokolliert (Ereignis `ki_aufruf` mit Stempel, ohne Rohdaten).

### 4.5 Golden-Set

`packages/ki/golden/` enthält echte, geschwärzte Beispiele (Belege, Anfragen, Verträge) mit erwarteten Ergebnissen. Der Test läuft vor jedem Prompt- oder Modellwechsel und in CI wöchentlich. Pflicht-Prüfungen: keine Zahl im Entwurf, keine rechtliche Zusage ohne Markierung, Extraktion trifft Betrag/Datum/Lieferant auf dem Set zu mindestens 95 %.

---

## 5 Repo-Struktur und Konventionen

```
VermieterOS/
├── apps/
│   ├── web/              Next.js 15, App Router, Better Auth
│   └── worker/           Hintergrundprozess, Mail-Abruf (ADR 0009)
├── packages/
│   ├── schema/           Zod (ab WP 0.4, bis dahin Typen in db)
│   ├── db/               Drizzle-Schema, SQL-Migrationen, Ledger-Kern, Tests
│   ├── rechenkern/       reine Rechenlogik, Vitest
│   ├── ki/               ab Phase 1
│   ├── pdf/              ab Phase 2
│   └── export/           ab Phase 2
├── docs/
│   ├── PLAN.md           dieses Dokument
│   ├── GLOSSAR.md        verbindliche Fachbegriffe
│   ├── adr/              Architekturentscheidungen
│   └── architektur/      Architekturplan (PDF)
├── docker-compose.yml    Postgres, Redis, S3, GreenMail, Gotenberg (lokal)
├── pnpm-workspace.yaml
└── package.json
```

Konventionen:

- **Migrationen:** Tabellen über Drizzle-Schema und `drizzle-kit generate`; Trigger, Funktionen, Policies und Rollen als handgeschriebene SQL-Migrationen im selben Ordner, nummeriert. Keine Migration wird nachträglich geändert.
- **Tests:** Vitest. Rechenkern: reine Unit-Tests mit Sollwerten aus echten Abrechnungen. DB: Integrationstests gegen eine echte PostgreSQL-Instanz (lokal `docker compose`, in CI als Service-Container), jede Ledger-Invariante hat einen Test (Hash-Kette, Schreibschutz, RLS-Isolation, Stand-zum-Datum). Abläufe: Playwright ab Phase 1.
- **CI:** GitHub Actions: `pnpm lint`, `pnpm typecheck`, `pnpm test`, Build des Images. Merge nur grün.
- **Zahlen:** Cent als `bigint`-Spalte und `number` in TS (sicher bis 9 Billiarden Cent). Flächen in Hundertstel-m², Anteile in Promille, Zinssätze in Basispunkten. Keine Dezimalbrüche in der Datenbank außer für Importe.
- **Zeit:** `gueltig_ab` ist immer ein Kalendertag (`date`), `erfasst_am` ein `timestamptz`, beide in UTC gespeichert, Anzeige Europe/Berlin.

---

## 6 Phasenplan

Wochenangaben sind Aufwand bei kontinuierlicher Arbeit. Jedes Arbeitspaket (WP) hat eine Definition of Done; eine Phase ist fertig, wenn alle WPs fertig sind und die Phasen-DoD erfüllt ist.

### Phase 0 · Fundament (Wo 1–3)

| WP  | Inhalt                                                                                                                                       | Done, wenn                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 0.1 | Monorepo, Tooling, docker-compose, CI                                                                                                        | `pnpm install && pnpm typecheck && pnpm test` grün, lokal und in CI          |
| 0.2 | Ledger-Kern: `ereignisse`, Hash-Trigger, Schreibschutz, App-Rolle, Kettenprüfung                                                             | Tests: Kette verifiziert, UPDATE/DELETE scheitern, Manipulation wird erkannt |
| 0.3 | Versionsmuster an Objekt und Einheit, Sichten `*_aktuell`, Funktion `*_stand`, `schreibeVersion`, `storniere`                                | Tests: zwei Zeitachsen korrekt, Storno fällt aus Sicht, Herkunft gespeichert |
| 0.4 | Restliche Entitäten aus 3.5, `packages/schema` mit Zod, Datenqualitäts-Check                                                                 | Jede Entität hat Schema, Migration, Sicht, mindestens einen Test             |
| 0.5 | Better Auth: Login, TOTP, Organizations = Mandanten, Rollen, Einladungen, Mandantenwechsel, `withMandant()`                                  | Zwei Mandanten, zwei Nutzer, RLS-Isolation per Playwright nachgewiesen       |
| 0.6 | Onboarding-Assistent pro Objekt (Formulare, noch ohne KI): Objekt, Einheiten, Mietverhältnisse, Konditionen, Darlehen, AfA                   | Ein echtes Objekt vollständig erfasst, Ampel grün                            |
| 0.7 | Referenzdaten-Tabelle, Grunderwerbsteuer je Bundesland eingepflegt, Warnung bei Ablauf (AfA-Sätze im Rechenkern, ADR 0007)                   | Abgelaufener Wert erzeugt sichtbare Warnung                                  |
| 0.8 | Betrieb: Hetzner-Server, Docker Compose, Caddy, Object Storage, tägliches Backup, Restore-Test-Skript, nächtlicher Integritätsjob (ADR 0008) | Restore auf frischem Container, Hash-Kette danach grün                       |

**Aus dem ersten echten Kaufvertrag gelernt (WP 0.6):** Ein Objekt kann mehrere Grundbuchblätter haben (ETW mit Miteigentumsanteil plus separater Stellplatz im Alleineigentum). Für die Spekulationsfrist zählt das Datum des Kaufvertrags, für AfA und 15-%-Grenze der Übergang von Nutzen und Lasten. Kauf-Nebenkosten werden als Positionen erfasst, weil Grundschuldkosten keine Anschaffungskosten sind. Kaufverträge enthalten meist keine Aufteilung in Grund und Gebäude; der Gebäudeanteil wird deshalb mit Quelle erfasst. Ein Rechner nach der Arbeitshilfe des BMF folgt in Phase 2, sobald Bodenrichtwerte als Referenzdaten vorliegen (WP 0.7).

**Phasen-DoD:** Zwei Vermieter des Freundeskreises haben je ein Objekt vollständig versioniert angelegt, Backup und Restore sind einmal durchgespielt, der Integritätsjob läuft nachts.

Der Stand in diesem Repository deckt WP 0.1 bis 0.4 ab: alle Entitäten aus 3.5 außer `referenzdaten` (WP 0.7) sind als Schema, Migration, Sicht, Zod-Schema und Test vorhanden, der Datenqualitäts-Check liefert die Ampel pro Modul. WP 0.5 steht: Registrierung, Login mit Pflicht-TOTP, E-Mail-Bestätigung, Mandanten anlegen und wechseln, Rollen mit Access Control, Einladungen, Eigentumsanteile; die Isolation zweier Mandanten ist per Playwright nachgewiesen. WP 0.6 steht: Objektakte mit Checkliste aus dem Datenqualitäts-Check, Schritte für Stammdaten und Grundbuch, Kauf und AfA, Einheiten, Vermietung, Darlehen und Eigentümer; ein Fall in der Struktur eines echten Kaufvertrags (ETW mit separatem Stellplatz, Bruchteil je 1/2) läuft per Playwright bis alle Ampeln grün sind. WP 0.7 steht: Tabelle `referenzdaten` mit RLS (global lesbar, eigene Werte je Mandant), Grunderwerbsteuer aller 16 Länder mit Satzwechseln seit 2009, Bundesland am Objekt, Vorschlag und Abweichungsprüfung der Grunderwerbsteuer im Kauf-Schritt, Seite „Referenzdaten“ mit Status und Quellen. Ein überfälliger Wert erzeugt per Playwright nachgewiesen eine Warnung in Objektakte und Referenzdaten. WP 0.8 steht im Repository: App- und Ops-Image, Compose-Datei mit Caddy, cloud-init, Deploy-Skript, Backup, Restore-Test, Ernstfall-Wiederherstellung und nächtliche Integritätsprüfung. Die Betriebsprobe in CI weist nach: Restore auf frischem Container, Hash-Kette danach grün; manipulierte Backups, unvollständige Backups und neu berechnete Ketten werden erkannt. Offen ist das Aufsetzen des echten Servers nach `docs/BETRIEB.md`.

### Phase 1 · Kommunikation & Belegeingang (Wo 4–7)

| WP   | Inhalt                                                                                                                                                                                                               |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1  | Mail-Eingang: IMAP-Abruf pro Mandant (Worker), Postfach-Zuordnung zu Mietverhältnis über Absender und Betreff, manuelle Zuordnung, Anhänge in Object Storage mit Prüfsumme                                           |
| 1.2  | Posteingang-UI, Verlauf pro Mietverhältnis, Telefonnotiz als Formular (Transkription optional, Whisper-Container, CPU)                                                                                               |
| 1.3  | Gestaltung: Design-Tokens, selbst gehostete Schrift, Icons, Navigation mit Zählern, Status als Icon plus Wort, Objektakte und Posteingang neu, Handy-Ansicht mit Tab-Leiste                                          |
| 1.4  | `packages/ki`: Anthropic-Client, Kontext-Builder, Vorschlags-Tabelle, Stempel-Prüfung, Platzhalter-Renderer, Golden-Set-Gerüst                                                                                       |
| 1.5  | KI-Sortierung (Kategorie, Dringlichkeit, Frist) und Antwortvorschlag                                                                                                                                                 |
| 1.6  | Handwerkerverzeichnis, Notfallkarte pro Objekt, Wissensbasis pro Objekt, Ticket-Workflow                                                                                                                             |
| 1.7  | Dokumente: Upload, Typ, Status, Ersetzen, KI-Extraktion mit Seitenangabe, Übernahme in Stammdaten als Version mit Herkunft                                                                                           |
| 1.8  | Belegeingang und Journal (Modul 08 Grundgerüst): Beleg → KI-Extraktion → Bestätigung → Journaleintrag mit Zahlungsdatum und Leistungszeitraum, Aufteilung auf Objekte, Storno; `belege@`-Adresse; Sammel-Import 2026 |
| 1.9  | Standardschreiben (Vermieterbescheinigung, Wohnungsgeberbestätigung, Mietschuldenfreiheit) als erste `packages/pdf`-Vorlagen                                                                                         |
| 1.10 | Mieterportal Basis: Magic-Link, Vertrag und Notfallkarte sehen, Mangel melden mit Foto, Nachricht schreiben                                                                                                          |

**Phasen-DoD:** Drei Vermieter nutzen Posteingang und Belegeingang im Alltag, Belege für 2026 liegen vollständig im Journal, Golden-Set mit mindestens 30 echten Beispielen besteht.

**Stand Phase 1:** WP 1.1 steht. Es gibt Postfächer pro Mandant mit Verbindungsprüfung und verschlüsseltem Passwort. Der Worker ruft nur lesend ab, legt Rohmail und Anhänge mit Prüfsumme im Object Storage ab und ordnet über Verlauf, Absender und Betreff zu. Im Posteingang lassen sich offene Nachrichten von Hand zuordnen. Playwright weist den Ablauf gegen einen echten IMAP-Server nach. Mails und Anhänge sind Teil des Backups.

WP 1.2 steht. Der Posteingang hat Suche, eine Detailansicht mit Zuordnungsverlauf und Downloads von Anhängen und Rohmail. Downloads gehen immer als Datei, nie eingebettet, und die Prüfsumme wird geprüft. Jedes Mietverhältnis hat einen Verlauf aus Mails und Telefonnotizen. Telefonnotizen sind append-only, eine Korrektur ersetzt die alte Fassung nachvollziehbar.

**Bewusst nicht gebaut (WP 1.2): Transkription per Whisper.** Gespräche ohne Einwilligung aller Beteiligten aufzunehmen ist nach § 201 StGB strafbar. Eine Transkription käme also nur für eigene Sprachnotizen nach dem Gespräch infrage. Dafür bräuchte es einen zusätzlichen Container mit mehreren GB Modell und spürbarer CPU-Last auf dem einzigen Server, für wenig Nutzen gegenüber dem Tippen von zwei Sätzen. Wiedervorlage, sobald Sprachnotizen im Alltag fehlen; dann ein eigenes WP mit Einwilligungstext.

WP 1.3 steht, eingeschoben vor die KI-Arbeit; die folgenden WPs rücken um eins weiter. Grundlage ist das Designkonzept aus der Analyse der Oberfläche nach WP 1.2. Die Farben sind als Tokens für hellen und dunklen Modus angelegt, mit einer dunklen Seitenleiste in Petrol. Die Schrift ist IBM Plex, selbst gehostet über `@fontsource`, damit kein Abruf bei Google erfolgt. Die Icons kommen aus Lucide (ISC-Lizenz). Jedes Modul hat ein festes Icon. Status steht immer als Icon plus Wort, nie nur als Farbe. Zähler gibt es im Menü nur, wo sie etwas aussagen: offene Mails in Amber als Handlung, die Anzahl der Objekte in Grau als Menge. Nach Aktionen, die einen Zähler ändern, wird das Layout neu gerendert. Was der Worker im Hintergrund abruft, erscheint im Zähler beim nächsten Seitenaufruf. Die Objektakte hat einen Fortschrittsring, Modulkacheln, offene Punkte gruppiert nach Modul und Kennzahlen-Karten. Der Posteingang hat Reiter und Suchfeld, das Nachrichtendetail ist zweispaltig. Unter 960 px gibt es oben einen Kopf und unten eine Tab-Leiste mit „Mehr“ für die Verwaltung. Fachlogik und Datenmodell sind unverändert.

WP 1.4 steht. `packages/ki` ist der einzige Ort, der das Anthropic-SDK importiert; ein Test hält das fest. Der Client nutzt strukturierte Ausgabe mit den Zod-Schemas der Aufgabe, adaptives Denken und Prompt-Caching für den stabilen Systemteil; Ablehnung, Abbruch und Schemafehler werden zu eigenen Fehlern. Aufgaben stehen versioniert im Prompt-Register (`name@version` im Stempel). Der erste Kontext-Builder (`fuerNachricht`) liefert der KI Betreff, Text, Absendername und Zuordnung, ohne Mailadressen, dazu den Katalog erlaubter Platzhalter und die Referenzen für den Stempel. Die Werte dazu liest `nachrichtFakten` erst beim Rendern. Vorschläge und Entscheidungen liegen in zwei append-only Tabellen mit RLS; der Status (offen, bestätigt, verworfen, veraltet) ergibt sich aus Entscheidung und Ablauf nach 14 Tagen. Bestätigen prüft den Stempel in derselben Transaktion: Hat sich eine referenzierte Entität geändert oder ist ein Dokument nicht mehr gültig, wird der Vorschlag als veraltet festgehalten statt bestätigt. Entwürfe mit Zahlen oder unbekannten Platzhaltern werden abgelehnt, bevor sie gespeichert werden. Jeder Aufruf steht als `ki_aufruf` im Ledger, auch gescheiterte, ohne Inhalt. Das Golden-Set-Gerüst prüft je Fall Schema, Entwurfsregeln und erwartete Felder; es läuft manuell und wöchentlich in CI, sobald das Secret `ANTHROPIC_API_KEY` gesetzt ist. Die ersten Aufgaben und Fälle kommen mit WP 1.5. Offen vor dem ersten Einsatz mit echten Daten: Auftragsverarbeitungsvertrag und Prüfung von EU-Inferenz und Aufbewahrung (PLAN 4.4).

WP 1.5 steht. Zwei Aufgaben im Prompt-Register: `sortierung@1` (Kategorie aus zehn festen Werten, Dringlichkeit von Notfall bis niedrig, Frist nur mit wörtlichem Beleg aus der Mail) und `antwortvorschlag@1` (Entwurf nur mit Platzhaltern, Zusagen markiert, offene Punkte für den Vermieter). Fachliche Prüfungen lehnen eine Ausgabe ab, bevor sie gespeichert wird: eine Frist ohne Beleg in der Mail, ein Entwurf mit Zusage-Wörtern ohne markierte Zusage. Der Worker sortiert neue Mails nach dem Abruf, begrenzt pro Durchlauf und mit Fehlerbremse. Im Posteingang stehen Notfall, dringend, Kategorie und Frist als Badges; im Nachrichtendetail lässt sich die Einschätzung bestätigen oder verwerfen und ein Antwortentwurf erstellen. Die Fakten setzt die Software beim Anzeigen aus den Stammdaten ein; nach dem Übernehmen öffnet ein Link das Mailprogramm mit dem fertigen Text. Versand aus der Software heraus ist bewusst nicht gebaut: Ein Mensch schickt ab. Das Golden-Set hat zehn Sortier- und vier Antwortfälle, alle synthetisch markiert; echte, geschwärzte Fälle ersetzen sie, sobald sie vorliegen. E2E-Tests und Vorschau nutzen eine KI-Attrappe hinter dem echten SDK-Client.

WP 1.6 steht. Vier neue versionierte Entitäten mit RLS und Bezugsprüfung: Handwerker (Gewerke, Telefon, Notdienst, zuständige Objekte, Bewertung), Notfallkarte (eine je Objekt, Zeilen aus dem Verzeichnis oder freie Kontakte), Wissensartikel (Hausordnung, Anleitungen, Müll, häufige Fragen; sichtbar fürs Mieterportal oder nur intern) und Tickets (gemeldet, beauftragt, Termin, erledigt, abgeschlossen, verworfen; jeder Wechsel ist eine Version mit Begründung). Beauftragt und Termin verlangen einen Handwerker, ein Termin ein Datum. Tickets entstehen an der Objektakte oder direkt aus einer Mail, vorbefüllt aus Zuordnung und Einschätzung der KI; neu gemeldete zählt das Menü in Amber. Der Auftrag geht per Mailprogramm-Link an den Handwerker. Die KI bekommt zu zugeordneten Mails die Wissensbasis des Objekts und Notfall-Platzhalter (`{{notfall.heizung.telefon}}`); die Nummern setzt die Software beim Anzeigen ein (Prompt `antwortvorschlag@2`). Ändern sich Notfallkarte oder Wissensbasis, veralten offene Entwürfe. Rechnung hochladen kommt mit Dokumenten (WP 1.7) und Belegeingang (WP 1.8).

WP 1.7 steht. Dokumente hängen am Objekt oder am Mietverhältnis: Upload (PDF, JPG, PNG, WebP bis 20 MB) in den Object Storage mit Prüfsumme, Art, Titel, Datum, Ablauf, Status (gültig, abgelaufen, ersetzt). Ersetzen legt eine neue Fassung an und vermerkt an der alten „ersetzt durch“; beide bleiben lesbar. Anhänge zugeordneter Mails lassen sich ohne zweiten Upload als Dokument ablegen. Downloads prüfen die Prüfsumme vor der Auslieferung. Mietverträge liest die KI aus (`mietvertrag_extraktion@1`): Mietbeginn, Kaltmiete, Vorauszahlungen, Kaution, Kündigungsfrist, je mit Wert, Seite und wörtlichem Zitat. Zitate im Sinne der API (Citations) lassen sich nicht mit strukturierter Ausgabe kombinieren; deshalb prüft die Software jede Fundstelle selbst am Text der genannten PDF-Seite. Nur belegte Werte lassen sich anhaken; die Übernahme bestätigt den Vorschlag und schreibt die Versionen in einer Transaktion, mit Herkunft „Dokument, Seite“ statt „KI“. Scans ohne Textebene sind nicht prüfbar und werden so angezeigt. Der KI-Client setzt seit WP 1.7 einen Aufwand je Aufgabe (Sortieren niedrig, Antworten mittel, Verträge hoch) und nutzt den serverseitigen Ersatz bei Ablehnungen der Sicherheitsfilter.

WP 1.8 steht. Belege sind Dokumente mit Kennzeichen „Beleg“: Sie dürfen ohne Objekt eingehen, über Upload, Sammel-Import (beliebig viele Dateien, einzeln hochgeladen, Dubletten über die Prüfsumme erkannt), eine Beleg-Adresse (Postfach mit Zweck „Belege“: PDF- und Bild-Anhänge landen im Belegeingang statt im Posteingang) oder als Rechnung am Ticket. Die KI liest aus (`beleg_extraktion@1`): Lieferant, Rechnungsnummer und -datum, Brutto, Umsatzsteuer, Leistungszeitraum und Zahlungsdatum, je mit Fundstelle, die die Software am PDF prüft (gemeinsames Modul `fundstelle.ts` mit WP 1.7); dazu ein Vorschlag für Objekt (nur aus der Objektliste), Steuerkategorie, Kostenart nach § 2 BetrKV und Umlagefähigkeit. Vorbelegt wird nur, was belegt ist. Der Worker liest neue Belege nach dem Mail-Abruf aus (`KI_BELEGE_LIMIT`). Das Journal ist append-only wie die Zählerstände: Einträge mit Zahlungsdatum (Steuer) und Leistungszeitraum (Nebenkosten), Kategorie, Kostenart, Umlagefähigkeit, Verteilung von Erhaltungsaufwand auf 2 bis 5 Jahre, Herkunft je Feld, Aufteilung auf Objekte und Einheiten. Die Datenbank vergibt die Belegnummer (2026-0042, je Mandant und Zahlungsjahr), prüft am Ende der Transaktion, dass die Anteile den Bruttobetrag ergeben, und dass ein Beleg höchstens einmal gültig gebucht ist. Korrektur per Storno und Neubuchung; der Beleg ist danach wieder offen. Die steuerliche Behandlung (sofort, verteilt, AfA, privat) wird aus Kategorie und Verteilung abgeleitet, nicht frei gewählt. Steuerkategorien tragen bewusst keine Anlage-V-Zeilennummern; die Zuordnung Kategorie → Zeile je Formularjahr gehört zum Steuerpaket (WP 2.6), ebenso Miteigentumsaufteilung, 15-%-Wächter und Lückenprüfung. Einnahmen lassen sich bis zum Bank-Abgleich (Modul 07) ohne Beleg buchen. Buchen verlangt das Recht „Stammdaten schreiben“; der Steuerberater liest.

WP 1.9 steht. `packages/pdf` erzeugt Geschäftsbriefe nach DIN 5008 mit pdf-lib (reines JavaScript, Standardschrift mit Umlauten, €, §), byte-gleich für dieselben Daten, damit ein ausgestelltes Schreiben über seine Prüfsumme belegbar bleibt. Drei Vorlagen als reine Funktionen: Wohnungsgeberbestätigung mit den Pflichtangaben nach § 19 Abs. 3 BMG und dem Hinweis auf das Verbot von Gefälligkeitsbestätigungen, Mietschuldenfreiheitsbescheinigung (Bestätigung der Prüfung ist Pflicht, bis der Bank-Abgleich kommt) und Vermieterbescheinigung mit Miete, Vorauszahlungen, Wohnfläche und Personen. Am Mietverhältnis vorbelegt aus den Stammdaten (Vermieter aus den Eigentümern, die jetzt eine Anschrift haben können; Wohnung aus Objekt und Einheit); jedes erzeugte PDF liegt als Dokument „Bescheinigung“ mit Prüfsumme am Mietverhältnis. Eigene Briefvorlagen (Logo, Fußzeile) kommen mit der Nebenkostenabrechnung (WP 2.4).

### Phase 2 · Nebenkosten & Steuerpaket (Wo 8–12)

| WP  | Inhalt                                                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2.1 | Rechenkern Nebenkosten: Kostenarten nach BetrKV, Verteilerschlüssel pro Kostenart, tagesgenaue Zeitanteile bei Mieterwechsel, Leerstand, Vorauszahlungsverrechnung. Sollwert-Tests gegen zwei bis drei echte Abrechnungen, auf den Cent                                        |
| 2.2 | HeizKV: 50–70 % Verbrauch, Rest Fläche, Schätzregeln bei Zählerausfall, Warmwasser-Abtrennung                                                                                                                                                                                  |
| 2.3 | Zählerstände erfassen, Ablese-Erinnerung, Plausibilität gegen Vorjahr                                                                                                                                                                                                          |
| 2.4 | Abrechnungs-Workflow: Journalbelege ziehen → Plausibilität (KI) → Bestätigen → Rechnen → PDF in eurer Vorlage → Versand (Mail + Portal) → Festschreibung                                                                                                                       |
| 2.5 | Frist-Wächter § 556 Abs. 3 BGB (Warnung Monat 9, Eskalation Monat 11)                                                                                                                                                                                                          |
| 2.6 | Steuerpaket: Anlage-V-Vorbereitung je Objekt, AfA-Verzeichnis, Darlehenszinsen, verteilter Erhaltungsaufwand, 15-%-Wächter, Aufteilung nach Miteigentum, Journal als Excel/CSV, Belege nummeriert, Prüfprotokoll, ZIP mit Prüfsummen, Festschreibung, Lesezugang Steuerberater |
| 2.7 | Jahresabschluss-Assistent (Checkliste pro Objekt), Vollständigkeits-Wächter das Jahr über                                                                                                                                                                                      |

**Phasen-DoD:** Erste echte Nebenkostenabrechnung versandt, Ergebnis stimmt mit Handrechnung überein; erstes Steuerpaket 2026 beim Steuerberater, ohne Rückfragen zu fehlenden Belegen.

### Phase 3 · Mieterhöhung (Wo 13–15)

| WP  | Inhalt                                                                                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1 | Rechenkern Mieterhöhung: Sperrfrist, Kappungsgrenze (20/15 %), Indexberechnung aus VPI, Staffel, Modernisierung (8 %, 3 bzw. 2 €/m²), Zustimmungs- und Wirkungsfristen |
| 3.2 | Referenzdaten: Mietspiegel pro Stadt mit Gültigkeit, Kappungsgebiete, VPI-Abruf (Destatis) als versionierte Referenzdaten                                              |
| 3.3 | Workflow mit harten Schranken (rot, nicht umgehbar), Anschreiben, Berechnungsblatt, Fristenkalender, neue Mietkonditions-Version ab Wirkungsdatum                      |
| 3.4 | Juristische Prüfung der Vorlagen einarbeiten                                                                                                                           |

### Phase 4 · Finanzen (Wo 16–18)

| WP  | Inhalt                                                                                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1 | Finanz-Rechenkern aus dem Ankaufsprüfungs-Prototyp nach TypeScript portieren, Litzendorf als Sollwert-Test, GrESt nach Bundesland aus Referenzdaten         |
| 4.2 | Bestand: Kaltmiete, Nebenkosten, Instandhaltung, Rücklage, AfA, Brutto-/Nettorendite, Cashflow, EK-Rendite, Miete/m² vs. Mietspiegel, alles aus dem Journal |
| 4.3 | Kredite: Restschuldverlauf, Anschlussfinanzierungs-Radar (18/12/6 Monate)                                                                                   |
| 4.4 | Bank-CSV-Import (CAMT/CSV der gängigen Banken), Abgleich mit Sollmieten, offene Posten, Mahnschreiben aus Vorlage, Kautionskonto                            |

### Phase 5 · Ausbau (ab Wo 19)

Mieterportal komplett (Zählerstand per Foto), WhatsApp Business API, Ankaufsprüfung als Modul 12 mit „Vom Ankauf in den Bestand“, pgvector für sinngemäße Suche, DATEV-Export nur auf konkreten Bedarf des Steuerberaters, E-Signatur, Neuvermietung.

---

## 7 Querschnitt

### 7.1 Sicherheit

TOTP-Pflicht für alle Mandanten-Mitglieder (abschaltbar nur lokal über `ZWEI_FAKTOR_PFLICHT=aus`). Einladungen lassen sich nur mit bestätigter E-Mail-Adresse sehen und annehmen, sonst könnte jemand mit einer fremden, unbestätigten Adresse eine Einladung übernehmen. Weiterleitungsziele nach dem Login sind auf Pfade der App beschränkt. Magic-Links für Portal-Identitäten mit kurzer Gültigkeit und Bindung an genau ein Mietverhältnis. Rate-Limits auf Login, Portal und Upload (Redis). Uploads werden auf MIME-Typ geprüft, PDF werden über Gotenberg „gewaschen“ (neu gerendert) bevor sie an die KI gehen. Secrets ausschließlich in der `.env` auf dem Server (chmod 600), jeder Dienst bekommt nur seine Variablen. Keine Rohdaten in Logs.

### 7.2 Betrieb und Datensicherung

Tägliches `pg_dump`, mit age verschlüsselt, ins Hetzner Object Storage, mit Manifest der Kettenköpfe. 30 Tage Vorhaltung, Monatserste 13 Monate. Monatlicher Restore-Test auf einem frischen Cluster mit anschließender Kettenprüfung, nächtliche Integritätsprüfung mit Abgleich gegen das letzte Manifest. Jeder Job meldet an einen Totmannschalter, Uptime-Monitoring extern auf `/api/gesund`. Updates der Basis-Images monatlich. Details und Ernstfall-Ablauf: `docs/BETRIEB.md`, Entscheidung: ADR 0008.

### 7.3 Datenschutz

Auskunft und Export pro Mieter (alle Nachrichten, Dokumente, Abrechnungen als ZIP). Löschkonzept: Löschvorschlag nach Ablauf der Aufbewahrungsfrist, nie automatisch, nie bei steuerrelevanten Unterlagen. Auftragsverarbeitungsverträge mit Hetzner, Anthropic, Mail-Anbieter vor Phase 1 unterschrieben. Informationspflichten als Textbaustein im Portal.

### 7.4 Was die Software ausdrücklich nicht tut

Keine automatische Aktion ohne Klick, keine Steuererklärung, keine Zustellungsbeweise, keine rechtliche Einzelfallbewertung, keine Übermittlung an das Finanzamt. Diese Grenzen stehen als Hinweistexte an den entsprechenden Stellen in der Oberfläche.

---

## 8 Was noch gebraucht wird

| Was                                                                                              | Wofür                                                     | Wann spätestens                                      |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | ---------------------------------------------------- |
| Quellcode des Ankaufsprüfungs-Prototyps (JSX)                                                    | Port des Finanz-Rechenkerns, Litzendorf als Sollwert-Test | Phase 4, gern früher ins Repo unter `docs/referenz/` |
| Nebenkosten-Vorlage und zwei bis drei fertige Abrechnungen                                       | Vorlage nachbauen, Rechenkern auf den Cent testen         | Beginn Phase 2                                       |
| Letzte Anlage V und Nachforderungen des Steuerberaters                                           | Journal-Kategorien, Steuerpaket gegen Vorjahr testen      | Beginn Phase 1 (Kategorien), Phase 2 (Test)          |
| Kaufverträge, Kaufpreisaufteilung, AfA-Daten pro Objekt                                          | Stammdaten vollständig                                    | Phase 0, WP 0.6                                      |
| Eigentumsverhältnisse pro Objekt                                                                 | Mandanten anlegen                                         | Phase 0, WP 0.5                                      |
| Muster-Mietvertrag, geschwärzt                                                                   | KI-Extraktion, Golden-Set                                 | Phase 1                                              |
| Zehn häufigste Mieteranfragen                                                                    | Antwortvorschläge, Wissensbasis, Golden-Set               | Phase 1                                              |
| Städte                                                                                           | Mietspiegel, Kappungsgebiete                              | Phase 3                                              |
| Entscheidung Mail-Anbieter mit IMAP (deutsch, Vorschlag: mailbox.org Business oder Hetzner-Mail) | Mail-Eingang                                              | Beginn Phase 1                                       |
| Rückmeldung des Steuerberaters zum Format                                                        | Steuerpaket                                               | Beginn Phase 2                                       |
| Kontakt für juristische Prüfung der Vorlagen                                                     | Phase 3                                                   | Phase 3                                              |

---

## 9 Einwände und Risiken

**Der Zeitplan ist bei Nebenbei-Arbeit optimistisch.** 19 Wochen Aufwand werden eher 30 Kalenderwochen. Das ist kein Problem, solange die Reihenfolge stimmt: Nach Phase 1 ist das Werkzeug täglich nützlich, nach Phase 2 spart es die beiden großen Jahresarbeiten. Alles danach ist Komfort.

**Der Nebenkosten-Rechenkern ist das größte fachliche Risiko.** HeizKV-Details, Mieterwechsel im Abrechnungsjahr, Leerstand, gemischt genutzte Objekte. Deshalb Sollwert-Tests gegen echte Abrechnungen _vor_ dem ersten Versand, und im ersten Jahr jede Abrechnung einmal von Hand gegengerechnet.

**Mail-Eingang ist unzuverlässiger als er wirkt.** Absender wechseln, Betreffe sind leer, Anhänge heißen `scan0001.pdf`. Die Zuordnung wird in Phase 1 bewusst halbautomatisch gebaut: Vorschlag, Klick.

**Whisper auf CPU** braucht für ein 30-Sekunden-Memo mehrere Sekunden bis Minuten, je nach Modellgröße. Für die Telefonnotiz reicht das, es läuft als Job. Wird es zu langsam, bleibt die Notiz als Formular.

**pgvector wird nicht in Phase 1 gebaut.** PostgreSQL-Volltext reicht für „alle Nachrichten zu Heizung in Wohnung 3“. Sinngemäße Suche kommt, wenn der Volltext nachweislich nicht reicht.

**Die Hash-Kette schützt vor stiller Manipulation, nicht vor einem Angreifer mit Datenbank-Zugang und Zeit.** Wer die Kette komplett neu schreibt, fällt nur auf, wenn ein externer Anker existiert. Deshalb hält jedes Backup den letzten Hash jedes Mandanten im Manifest fest, und die nächtliche Prüfung gleicht dagegen ab. Das wirkt nur, solange der Angreifer die Manifeste nicht ebenfalls ersetzt; eine zweite Kopie außerhalb der Reichweite des Servers ist offen (`docs/BETRIEB.md`).

**Steuerlogik bleibt beim Berater.** Die Software markiert strittige Einordnungen (Erhaltung oder Herstellung), entscheidet sie aber nicht. Das muss in der Oberfläche jederzeit sichtbar bleiben, sonst entsteht ein Vertrauen, das die Software nicht einlösen kann.
