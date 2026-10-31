# Memory Restore Integrity Implementation Plan

> **For agentic workers:** Implement this plan task-by-task with test-first verification.

**Goal:** Make MemoryOS2 restore deterministic and fail-closed for malformed or duplicate persisted memory rows without replacing canonical memory ownership.

**Architecture:** Keep MemoryOS2 as the only writable memory owner. Normalize untrusted snapshot rows before indexing, resolve duplicate IDs using temporal/revision authority, quarantine tied conflicting facts, and expose bounded diagnostics through the existing read-only doctor.

**Tech stack:** TypeScript, Node.js strip-types regression scripts, GitHub Actions.

**Spec:** Existing WorkPass389 restore-integrity implementation, selectively ported from its stale branch onto the current canonical source.

## Global Constraints
- Work only from `workpass70-source` current lineage.
- Do not import the stale branch history wholesale.
- Preserve current revision-edge integrity findings and all newer MemoryOS2 APIs.
- Do not mutate live memory during benchmark/restore tests.
- Do not claim production recall uplift from restore integrity tests.

## Review Focus
- Duplicate IDs in either snapshot order.
- Equal-authority conflicting payloads with the same ID.
- Malformed row shapes, identity, source, confidence, expiry and vectors.
- Legacy snapshots missing optional fields.
- Existing revision-integrity findings must survive restore.

---

### Task 1: Regression-first restore contracts

**Files:**
- Create: `runtime/neuro-kurisu/tests/memory-restore-duplicate-identity.mjs`
- Create: `runtime/neuro-kurisu/tests/memory-restore-shape-hardening.mjs`
- Create: `.github/workflows/workpass81-memory-restore-integrity.yml`

- [ ] Run the new tests before implementation and record expected failures.

### Task 2: Normalize and deduplicate restore rows

**Files:**
- Modify: `runtime/neuro-kurisu/src/organism/developmental/MemoryOS2.ts`

- [ ] Add bounded restore diagnostics and canonical JSON fingerprinting.
- [ ] Normalize persisted rows before state construction and index rebuilding.
- [ ] Select duplicate identities deterministically; quarantine tied conflicting factual rows.
- [ ] Preserve existing revision integrity findings and normalize restore diagnostics.
- [ ] Extend read-only doctor with restore repair findings.

### Task 3: Verify

- [ ] Run typecheck and both focused restore regressions through exact-head GitHub Actions.
- [ ] Run the broader memory acceptance workflow if the focused gate passes.
