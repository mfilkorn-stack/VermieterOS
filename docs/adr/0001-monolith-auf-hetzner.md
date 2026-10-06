# ADR 0001 · Ein Monolith, selbst gehostet auf Hetzner

Status: angenommen · 06.10.2026

## Kontext

Der Architekturplan fordert Datenhoheit (Leitprinzip 1) und Zurückhaltung (Leitprinzip 5). Supabase war als Beschleuniger im Gespräch, ist aber ein US-Anbieter mit Vendor-Bindung.

## Entscheidung

Next.js-Anwendung und BullMQ-Worker aus einem Repository und einem Docker-Image, betrieben mit Coolify auf einem Hetzner-Server in Deutschland. PostgreSQL 16, Redis, Hetzner Object Storage (S3-kompatibel), Gotenberg als Container. Keine verwalteten Backend-Dienste außerhalb Deutschlands, ausgenommen die Claude API als KI-Dienst unter Auftragsverarbeitung.

## Konsequenzen

Mehr Setup in Phase 0 (Rollen, RLS, Backup selbst bauen). Dafür volle Kontrolle über Datenbankrollen und Trigger, die der Ledger braucht, und keine Abhängigkeit von einem fremden Auth- oder Storage-Modell.
