#!/usr/bin/env bash
set -euo pipefail

PLAN_FILE="docs/NK1_FINAL_MASTER_PLAN_2026-10-30_RU.md"

echo "============================================================"
echo "NK1 Final Master Plan (10 Vital Stages) Completeness Audit"
echo "============================================================"

if [[ ! -f "$PLAN_FILE" ]]; then
  echo "[FAIL] Missing master plan file: $PLAN_FILE" >&2
  return 1 2>/dev/null || exit 1
fi

python3 - << 'PYEOF'
import sys
import re

plan_file = "docs/NK1_FINAL_MASTER_PLAN_2026-10-30_RU.md"
with open(plan_file, "r", encoding="utf-8") as f:
    text = f.read()

# 1. Verify 10 stages exist
stages = re.findall(r'^## Этап (\d+)\.\s+(.*)$', text, flags=re.MULTILINE)
stage_nums = [int(s[0]) for s in stages]
expected_stage_nums = list(range(1, 11))
if stage_nums != expected_stage_nums:
    print(f"[FAIL] Expected stages 1..10, got {stage_nums}", file=sys.stderr)
    sys.exit(1)
print("[PASS] Verified 10 sequential stages (1..10).")

# 2. Verify all 10 stages have Mandatory works and Exit criteria
mandatory_headers = re.findall(r'^### Обязательные работы', text, flags=re.MULTILINE)
exit_criteria = re.findall(r'^### Критерий выхода', text, flags=re.MULTILINE)
if len(mandatory_headers) != 10 or len(exit_criteria) != 10:
    print(f"[FAIL] Expected 10 mandatory work sections and 10 exit criteria sections, got {len(mandatory_headers)} and {len(exit_criteria)}", file=sys.stderr)
    sys.exit(1)
print("[PASS] Verified 10 mandatory work sections and 10 exit criteria sections.")

# 3. Verify checklist items (- [ ])
checklist_items = re.findall(r'^\s*-\s*\[\s*\]', text, flags=re.MULTILINE)
if len(checklist_items) != 71:
    print(f"[FAIL] Expected 71 checklist items (- [ ]), found {len(checklist_items)}", file=sys.stderr)
    sys.exit(1)
print("[PASS] Verified all 71 checklist items (- [ ]) across 10 stages and 10 readiness criteria.")

# 4. Verify 6 non-negotiable rules
rules_part = text.split("## Неподлежащие компромиссу правила исполнения")[-1]
rules = re.findall(r'^\d+\.\s+\*\*', rules_part, flags=re.MULTILINE)
if len(rules) != 6:
    print(f"[FAIL] Expected 6 non-negotiable execution rules, found {len(rules)}", file=sys.stderr)
    sys.exit(1)
print("[PASS] Verified 6 non-negotiable execution rules.")

print("============================================================")
print("Final Master Plan Completeness Audit: PASS")
print("============================================================")
PYEOF
