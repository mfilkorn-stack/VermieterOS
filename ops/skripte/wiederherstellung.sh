# Gemeinsame Schritte für restore-test und wiederherstellen. Wird per `. wiederherstellung.sh` eingebunden.
# shellcheck disable=SC2154 # $arbeit setzt das aufrufende Skript
# Erwartet: BACKUP_ZIEL, BACKUP_SCHLUESSEL, eine Funktion scheitern() und ein Arbeitsverzeichnis $arbeit.

# Name des jüngsten vollständigen Backups (die .sha256-Datei wird zuletzt hochgeladen).
juengstes_backup() {
  rclone lsf --s3-no-check-bucket --include '*.sha256' "$BACKUP_ZIEL" | sort | tail -n 1 | sed 's/\.sha256$//'
}

# Lädt ein Backup, prüft die Prüfsummen und entschlüsselt nach $arbeit/dump.
backup_holen() {
  _name=$1
  for teil in dump.age manifest.json sha256; do
    rclone copyto --s3-no-check-bucket "$BACKUP_ZIEL/$_name.$teil" "$arbeit/$_name.$teil" || scheitern "Download $teil"
  done
  (cd "$arbeit" && sha256sum -c -s "$_name.sha256") || scheitern "Prüfsumme stimmt nicht"
  age -d -i "$BACKUP_SCHLUESSEL" -o "$arbeit/dump" "$arbeit/$_name.dump.age" || scheitern "Entschlüsseln"
}

# Prüft die wiederhergestellte Datenbank (PG*-Umgebung) gegen das Manifest:
#   Migrationsstand wie beim Backup, jeder Kettenkopf vorhanden, jede Kette intakt.
# Gibt bei Erfolg die OK-Zeile aus.
wiederherstellung_pruefen() {
  _manifest=$1
  psql -X -q -v ON_ERROR_STOP=1 -At -v manifest="$(cat "$_manifest")" <<'SQL' >"$arbeit/ergebnis" 2>&1 || {
SELECT set_config('restore.manifest', :'manifest', false) IS NOT NULL AS gesetzt \gset
DO $$
DECLARE
  m jsonb := current_setting('restore.manifest')::jsonb;
  k jsonb;
  h text;
  r record;
  n int := 0;
BEGIN
  IF (SELECT count(*) FROM drizzle.__drizzle_migrations) <> (m->>'migrationen')::int THEN
    RAISE EXCEPTION 'Migrationsstand % statt %', (SELECT count(*) FROM drizzle.__drizzle_migrations), m->>'migrationen';
  END IF;
  FOR k IN SELECT * FROM jsonb_array_elements(m->'ketten') LOOP
    SELECT e.hash INTO h FROM ereignisse e
     WHERE e.mandant_id = (k->>'mandant')::uuid AND e.seq = (k->>'seq')::bigint;
    IF h IS DISTINCT FROM k->>'hash' THEN
      RAISE EXCEPTION 'Kettenkopf Mandant % seq % fehlt oder weicht ab', k->>'mandant', k->>'seq';
    END IF;
  END LOOP;
  FOR r IN SELECT d.mandant_id, p.* FROM (SELECT DISTINCT mandant_id FROM ereignisse) d
           CROSS JOIN LATERAL ledger_pruefe_kette(d.mandant_id) p LOOP
    IF NOT r.ok THEN
      RAISE EXCEPTION 'Kette Mandant % gebrochen bei seq %: %', r.mandant_id, r.erster_fehler_seq, r.fehler;
    END IF;
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'OK: % Ketten intakt, % Köpfe aus dem Manifest vorhanden', n, jsonb_array_length(m->'ketten');
END $$;
SQL
    cat "$arbeit/ergebnis" >&2
    scheitern "$(grep -o 'ERROR: .*' "$arbeit/ergebnis" | head -n 1)"
  }
  grep -o 'OK: .*' "$arbeit/ergebnis"
}
