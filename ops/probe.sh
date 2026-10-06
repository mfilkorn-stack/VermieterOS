#!/usr/bin/env bash
# Betriebsprobe (WP 0.8, Definition of Done): Backup → Restore auf frischem Container → Hash-Kette grün.
# Dazu die Gegenproben: manipuliertes Backup und manipulierte Kette werden erkannt.
# Braucht Docker und pnpm. Startet eigene Container für Postgres und einen S3-Server und räumt sie wieder ab.
#   ops/probe.sh            baut das Ops-Image selbst
#   OPS_IMAGE=… ops/probe.sh  nimmt ein fertiges Image
set -euo pipefail
cd "$(dirname "$0")/.."

OPS_IMAGE=${OPS_IMAGE:-vermieteros-ops:probe}
NETZ=vos-probe
PG=vos-probe-pg
PG_NEU=vos-probe-pg-neu
S3=vos-probe-s3
PG_PORT=${PROBE_PG_PORT:-55432}
arbeit=""

schritt() { printf '\n== %s\n' "$*"; }
aufraeumen() {
  docker rm -f "$PG" "$PG_NEU" "$S3" >/dev/null 2>&1 || true
  docker network rm "$NETZ" >/dev/null 2>&1 || true
  rm -rf "$arbeit"
}
trap aufraeumen EXIT
aufraeumen
arbeit=$(mktemp -d)

if [ -z "${OPS_IMAGE_FERTIG:-}" ]; then
  schritt "Ops-Image bauen"
  docker build -q -t "$OPS_IMAGE" ops >/dev/null
fi

schritt "Quell-Datenbank und Object Storage starten"
docker network create "$NETZ" >/dev/null
# Postgres wie in Produktion: Rollen aus ops/postgres-init.sh beim ersten Start.
starte_postgres() {
  docker run -d --name "$1" --network "$NETZ" "${@:2}" \
    -e POSTGRES_PASSWORD=probe -e POSTGRES_DB=vermieteros \
    -e VOS_OWNER_PASSWORT=owner -e VOS_APP_PASSWORT=app -e VOS_SICHERUNG_PASSWORT=sicherung \
    -v "$PWD/ops/postgres-init.sh:/docker-entrypoint-initdb.d/10-rollen.sh:ro" \
    postgres:16 >/dev/null
  for _ in $(seq 60); do
    # Über TCP: während der Erstinitialisierung lauscht Postgres nur auf dem Socket.
    docker exec "$1" pg_isready -q -h 127.0.0.1 -U postgres -d vermieteros 2>/dev/null && return 0
    sleep 1
  done
  echo "Postgres $1 startet nicht"
  exit 1
}
starte_postgres "$PG" -p "127.0.0.1:$PG_PORT:5432"
# S3-kompatibler Server aus rclone selbst, damit die Probe kein weiteres Fremd-Image braucht.
docker run -d --name "$S3" --network "$NETZ" "$OPS_IMAGE" \
  sh -c 'mkdir -p /tmp/s3/backup && exec rclone serve s3 --auth-key probe,probe-geheim --addr :9000 /tmp/s3' >/dev/null

schritt "Migrationen und Probedaten (zwei Mandanten, Versionen, Storno)"
owner="postgres://vermieteros_owner:owner@127.0.0.1:$PG_PORT/vermieteros"
app="postgres://vermieteros_app:app@127.0.0.1:$PG_PORT/vermieteros"
DATABASE_URL_OWNER=$owner pnpm --silent --filter @vermieteros/db migrate 2>&1 | grep -v -e NOTICE -e '^ ' -e '^[{}]' || true
DATABASE_URL=$app pnpm --silent --filter @vermieteros/db probedaten

schritt "Schlüsselpaar für die Probe"
docker run --rm "$OPS_IMAGE" age-keygen 2>/dev/null >"$arbeit/backup.key"
# Der Container läuft als postgres (uid 70) und muss den Schlüssel lesen können.
chmod 755 "$arbeit" && chmod 644 "$arbeit/backup.key"
empfaenger=$(grep -o 'age1[0-9a-z]*' "$arbeit/backup.key")

OPS_ENV=(
  -e PGHOST="$PG" -e PGUSER=vermieteros_sicherung -e PGPASSWORD=sicherung -e PGDATABASE=vermieteros
  -e RCLONE_CONFIG_ZIEL_TYPE=s3 -e RCLONE_CONFIG_ZIEL_PROVIDER=Rclone
  -e RCLONE_CONFIG_ZIEL_ENDPOINT="http://$S3:9000"
  -e RCLONE_CONFIG_ZIEL_ACCESS_KEY_ID=probe -e RCLONE_CONFIG_ZIEL_SECRET_ACCESS_KEY=probe-geheim
  -e BACKUP_ZIEL=ziel:backup/probe -e BACKUP_EMPFAENGER="$empfaenger"
  -e BACKUP_SCHLUESSEL=/geheim/backup.key -v "$arbeit:/geheim:ro"
)
ops() { docker run --rm --network "$NETZ" "${OPS_ENV[@]}" "$OPS_IMAGE" "$@"; }
# Gegen den frischen Produktions-Postgres, als Superuser (Ernstfall-Wiederherstellung).
ops_neu() {
  docker run --rm --network "$NETZ" "${OPS_ENV[@]}" \
    -e PGHOST="$PG_NEU" -e PGUSER=postgres -e PGPASSWORD=probe "$OPS_IMAGE" "$@"
}
for _ in $(seq 30); do ops rclone lsd ziel: >/dev/null 2>&1 && break; sleep 1; done

