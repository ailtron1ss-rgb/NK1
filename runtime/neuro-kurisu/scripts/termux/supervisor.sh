#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
ROOT="${KURISU_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$ROOT"
# Medium-phone default: bound V8 old-space to limit retained RSS after heavy checkpoints.
# Override with NEURO_NODE_MAX_OLD_SPACE_MB or an explicit NODE_OPTIONS when device capacity differs.
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=${NEURO_NODE_MAX_OLD_SPACE_MB:-192}}"
mkdir -p state/logs
WAKE_LOCK=0
if command -v termux-wake-lock >/dev/null 2>&1; then
  termux-wake-lock || true
  WAKE_LOCK=1
fi
cleanup() {
  if [ "$WAKE_LOCK" -eq 1 ] && command -v termux-wake-unlock >/dev/null 2>&1; then
    termux-wake-unlock || true
  fi
}
trap cleanup EXIT INT TERM
backoff=2
max_backoff=60
while true; do
  echo "[$(date -Is)] start backoff=${backoff}s" >> state/logs/supervisor.log
  if node --experimental-strip-types src/server/server.mjs >> state/logs/server.log 2>&1; then
    echo "[$(date -Is)] clean-exit" >> state/logs/supervisor.log
    backoff=2
    sleep 1
  else
    code=$?
    echo "[$(date -Is)] crash exit=${code}; next=${backoff}s" >> state/logs/supervisor.log
    sleep "$backoff"
    if [ "$backoff" -lt "$max_backoff" ]; then backoff=$((backoff * 2)); [ "$backoff" -gt "$max_backoff" ] && backoff="$max_backoff"; fi
  fi
done
