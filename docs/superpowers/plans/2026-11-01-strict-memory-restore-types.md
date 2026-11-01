# Strict Memory Restore Numeric Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject numeric-looking strings in canonical MemoryOS2 snapshot numeric fields.

**Architecture:** Keep restore normalization in MemoryOS2. Add an isolated real restore regression using MemoryOS2 itself, then tighten the numeric guard.

**Tech Stack:** TypeScript, Node.js regression scripts, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-01-strict-memory-restore-types-design.md`

## Global Constraints
- JSON snapshot numeric fields must be finite numbers, not strings.
- Invalid non-null expiry closes the validity interval.
- Invalid fact confidence downgrades epistemic status to unknown.
- MemoryOS2 remains the sole writable owner.

## Review Focus
- Numeric-looking strings in timestamps must use safe fallback values.
- Numeric-looking strings in salience must not become trusted scores.
- Numeric-looking strings in confidence must not preserve fact status.
- Invalid expiry must not make a historical memory appear current.
- Ordinary finite numeric values must continue to restore unchanged.

---

### Task 1: Regression for numeric-string restore

**Files:**
- Modify: `runtime/neuro-kurisu/tests/memory-restore-shape-hardening.mjs`

- [ ] Add an isolated restore fixture with string-valued timestamps, salience and confidence.
- [ ] Assert safe timestamp fallback, closed validity interval, salience/confidence fallback and epistemic downgrade.
- [ ] Run the targeted restore workflow and confirm the new assertions fail against current code.

### Task 2: Strict numeric normalization

**Files:**
- Modify: `runtime/neuro-kurisu/src/organism/developmental/MemoryOS2.ts`
- Modify: `CHANGELOG.md`

- [ ] Change the numeric helper to accept only finite values whose runtime type is number.
- [ ] Validate fact confidence without Number() coercion.
- [ ] Record the compatibility boundary and regression coverage in CHANGELOG.
- [ ] Run targeted restore workflow and core regression on the exact branch head.