schritt "Integritätsprüfung auf der Quelle"
ops integritaet

schritt "Backup"
ops backup
ops rclone lsf ziel:backup/probe

schritt "Restore auf frischem Container, danach Kettenprüfung"
ops restore-test

schritt "Ernstfall: Wiederherstellung in einen frischen Produktions-Postgres"
starte_postgres "$PG_NEU"
ops_neu wiederherstellen
# Rechte und RLS haben den Restore überlebt: Die App-Rolle sieht nur mit gesetztem Mandanten Daten.
app_neu() { docker exec -e PGPASSWORD=app "$PG_NEU" psql -X -At -h 127.0.0.1 -U vermieteros_app -d vermieteros "$@"; }
mandant=$(docker exec "$PG_NEU" psql -X -At -U postgres -d vermieteros -c "select id from mandanten order by id limit 1")
ohne=$(app_neu -c "select count(*) from objekte_aktuell")
mit=$(app_neu -c "select set_config('app.mandant_id', '$mandant', false)" -c "select count(*) from objekte_aktuell" | tail -n 1)
echo "App-Rolle nach Restore: ohne Mandant $ohne Objekte, mit Mandant $mit"
[ "$ohne" = 0 ] && [ "$mit" = 1 ] || { echo "FEHLER: RLS oder Rechte nach Restore falsch"; exit 1; }

# Erwartet, dass ein Befehl scheitert, und zwar mit dem genannten Grund.
scheitert_mit() {
  grund=$1
  shift
  if ausgabe=$("$@" 2>&1); then
    echo "$ausgabe"
    echo "FEHLER: erwartet war ein Abbruch wegen: $grund"
    exit 1
  fi
  grep -q "$grund" <<<"$ausgabe" || {
    echo "$ausgabe"
    echo "FEHLER: Abbruch, aber nicht wegen: $grund"
    exit 1
  }
  echo "abgewiesen: $(grep -m1 "$grund" <<<"$ausgabe")"
}
name=$(ops rclone lsf --include '*.sha256' ziel:backup/probe | sed 's/\.sha256$//')

schritt "Gegenprobe: Wiederherstellung über bestehende Daten wird verweigert"
scheitert_mit 'ist nicht leer' ops_neu wiederherstellen

schritt "Gegenprobe: Backup ohne die zuletzt gemeldeten Ereignisse wird erkannt"
# Manifest meldet einen späteren Kettenkopf als der Dump enthält; Prüfsummen passend neu gesetzt.
ops sh -c "set -e; cd /tmp; rclone copy ziel:backup/probe . --include '$name.*'
  sed -i 's/\"seq\" : \([0-9]*\)/\"seq\" : 99\1/' $name.manifest.json
  sha256sum $name.dump.age $name.manifest.json > $name.sha256
  rclone copy . ziel:backup/probe --include '$name.*'"
scheitert_mit 'Kettenkopf' ops restore-test "$name"

schritt "Gegenprobe: veränderte Backup-Datei wird abgewiesen"
ops sh -c "rclone cat ziel:backup/probe/$name.dump.age > /tmp/d && printf x >> /tmp/d && rclone copyto /tmp/d ziel:backup/probe/$name.dump.age"
scheitert_mit 'Prüfsumme' ops restore-test "$name"

schritt "Neues Backup, danach Integritätsprüfung mit seinem Manifest als Anker"
sleep 1 # Backup-Namen haben Sekundenauflösung
ops backup
ops integritaet

schritt "Gegenprobe: vollständig neu berechnete Kette fällt am Anker auf"
# Angreifer mit Datenbankzugang ändert ein Ereignis und rechnet alle Hashes danach neu.
docker exec -i "$PG" psql -q -v ON_ERROR_STOP=1 -U postgres -d vermieteros <<'SQL'
ALTER TABLE ereignisse DISABLE TRIGGER USER;
DO $$
DECLARE
  m uuid := (SELECT mandant_id FROM ereignisse ORDER BY mandant_id LIMIT 1);
  r ereignisse;
  v_prev text := repeat('0', 64);
BEGIN
  UPDATE ereignisse SET payload = payload || '{"umgeschrieben": true}' WHERE mandant_id = m AND seq = 2;
  FOR r IN SELECT * FROM ereignisse WHERE mandant_id = m ORDER BY seq LOOP
    r.prev_hash := v_prev;
    r.hash := encode(digest(ereignis_hash_eingabe(r), 'sha256'), 'hex');
    UPDATE ereignisse SET prev_hash = r.prev_hash, hash = r.hash WHERE id = r.id;
    v_prev := r.hash;
  END LOOP;
END $$;
ALTER TABLE ereignisse ENABLE TRIGGER USER;
SQL
scheitert_mit 'Kettenkopf weicht vom Backup' ops integritaet

schritt "Gegenprobe: manipulierte Kette wird nachts erkannt"
docker exec "$PG" psql -q -U postgres -d vermieteros -c "
  ALTER TABLE ereignisse DISABLE TRIGGER USER;
  UPDATE ereignisse SET payload = payload || '{\"manipuliert\": true}' WHERE seq = 2;
  ALTER TABLE ereignisse ENABLE TRIGGER USER;"
scheitert_mit 'hash passt nicht zum Inhalt' ops integritaet

schritt "Betriebsprobe bestanden"
