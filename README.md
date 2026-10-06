# Vermieter.OS

Eine eigene Verwaltungssoftware für private Vermieter. Kommunikation, Nebenkosten, Dokumente, Mieterhöhung, Belege und Finanzen an einem Ort, auf einem versionierten Datenfundament, mit KI als Assistent.

- **Architekturplan** (das _Was_ und _Warum_): `docs/architektur/Vermieter.OS-Architektur_v1.1.pdf`
- **Umsetzungsplan** (das _Wie_ und _Wann_): [`docs/PLAN.md`](docs/PLAN.md)
- **Entscheidungen:** [`docs/adr/`](docs/adr/) · **Fachbegriffe:** [`docs/GLOSSAR.md`](docs/GLOSSAR.md)

## Stand

Phase 0 · Fundament. WP 0.1 bis 0.5: Ledger mit Hash-Kette, alle Stammdaten-Entitäten versioniert, RLS, Datenqualitäts-Check, Login mit Pflicht-TOTP, Mandanten, Rollen und Einladungen.

## Entwicklung

```bash
pnpm install
docker compose up -d            # Postgres, Redis, MinIO, Gotenberg
cp .env.example .env
pnpm db:migrate                 # Migrationen als Besitzerrolle
pnpm dev                        # http://localhost:3000
```

Tests brauchen eine erreichbare PostgreSQL-Instanz (`TEST_DATABASE_URL`, Standard: lokales Docker):

```bash
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
packages/db        Drizzle-Schema, Migrationen, Ledger-Kern, RLS
packages/schema    Zod-Schemas, einzige Typquelle
packages/rechenkern reine Rechenlogik (Geld, Verteilung, Datenqualität)
docs/              Plan, ADRs, Glossar, Architekturplan
```
