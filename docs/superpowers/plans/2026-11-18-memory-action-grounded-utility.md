# Memory Action-Grounded Utility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox syntax for tracking.

**Goal:** Extend the existing canonical MemoryFabric task-conditioned utility ledger so a trusted paired evaluation can measure whether memory improves subsequent real action outcomes without creating a second memory owner or changing retrieval policy.

**Architecture:** Keep the existing MemoryTaskConditionedUtilityLedger as the only evidence ledger and MemoryFabric/MemoryOS2 as the canonical memory owner. Add hash-only paired action trajectory evidence to the existing resolution envelope, bind that evidence into the exact OutcomeVerificationService receipt, persist it with existing outcomes for audit, and expose estimates only from current-process trusted receipts after restore.

**Tech Stack:** TypeScript 5.9.3, Node 24 strip-types tests, existing MemoryFabric, MemoryOS2, ActionGateway and OutcomeVerificationService. No new runtime packages.

**Spec:** This plan and `docs/research/MEMORY_ACTION_GROUNDED_EVALUATION_RU.md`.

## Global Constraints
- Do not add another memory database, agent runtime, or authoritative registry.
- Preserve `MemoryOS2` as sole canonical writable memory owner.
- Keep existing task-conditioned utility backward compatible and audit-only.
- Bind every action-evidence value into the exact external evaluator receipt; caller booleans, copied receipts, altered tuples and untrusted objects must fail closed.
- Store fingerprints and bounded numeric scores only; no prompt text, memory content, user identifiers or raw task trajectories.
- Persist historical outcomes for audit, but do not reconstruct current-process authority/aggregates from restored snapshots.
- Do not change memory ranking, admission, consolidation, forgetting or retention weights.
- Use identical frozen task, holdout, context, reader, scorer, filler, insertion position and seed across both arms.
- A contract fixture is not real model/phone evidence and must be labelled synthetic.
- No merge, Release ZIP change or claim of production quality gain without explicit CI, real evaluation and release artifact verification.

## Review Focus
- Replayed trusted receipt with one changed action metric must be rejected; its pending pair remains resolvable with the original receipt.
- Malformed score, negative/oversized safety count, malformed fingerprint, extra keys and accessor-backed data must fail closed.
- Identical with-memory/without-memory trace fingerprints must be rejected to prevent arm substitution.
- Restored outcome history is visible for audit but not available as fresh action-evaluation evidence.
- Different task/holdout/context/reader/scorer/filler/insertion conditions must never pool.

## File Structure
- Modify `runtime/neuro-kurisu/src/organism/system/MemoryTaskConditionedUtilityLedger.ts`: hash-only trajectory types, validation, receipt binding, bounded current-process outcome aggregation and diagnostics.
- Modify `runtime/neuro-kurisu/src/organism/memory/MemoryFabric.ts`: read-only canonical facade method.
- Create `runtime/neuro-kurisu/tests/memory-action-grounded-utility-benchmark.mjs`: five paired seeds using real MemoryOS2/ActionGateway in a deterministic sandbox; positive and negative assertions.
- Modify `runtime/neuro-kurisu/package.json` and `.github/workflows/p26-learning-validation.yml`: wire the benchmark into the existing P26 validation.
- Create `docs/research/MEMORY_ACTION_GROUNDED_EVALUATION_RU.md`: metrics, methodology, caveats and next real-world validation gates.

---

### Task 1: Define and validate action trajectory evidence

**Interfaces:**
- Consumes the existing probe and exact utility metrics.
- Produces `MemoryTaskConditionedActionEvidence` with `withMemory` and `withoutMemory` arms, each carrying three SHA-256 fingerprints, completion/progress/grounding/verification/stale-memory rates and a bounded safety-violation count.
- Each arm fingerprint must differ across the pair. Raw text fields and unknown keys are rejected.

- [x] Write the focused benchmark test and observe the expected `invalid-input` failure because the ledger did not yet accept action evidence (observed before implementation).
- [x] Implement the hash-only evidence interfaces and strict nested data-envelope validation.

### Task 2: Bind action evidence to independent verification

**Interfaces:**
- `MemoryTaskConditionedUtilityResolutionInput.actionEvidence?`
- `memoryTaskConditionedUtilityVerificationInput(probe, metrics)` includes the exact normalized action evidence.
- `MemoryTaskConditionedUtilityOutcome.actionEvidence?`

- [x] Include optional action evidence in the verifier input.
- [x] Store only normalized hash/score fields after the exact process-local verifier receipt is accepted.
- [x] Reject altered evidence with the original receipt and verify the original receipt still resolves the pending pair.

### Task 3: Expose a current-process action utility estimate

**Interfaces:**
- `MemoryTaskConditionedUtilityLedger.lookupActionEvidence(query)`
- `MemoryFabric.taskConditionedActionEvidence(query)`
- Estimates include paired completion CI, goal-progress, grounded/verified action deltas, stale-memory and safety regression rates.

- [x] Keep a bounded current-process trusted outcome cache.
- [x] Clear it on restore; preserve historical action evidence only in persisted audit outcomes.
- [x] Return null for unmatched conditions or when no live trusted paired evidence exists.

### Task 4: Integrate test and documentation

- [x] Add benchmark to `test:memory-task-conditioned-utility`.
- [x] Ensure P26 workflow triggers on and executes the new benchmark.
- [x] Run focused ledger/wiring/action benchmark, WorkPass91 memory-to-action and semantic typecheck.
- [ ] Record exact branch SHA, commands, CI and remaining real-world gates.

## Acceptance criteria
- All existing task-conditioned utility tests still pass.
- Five synthetic paired seeds resolve only with exact trusted receipts.
- A forged/mutated evidence tuple cannot resolve the probe.
- Action outcome history survives snapshot/restore, while the restored process yields no current-process estimate.
- MemoryFabric remains the single façade; no policy weights or canonical memory content are mutated by the evaluator.
- Semantic TypeScript typecheck and exact-head P26 workflow pass.

## Remaining external validation (not covered by contract tests)
- Build consented, de-identified trajectories from real NK1 tasks and an immutable held-out session suite.
- Use a host-owned independent evaluator separate from the action executor and model author.
- Run at least five paired seeds per task family, multiple tasks, RU/EN and answerable/unanswerable cases.
- Compare memory-on, memory-off, stale-memory knockout and corrected-memory treatment; include confidence intervals, resource costs and ablations.
- Execute long phone/device soak and compare real-world latency, crash recovery, tool success and forgetting compliance.