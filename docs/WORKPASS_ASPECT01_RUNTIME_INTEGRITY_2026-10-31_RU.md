# NK1 Aspect 01 — Cognitive runtime integrity pass

**Date:** 2026-10-31  
**Base:** `workpass70-source` at `ae67e35fb276002106d66702192d3cbdbd6b82d5`  
**Branch:** `work/nk1-aspect01-runtime-integrity-2026-10-31`

## Scope

This pass closes two concrete integrity gaps in the current source without introducing another runtime or canonical state owner.

## 1. Cognitive phase contract

`UnifiedCognitiveCycle` supports the existing six-stage integration contract for legacy callers. When a caller supplies any expanded marker (`appraisal`, `attention`, `memory`, `goal`, or `plan`), the evaluation switches to the complete eleven-stage contract:

`observation → prediction → appraisal → attention → memory → goal → plan → action → outcome → learning → self-update`

Every required phase must have a bounded, explicit event ID; IDs must be distinct within the cycle. Inherited stage IDs are not evidence. A cycle with partial expanded evidence is incomplete, not silently accepted as a six-stage success.

## 2. Bounded substrate projection

`UnifiedCognitiveSubstrate` remains a bounded cross-system projection, not a canonical domain owner. Restore now copies an explicit allow-list from own enumerable fields, validates schema version, safe counters, finite normalized metrics and bounded labels, and reconstructs nested records. Unknown fields and prototype-inherited data are ignored. Unsupported versions fail before replacing the previous valid projection.

## 3. Tick and mutation discipline

`integrate()` accepts only a non-negative safe-integer tick strictly greater than the previous tick. It validates required input groups and cycle-counter capacity before committing a new projection. Replayed ticks, malformed groups and unsupported restores must leave the last valid state unchanged.

## 4. Regression coverage

Run:

```bash
npm run test:aspect01:cognitive-runtime-integrity
npm run test:workpass287:cognitive-cycle
npm run typecheck
```

The new regression covers legacy compatibility, partial and complete eleven-stage cycles, duplicate event IDs, prototype-supplied IDs, replay non-mutation, polluted restore records, unsupported schema versions, bounded projection fields and invalid integration non-mutation.

CI registration is in `.github/workflows/workpass287-288-cognitive-contracts.yml`.

## 5. What this does not claim

- Source-level regressions are not proof of end-to-end runtime lineage.
- This pass does not prove interrupted process restart safety, long-run heap/latency bounds, Android/Termux behavior or real-world autonomous initiative.
- It does not split the 1.32 MB `OrganismCore.ts`; that remains a separate incremental modularization task.
- It does not update the canonical Release ZIP.

## Next P0

1. Execute the targeted regression and typecheck on this exact branch HEAD.
2. Verify all normal and reduced-resolution runtime paths supply the same eleven-phase lineage contract.
3. Add restart-in-the-middle tests for each cycle phase and prove idempotent outcome/learning credit.
4. Audit canonical-state writers and remove duplicate ownership only with call-site/persistence migration evidence.
5. Add deterministic long-run tick, heap and checkpoint benchmarks; validate on target Android hardware.
6. Rebase/merge only after exact-HEAD gates are green; refresh the Release ZIP from the verified source snapshot.
