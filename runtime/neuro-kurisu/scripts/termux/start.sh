#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
ROOT="${KURISU_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$ROOT"
# Medium-phone default: bound V8 old-space to limit retained RSS after heavy checkpoints.
# Override with NEURO_NODE_MAX_OLD_SPACE_MB or an explicit NODE_OPTIONS when device capacity differs.
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=${NEURO_NODE_MAX_OLD_SPACE_MB:-192}}"
exec env HOST="${HOST:-127.0.0.1}" PORT="${PORT:-3000}" node --experimental-strip-types src/server/server.mjs
