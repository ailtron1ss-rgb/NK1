#!/data/data/com.termux/files/usr/bin/bash
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT"
export NEURO_RUNTIME_PROFILE=mobile
export KURISU_SPINE_ONLY=1
printf '%s\n' 'Neuro-Kurisu SPINE_ONLY Termux endurance benchmark'
node --experimental-strip-types tests/big-pass-352-spine-long-horizon.mjs | tee "spine-termux-$(date +%Y%m%d-%H%M%S).json"
