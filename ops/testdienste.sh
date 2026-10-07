#!/usr/bin/env bash
# Startet die Dienste für Integrations- und E2E-Tests des Mail-Eingangs (lokal und in CI):
#   GreenMail  SMTP 3025, IMAP 3143 (ohne TLS, jede Anmeldung gilt)
#   S3         rclone serve s3 auf 9100, Zugang test / test-geheim
# Beenden: ops/testdienste.sh stop
set -euo pipefail
if [ "${1:-}" = stop ]; then
  docker rm -f vos-test-mail vos-test-s3 >/dev/null 2>&1 || true
  exit 0
fi
docker rm -f vos-test-mail vos-test-s3 >/dev/null 2>&1 || true
docker run -d --name vos-test-mail -p 127.0.0.1:3025:3025 -p 127.0.0.1:3143:3143 \
  -e GREENMAIL_OPTS='-Dgreenmail.setup.test.smtp -Dgreenmail.setup.test.imap -Dgreenmail.hostname=0.0.0.0 -Dgreenmail.auth.disabled' \
  greenmail/standalone:2.1.5 >/dev/null
docker run -d --name vos-test-s3 -p 127.0.0.1:9100:9000 \
  rclone/rclone:1.71 serve s3 --auth-key test,test-geheim --addr :9000 /data >/dev/null
for _ in $(seq 60); do
  if (exec 3<>/dev/tcp/127.0.0.1/3143) 2>/dev/null && (exec 3<>/dev/tcp/127.0.0.1/9100) 2>/dev/null; then
    echo "Testdienste bereit"
    exit 0
  fi
  sleep 1
done
echo "Testdienste starten nicht"
docker logs vos-test-mail | tail -20
exit 1
