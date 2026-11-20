#!/usr/bin/env bash
# NK1 — integrity check for the canonical 30-phase / 300-step plan.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"
PLAN_FILE="docs/NK1_FINAL_MASTER_PLAN_2026-10-28_RU.md"

if [[ ! -f "$PLAN_FILE" ]]; then
  echo "[FAIL] Missing master plan: $PLAN_FILE" >&2
  exit 1
fi

python3 - "$PLAN_FILE" <<'PY'
import re
import sys
from pathlib import Path

plan_path = Path(sys.argv[1])
text = plan_path.read_text(encoding="utf-8")

phases = [int(number) for number, _ in re.findall(
    r"^## (\d{2})\.\s+(.*)$", text, flags=re.MULTILINE
)]
expected_phases = list(range(1, 31))
assert phases == expected_phases, (
    f"Expected 30 sequential phases 01..30, got {phases}"
)
print("[PASS] 30 sequential phases (01..30).")

step_pattern = (
    r"^(\d+)\.\s+\*\*(.*?)\*\*\n"
    r"\s+\*Подшаги:\*\s+(.*?)\n"
    r"\s+\*Условие завершения:\*\s+(.*?)\n"
    r"\s+\*Обязательная фиксация:\*\s+(.*?)"
    r"(?=\n\d+\.|\n\*\*Gate фазы:\*\*|\Z)"
)
steps = list(re.finditer(
    step_pattern, text, flags=re.MULTILINE | re.DOTALL
))
step_numbers = [int(match.group(1)) for match in steps]
expected_steps = list(range(1, 301))
assert step_numbers == expected_steps, (
    f"Expected 300 sequential structured steps, found {len(steps)}; "
    f"sequence starts {step_numbers[:5]} and ends {step_numbers[-5:]}"
)
assert all(all(match.group(i).strip() for i in range(2, 6)) for match in steps), (
    "Every step must contain description, substeps, completion criteria, "
    "and mandatory evidence."
)
print("[PASS] 300 sequential steps with all required evidence fields.")

phase_gates = re.findall(r"^\*Gate фазы:\*", text, flags=re.MULTILINE)
assert len(phase_gates) == 30, (
    f"Expected 30 phase gates, found {len(phase_gates)}"
)
print("[PASS] 30 phase gates.")

completion_criteria = re.findall(r"^- \[ \]", text, flags=re.MULTILINE)
assert len(completion_criteria) == 15, (
    f"Expected 15 overall completion criteria, found {len(completion_criteria)}"
)
print("[PASS] 15 overall completion criteria.")

upstream_candidates = re.findall(
    r"^\|\s+\*\*(.*?)\*\*\s+\|", text, flags=re.MULTILINE
)
assert len(upstream_candidates) >= 14, (
    f"Expected at least 14 upstream candidates, found {len(upstream_candidates)}"
)
print(f"[PASS] {len(upstream_candidates)} upstream candidates and integration boundaries.")
print("Master Plan Completeness Audit (30 phases / 300 steps): PASS")
PY
