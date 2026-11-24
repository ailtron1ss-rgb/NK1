#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
ROOT="${KURISU_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$ROOT"
pkg update -y
pkg install nodejs-lts npm unzip curl coreutils bash termux-api -y
if command -v termux-api-start >/dev/null 2>&1; then termux-api-start >/dev/null 2>&1 || true; fi
npm ci
npm run device:preflight
npm run typecheck
npm run test:smoke
npm run test:p19
mkdir -p state/logs
printf '[%s] P19 install complete\n' "$(date -Is)" >> state/logs/install.log
cat <<'OUT'

Neuro-Kurisu is ready.
Start:            npm start
Long-lived:       bash scripts/termux/supervisor.sh
Health:           curl -s http://127.0.0.1:3000/api/health
Metrics:          curl -s http://127.0.0.1:3000/api/metrics
Adaptive state:   curl -s http://127.0.0.1:3000/api/organism/adaptive-development
OUT
