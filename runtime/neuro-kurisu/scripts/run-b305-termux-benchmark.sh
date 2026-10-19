#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
printf '=== Neuro-Kurisu B305 Termux benchmark ===\n'
printf 'date=%s\n' "$(date -Iseconds)"
printf 'uname=%s\n' "$(uname -a)"
if command -v getprop >/dev/null 2>&1; then
  printf 'android_release=%s\n' "$(getprop ro.build.version.release)"
  printf 'android_sdk=%s\n' "$(getprop ro.build.version.sdk)"
  printf 'device=%s\n' "$(getprop ro.product.manufacturer) $(getprop ro.product.model)"
fi
if command -v termux-info >/dev/null 2>&1; then
  termux-info 2>/dev/null | sed -n '1,18p' || true
fi
printf '%s\n' '--- /proc/meminfo ---'
sed -n '1,8p' /proc/meminfo || true
printf '%s\n' '--- benchmark ---'
B305_CYCLES="${B305_CYCLES:-48}" node --experimental-strip-types tests/big-pass-305-termux-benchmark.mjs
