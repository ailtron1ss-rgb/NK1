#!/usr/bin/env bash
set -euo pipefail

PLAN_FILE="docs/NK1_FINAL_MASTER_PLAN_2026-10-28_RU.md"

echo "============================================================"
echo "NK1 Master Plan (30 Phases, 300 Steps) Completeness Audit"
echo "============================================================"

if [[ ! -f "$PLAN_FILE" ]]; then
  echo "[FAIL] Missing master plan file: $PLAN_FILE" >&2
  exit 1
fi

python3 - << 'EOF'
import sys
import re

plan_file = "docs/NK1_FINAL_MASTER_PLAN_2026-10-28_RU.md"
with open(plan_file, "r", encoding="utf-8") as f:
    text = f.read()

# Verify 30 phases
phases = re.findall(r'^## (\d{2})\.\s+(.*)$', text, flags=re.MULTILINE)
phase_nums = [int(p[0]) for p in phases]
expected_phase_nums = list(range(1, 31))
if phase_nums != expected_phase_nums:
    print(f"[FAIL] Expected phases 01..30, got {phase_nums}", file=sys.stderr)
    sys.exit(1)
print(f"[PASS] Verified 30 sequential phases (01..30).")

# Verify 300 steps
step_matches = list(re.finditer(r'^(\d+)\.\s+\*\*(.*?)\*\*\n\s+\*Подшаги:\*\s+(.*?)\n\s+\*Условие завершения:\*\s+(.*?)\n\s+\*Обязательная фиксация:\*\s+(.*?)(?=\n\d+\.|\n\*\*Gate фазы:\*\*|\Z)', text, flags=re.MULTILINE|re.DOTALL))
step_nums = [int(m.group(1)) for m in step_matches]
expected_step_nums = list(range(1, 301))
if step_nums != expected_step_nums:
    print(f"[FAIL] Expected steps 1..300 sequentially, found {len(step_nums)} steps.", file=sys.stderr)
    sys.exit(1)
print(f"[PASS] Verified 300 sequential steps (1..300) with complete sub-steps, completion criteria, and mandatory evidence.")

# Verify 30 phase gates
phase_gates = re.findall(r'^\*Gate фазы:\*', text, flags=re.MULTILINE)
if len(phase_gates) != 30:
    print(f"[FAIL] Expected 30 phase gates, found {len(phase_gates)}", file=sys.stderr)
    sys.exit(1)
print(f"[PASS] Verified 30 phase gates.")

# Verify 15 overall completion criteria
criteria = re.findall(r'^- \[ \]', text, flags=re.MULTILINE)
if len(criteria) != 15:
    print(f"[FAIL] Expected 15 completion criteria checkboxes, found {len(criteria)}", file=sys.stderr)
    sys.exit(1)
print(f"[PASS] Verified 15 overall completion criteria checkboxes.")

# Verify Upstream candidate table contains 14 candidates
upstream_matches = re.findall(r'^\|\s+\*\*(.*?)\*\*\s+\|', text, flags=re.MULTILINE)
if len(upstream_matches) < 14:
    print(f"[FAIL] Expected at least 14 upstream candidates, found {len(upstream_matches)}", file=sys.stderr)
    sys.exit(1)
print(f"[PASS] Verified 14 upstream candidates and integration boundaries.")

print("============================================================")
print("Master Plan Completeness Audit: PASS")
print("============================================================")
EOF
