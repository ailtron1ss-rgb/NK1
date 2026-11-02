#!/usr/bin/env bash
# NK1 software baseline. This verifies selected software contracts only; it is
# not product/release readiness and cannot certify real devices, legal rights,
# independent memory uplift, or subjective consciousness.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

passed=0
failed=0

run_gate() {
  local label="$1"
  shift
  printf '\n[RUN] %s\n' "$label"
  if "$@"; then
    printf '[PASS] %s\n' "$label"
    passed=$((passed + 1))
  else
    local status=$?
    printf '[FAIL] %s (exit=%s)\n' "$label" "$status"
    failed=$((failed + 1))
  fi
}

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "[FAIL] Node.js and npm are required."
  exit 2
fi

printf 'NK1 software baseline | Node %s | npm %s\n' "$(node --version)" "$(npm --version)"

run_gate "Runtime typecheck" npm --prefix runtime/neuro-kurisu run typecheck
run_gate "Cognitive cycle boundary" npm --prefix runtime/neuro-kurisu run test:cognitive-cycle-boundary
run_gate "Action receipt integrity" npm --prefix runtime/neuro-kurisu run test:workpass95:receipt-integrity
run_gate "Action finalizer boundary" npm --prefix runtime/neuro-kurisu run test:workpass96:finalizer-boundary
run_gate "Planner route contract" npm --prefix runtime/neuro-kurisu run test:workpass97:planner-route
run_gate "Project reconciliation route" npm --prefix runtime/neuro-kurisu run test:workpass98:project-reconciliation-route
run_gate "Operational microcycle finite-input contract" npm --prefix runtime/neuro-kurisu run test:workpass318:operational-microcycle-finite-input

run_gate "App typecheck" npm --prefix app run typecheck
run_gate "Avatar motor intent behavior" npm --prefix app run test:avatar-motor-intent
run_gate "Embodiment switch and timeline contracts" npm --prefix app run test:embodiment-switch
run_gate "VRM model preflight" npm --prefix app run test:avatar-model-preflight

printf '\nRESULT: %s passed; %s failed\n' "$passed" "$failed"
printf 'NOT COVERED: independent RU/EN memory holdout; Android/Termux device soak; browser WebGL visual E2E; lip-sync hardware latency; license approval; published Release ZIP verification.\n'
if (( failed > 0 )); then
  echo "SOFTWARE_BASELINE=FAIL"
  exit 1
fi
echo "SOFTWARE_BASELINE=PASS_WITH_EXTERNAL_GATES_PENDING"
