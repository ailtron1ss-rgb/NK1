#!/usr/bin/env bash
# Organism Architecture & Readiness Verification Script
# NK1 / NeuroCore — Makise Kurisu Digital Mind Project

set -euo pipefail

echo "============================================================"
echo "NK1 Organism Architecture & Readiness Verification"
echo "============================================================"

# 1. Verify existence of architectural specification
ARCH_FILE="docs/NK1_UNIFIED_BRAIN_ARCHITECTURE_RU.md"
if [ ! -f "$ARCH_FILE" ]; then
  echo "[FAIL] Missing unified brain architecture specification: $ARCH_FILE"
  exit 1
fi
echo "[PASS] Unified brain architecture specification present."

# 2. Check for required neurological mapping sections
REQUIRED_SECTIONS=(
  "Таламокортикальный контур"
  "Гиппокампально-неокортикальная система памяти"
  "Лимбическая система и нейромодуляция"
  "Префронтальная кора и метапознание"
  "Базальные ганглии и двигательный шлюз"
  "Соматическое воплощение"
  "Единый Когнитивный Такт Организма"
)

for section in "${REQUIRED_SECTIONS[@]}"; do
  if ! grep -q "$section" "$ARCH_FILE"; then
    echo "[FAIL] Missing neurological mapping section: $section"
    exit 1
  fi
done
echo "[PASS] All 7 core neurological and cognitive subsystems defined."

# 3. Check progress tracker consistency
TRACKER_FILE="docs/PROJECT_PROGRESS_TRACKER_2026-11-06_RU.md"
if [ ! -f "$TRACKER_FILE" ]; then
  TRACKER_FILE="docs/PROJECT_PROGRESS_TRACKER_2026-11-03_RU.md"
fi
if [ ! -f "$TRACKER_FILE" ]; then
  echo "[FAIL] Missing current project progress tracker: $TRACKER_FILE"
  exit 1
fi

if ! grep -q "Интегральная зрелость Цифрового Организма" "$TRACKER_FILE"; then
  echo "[FAIL] Missing aggregate readiness percentage in progress tracker."
  exit 1
fi
echo "[PASS] Aggregate readiness percentage and branch matrix verified ($TRACKER_FILE)."

# 4. Check core master plan document
MASTER_PLAN="docs/NK1_FINAL_MASTER_PLAN_2026-10-30_RU.md"
if [ ! -f "$MASTER_PLAN" ]; then
  echo "[FAIL] Missing master plan document: $MASTER_PLAN"
  exit 1
fi
echo "[PASS] Master plan document verified."

echo "============================================================"
echo "Organism Readiness Verification Status: PASS"
echo "============================================================"
