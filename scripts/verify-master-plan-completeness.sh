#!/usr/bin/env bash
# NK1 Master Plan Completeness & Integrity Verification Script
# Neuro Kurisu / NK1

set -euo pipefail

echo "============================================================"
echo "NK1: Master Plan (16 Phases · 160 Steps) Integrity Check"
echo "============================================================"

PLAN_FILE="docs/NK1_COMPLETE_MASTER_PLAN_16_PHASES_RU.md"
TRACKER_FILE="docs/PROJECT_PROGRESS_TRACKER_2026-10-30_RU.md"
README_FILE="README.md"

if [ ! -f "$PLAN_FILE" ]; then
  echo "[FAIL] Missing plan file: $PLAN_FILE"
  exit 1
fi

python3 - << 'PY'
import sys, re, pathlib

plan_path = pathlib.Path("docs/NK1_COMPLETE_MASTER_PLAN_16_PHASES_RU.md")
tracker_path = pathlib.Path("docs/PROJECT_PROGRESS_TRACKER_2026-10-30_RU.md")
readme_path = pathlib.Path("README.md")

plan_text = plan_path.read_text(encoding="utf-8")
tracker_text = tracker_path.read_text(encoding="utf-8")
readme_text = readme_path.read_text(encoding="utf-8")

# 1. Check all 16 phases exist in plan
phases = re.findall(r"## Фаза (\d+)\.", plan_text)
expected_phases = [str(i) for i in range(1, 17)]
if phases != expected_phases:
    print(f"[FAIL] Phases mismatch. Found {phases}, expected {expected_phases}")
    sys.exit(1)
print(f"[PASS] All 16 phases verified in canonical plan.")

# 2. Check 160 steps exist in plan
steps = re.findall(r"- \[ \] \*\*Шаг (\d+\.\d+)\.\*\*", plan_text)
if len(steps) != 160:
    print(f"[FAIL] Expected 160 steps, found {len(steps)}")
    sys.exit(1)
print(f"[PASS] All 160 steps verified in canonical plan.")

# 3. Check per-phase step distribution (10 per phase)
for phase_idx in range(1, 17):
    phase_steps = [s for s in steps if s.startswith(f"{phase_idx}.")]
    if len(phase_steps) != 10:
        print(f"[FAIL] Phase {phase_idx} has {len(phase_steps)} steps instead of 10")
        sys.exit(1)
print(f"[PASS] Each phase contains exactly 10 structured steps.")

# 4. Check Mandatory Final Gates
assert "## Обязательные финальные gates" in plan_text, "Missing final gates section"
gates = re.findall(r"\d+\. \[ \] (.+)", plan_text)
if len(gates) < 10:
    print(f"[FAIL] Less than 10 final gates found: {len(gates)}")
    sys.exit(1)
print(f"[PASS] Mandatory final gates section verified ({len(gates)} gates).")

# 5. Check Progress Regulation & UNVERIFIED status rule
assert "## Регламент зачёта прогресса" in plan_text, "Missing progress regulation section"
assert "UNVERIFIED" in plan_text, "Missing UNVERIFIED rule"
print(f"[PASS] Progress accounting and UNVERIFIED gating rule verified.")

# 6. Check linkage in README and Progress Tracker
assert "NK1_COMPLETE_MASTER_PLAN_16_PHASES_RU.md" in readme_text, "Missing link in README.md"
assert "NK1_COMPLETE_MASTER_PLAN_16_PHASES_RU.md" in tracker_text, "Missing link in tracker"
print(f"[PASS] Plan references verified in README.md and progress tracker.")

print("\nAll Master Plan verification checks passed successfully!")
PY

echo "============================================================"
echo "Master Plan Verification Status: PASS"
echo "============================================================"
