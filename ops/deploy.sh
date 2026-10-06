#!/bin/sh
# Deployment auf dem Server: ops/deploy.sh <tag> [--ohne-backup]
# Zieht die Images, sichert vor der Migration, migriert, startet neu und wartet auf gesunde Dienste.
set -eu
cd "$(dirname "$0")"
tag=${1:?Aufruf: deploy.sh <tag> [--ohne-backup]}
[ -f .env ] || { echo ".env fehlt (Vorlage: env.beispiel)"; exit 1; }

sed -i "s/^TAG=.*/TAG=$tag/" .env
docker compose pull --quiet
if [ "${2:-}" != "--ohne-backup" ]; then
  echo "Backup vor dem Deployment"
  docker compose run --rm ops backup
fi
docker compose run --rm migrate
docker compose up -d --wait --remove-orphans
docker compose ps
