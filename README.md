# Vermieter.OS

Eine eigene Verwaltungssoftware für private Vermieter. Kommunikation, Nebenkosten, Dokumente, Mieterhöhung, Belege und Finanzen an einem Ort, auf einem versionierten Datenfundament, mit KI als Assistent.

- **Architekturplan** (das _Was_ und _Warum_): `docs/architektur/Vermieter.OS-Architektur_v1.1.pdf`
- **Umsetzungsplan** (das _Wie_ und _Wann_): [`docs/PLAN.md`](docs/PLAN.md)
- **Entscheidungen:** [`docs/adr/`](docs/adr/) · **Fachbegriffe:** [`docs/GLOSSAR.md`](docs/GLOSSAR.md)

## Stand

Phase 0 · Fundament. Monorepo, Ledger-Kern mit Hash-Kette, Versionsmuster (Objekt, Einheit), RLS, Rechenkern-Primitive, Next.js-Skelett mit Better Auth.

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

## Struktur

```
apps/web           Next.js, Better Auth, UI
packages/db        Drizzle-Schema, Migrationen, Ledger-Kern, RLS
packages/rechenkern reine Rechenlogik (Geld, Verteilung)
docs/              Plan, ADRs, Glossar, Architekturplan
```
