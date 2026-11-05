#!/usr/bin/env bash
# Organism Architecture & Readiness Verification Script
# NK1 / NeuroCore

set -euo pipefail

echo "============================================================"
echo "NK1 Organism Architecture & Readiness Verification"
echo "============================================================"

# 1. Verify existence of canonical strategic and architectural documentation
echo "[1/4] Verifying canonical strategic and architectural documentation..."
DOCS_REQUIRED=(
  "docs/NK1_FINAL_MASTER_PLAN_2026-10-30_RU.md"
  "docs/NK1_STRATEGIC_DEVELOPMENT_ROADMAP_RU.md"
  "docs/PROJECT_PROGRESS_TRACKER_2026-10-30_RU.md"
)

for doc in "${DOCS_REQUIRED[@]}"; do
  if [ -f "$doc" ]; then
    echo "  [PASS] Found $doc ($(wc -l < "$doc") lines)"
  else
    echo "  [FAIL] Missing required documentation: $doc"
    return 1 2>/dev/null || exit 1
  fi
done

# 2. Verify priority sequence consistency (2 -> 4 -> 3 -> 1) in roadmap
echo "[2/4] Verifying sequence protocol (2 -> 4 -> 3 -> 1)..."
python3 - << 'PY'
import sys

with open("docs/NK1_STRATEGIC_DEVELOPMENT_ROADMAP_RU.md", "r", encoding="utf-8") as f:
    content = f.read()

required_tokens = [
    "2 → 4 → 3 → 1",
    "Направление 2",
    "Направление 4",
    "Направление 3",
    "Направление 1",
    "PLANNED",
    "RELEASED",
    "FileStateStore",
    "MemoryOS2",
    "AvatarStage",
    "recallDelta"
]

for token in required_tokens:
    if token not in content:
        print(f"  [FAIL] Missing required token in roadmap: {token}")
        sys.exit(1)
    else:
        print(f"  [PASS] Verified token: {token}")
PY

# 3. Verify Stage 1 Release Reproducibility
echo "[3/4] Running Stage 1 release reproducibility check..."
bash scripts/verify-release-reproducibility.sh > /dev/null
echo "  [PASS] Stage 1 release reproducibility verified."

# 4. Verify status progression protocol invariants
echo "[4/4] Validating gating invariants and tracker completeness..."
python3 - << 'PY'
import json, re, pathlib

tracker_file = pathlib.Path("docs/PROJECT_PROGRESS_TRACKER_2026-10-30_RU.md")
text = tracker_file.read_text(encoding="utf-8")

# Check that open gates are explicitly highlighted
open_gates = ["recallDelta", "live2d", "android", "браузер", "лиценз"]
for gate in open_gates:
    assert gate.lower() in text.lower(), f"Gate {gate} missing from tracker"

print(f"  [PASS] All critical release gates accounted for in progress tracker.")
PY

echo "============================================================"
echo "Organism Readiness Verification: ALL PASS"
echo "============================================================"
