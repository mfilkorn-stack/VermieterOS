# Gemeinsame Hilfen für die Betriebsskripte. Wird per `. gemeinsam.sh` eingebunden.
set -eu
# shellcheck disable=SC3040 # BusyBox ash im Ops-Image kennt pipefail
set -o pipefail

log() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2; }
fehler() {
  log "FEHLER: $*"
  exit 1
}

# Totmannschalter im Stil von healthchecks.io: <url>/start, <url>, <url>/fail mit Text.
# Ohne URL nur Log. Ein nicht erreichbarer Monitor bricht den Job nicht ab.
melde() {
  url=$1
  art=$2
  text=${3:-}
  [ -n "$url" ] || return 0
  case $art in
    start) ziel="$url/start" ;;
    ok) ziel="$url" ;;
    fail) ziel="$url/fail" ;;
  esac
  wget -q -T 10 -O /dev/null --post-data "$text" "$ziel" 2>/dev/null || log "Monitor nicht erreichbar: $ziel"
}
