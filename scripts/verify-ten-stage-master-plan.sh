#!/usr/bin/env bash
# NK1 — проверка целостности 10-этапного мастер-плана.
set -euo pipefail

PLAN_FILE="docs/NK1_FINAL_MASTER_PLAN_2026-10-30_RU.md"
if [[ ! -f "$PLAN_FILE" ]]; then
  echo "[FAIL] Missing master plan: $PLAN_FILE" >&2
  exit 1
fi

python3 - <<'PY'
import re
from pathlib import Path

text = Path("docs/NK1_FINAL_MASTER_PLAN_2026-10-30_RU.md").read_text(encoding="utf-8")

stages = [int(x) for x in re.findall(r"^## Этап (\d+)\.", text, flags=re.MULTILINE)]
assert stages == list(range(1, 11)), f"Expected stages 1..10, got {stages}"

mandatory = re.findall(r"^### Обязательные работы$", text, flags=re.MULTILINE)
exits = re.findall(r"^### Критерий выхода$", text, flags=re.MULTILINE)
assert len(mandatory) == 10, f"Expected 10 mandatory-work sections, got {len(mandatory)}"
assert len(exits) == 10, f"Expected 10 exit-criteria sections, got {len(exits)}"

checklist = re.findall(r"^\s*-\s*\[\s*\]", text, flags=re.MULTILINE)
assert len(checklist) == 71, f"Expected 71 checklist items, got {len(checklist)}"

protocol = "## Протокол продвижения статусов (Status Progression Protocol)"
for state in ("PLANNED", "IMPLEMENTED", "TESTED", "INTEGRATED", "MEASURED", "RELEASED"):
    assert state in text, f"Missing status: {state}"
assert protocol in text, "Missing status progression protocol"

rules_part = text.split("## Неподлежащие компромиссу правила исполнения", 1)
assert len(rules_part) == 2, "Missing non-negotiable rules section"
rules = re.findall(r"^\d+\.\s+\*\*", rules_part[1], flags=re.MULTILINE)
assert len(rules) == 6, f"Expected 6 non-negotiable rules, got {len(rules)}"

assert "NK1_FINAL_MASTER_PLAN_2026-10-28_RU.md" in text, "Missing detailed 30-phase plan link"
print("PASS: 10 stages, 10 mandatory sections, 10 exit criteria, 71 checklist items, status protocol, 6 execution rules, detailed-plan link.")
PY
