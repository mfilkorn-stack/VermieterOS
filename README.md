# Vermieter.OS

Eine eigene Verwaltungssoftware für private Vermieter. Kommunikation, Nebenkosten, Dokumente, Mieterhöhung, Belege und Finanzen an einem Ort, auf einem versionierten Datenfundament, mit KI als Assistent.

- **Architekturplan** (das _Was_ und _Warum_): `docs/architektur/Vermieter.OS-Architektur_v1.1.pdf`
- **Umsetzungsplan** (das _Wie_ und _Wann_): [`docs/PLAN.md`](docs/PLAN.md)
- **Entscheidungen:** [`docs/adr/`](docs/adr/) · **Fachbegriffe:** [`docs/GLOSSAR.md`](docs/GLOSSAR.md)

## Stand

Phase 0 (Fundament) ist im Repository vollständig: Ledger mit Hash-Kette, versionierte Stammdaten, RLS, Datenqualitäts-Check, Login mit Pflicht-TOTP, Mandanten und Rollen, Onboarding pro Objekt, Referenzdaten, Betrieb mit Backup und Restore-Probe (`docs/BETRIEB.md`). Phase 1 läuft: Mail-Eingang mit Postfächern, Abruf im Worker und Zuordnung zu Mietverhältnissen (WP 1.1).

## Entwicklung

```bash
pnpm install
docker compose up -d            # Postgres, Redis, S3, GreenMail (Mail), Gotenberg
cp .env.example .env            # POSTFACH_SCHLUESSEL setzen: openssl rand -base64 32
pnpm db:migrate                 # Migrationen als Besitzerrolle
pnpm dev                        # http://localhost:3000
pnpm --filter @vermieteros/worker start   # Mail-Abruf (DATABASE_URL mit Rolle vermieteros_worker)
```

Tests brauchen eine erreichbare PostgreSQL-Instanz (`TEST_DATABASE_URL`, Standard: lokales Docker) und für den Mail-Eingang GreenMail und S3:

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

Erster Start: `/registrieren`, dann 2FA einrichten, dann Mandant anlegen. Mail-Links (Bestätigung, Einladung) stehen bis Phase 1 im Server-Log.

## Struktur

```
apps/web           Next.js, Better Auth, UI
apps/worker        Hintergrundprozess: Mail-Abruf
packages/db        Drizzle-Schema, Migrationen, Ledger-Kern, RLS
packages/post      Mail-Eingang: IMAP, Ablage im Object Storage, Zuordnung
packages/schema    Zod-Schemas, einzige Typquelle
packages/rechenkern reine Rechenlogik (Geld, Verteilung, Datenqualität)
ops/               Betrieb: Images, Compose, Backup, Restore, Probe
docs/              Plan, ADRs, Glossar, Architekturplan, Betrieb
```
