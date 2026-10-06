#!/bin/sh
# Läuft einmalig beim ersten Start des Produktions-Postgres (docker-entrypoint-initdb.d).
# Drei Rollen (docs/PLAN.md 3.1, docs/BETRIEB.md):
#   vermieteros_owner      Migrationen, besitzt das Schema, unterliegt RLS (FORCE)
#   vermieteros_app        Laufzeit der App, ohne BYPASSRLS, ohne UPDATE/DELETE auf Ledger-Tabellen
#   vermieteros_worker     Mail-Abruf: sieht alle Postfächer, schreibt Nachrichten nur im Mandantenkontext
#   vermieteros_sicherung  nur lesen, an RLS vorbei: Backup und Integritätsprüfung
set -eu
: "${VOS_OWNER_PASSWORT:?}" "${VOS_APP_PASSWORT:?}" "${VOS_WORKER_PASSWORT:?}" "${VOS_SICHERUNG_PASSWORT:?}"
psql -X -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v owner_pw="$VOS_OWNER_PASSWORT" -v app_pw="$VOS_APP_PASSWORT" -v worker_pw="$VOS_WORKER_PASSWORT" -v sich_pw="$VOS_SICHERUNG_PASSWORT" <<'SQL'
CREATE ROLE vermieteros_owner LOGIN PASSWORD :'owner_pw' NOBYPASSRLS;
CREATE ROLE vermieteros_app LOGIN PASSWORD :'app_pw' NOBYPASSRLS;
CREATE ROLE vermieteros_worker LOGIN PASSWORD :'worker_pw' NOBYPASSRLS;
CREATE ROLE vermieteros_sicherung LOGIN PASSWORD :'sich_pw' BYPASSRLS;
GRANT pg_read_all_data TO vermieteros_sicherung;
SELECT format('ALTER DATABASE %I OWNER TO vermieteros_owner', current_database()) \gexec
ALTER SCHEMA public OWNER TO vermieteros_owner;
GRANT USAGE ON SCHEMA public TO vermieteros_app;
SQL
