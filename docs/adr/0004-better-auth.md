# ADR 0004 · Better Auth statt externem Auth-Dienst

Status: angenommen · 06.10.2026

## Kontext

Zur Wahl standen Better Auth (im Prozess) und selbst gehostetes Supabase Auth (GoTrue, eigener Container).

## Entscheidung

Better Auth mit Drizzle-Adapter in derselben Datenbank. Plugins: `organization` (Mandanten, Rollen, Einladungen), `twoFactor` (TOTP, Pflicht für Mandanten-Mitglieder), `magicLink` (Mieter, Handwerker). Sitzungen in der Datenbank.

## Konsequenzen

Kein weiterer Dienst, keine separaten Mail-Templates, gemeinsame Typen mit dem Rest des Schemas. Auth-Tabellen liegen im Schema `auth` und sind von der RLS der Fachtabellen getrennt. Portal-Identitäten (Mieter) sind Nutzer ohne Mandanten-Mitgliedschaft mit einer eigenen Berechtigungstabelle auf genau ein Mietverhältnis.
