# MemoryOS2 Capacity and Lifecycle Integrity Implementation Plan

> **For agentic workers:** execute the ordered tasks below in sequence. Keep the source branch isolated and use exact-head CI as the integration gate.

**Goal:** eliminate silent memory loss and index/projection divergence during MemoryOS2 capacity overflow, maintenance, restore and snapshot inspection, while preserving the single-canonical-owner architecture.

**Architecture:** MemoryOS2 remains the only canonical writable memory store. All canonical removals go through one protected-aware removal primitive. MemoryFabric consumes bounded removal receipts and purges the affected MultiTimescale, SemanticMemoryGraph, P62 and hot-ID projections. Restore selects records by protection class and retention utility rather than taking a raw prefix. Snapshot APIs return defensive copies.

**Tech Stack:** TypeScript (Node 24 strip-types), MemoryOS2, MemoryFabric, existing Node regression harnesses, GitHub Actions.

## Global Constraints
- Base commit: 000be87d663dff925598f4b3b5785fee16bf50b1 on workpass70-source.
- Work only on aspect/memoryos2-capacity-lifecycle-integrity-20261123.
- Do not modify main, the published Release, the original Qwen checkpoint, or unrelated aspect branches.
- MemoryOS2 remains the sole canonical memory owner. No parallel archive/store is introduced in this change.
- Preserve identity, autobiographical and quarantined records during automatic capacity maintenance.
- If protected records alone exceed the configured item limit, retain them and report unresolved capacity; never silently slice them away.
- Maintain exact estimatedBytes, clean all per-ID indexes/caches and all inbound/outbound memory relationships.
- Keep semantic embeddings a bounded derived cache, not a second canonical memory store.
- Any test fixture with over-capacity state must be synthetic and deterministic.
- No Release is produced or advertised as containing this work. PR remains Draft until exact-head checks pass.

## Task 1 — Regression tests first (RED)
**Files**
- Create runtime/neuro-kurisu/tests/memoryos2-capacity-lifecycle-integrity.mjs.
- Create runtime/neuro-kurisu/tests/memory-encode-overflow-projection-reconcile.mjs.
- Update .github/workflows/nk1-memory-projection-retrieval-integrity.yml to trigger for MemoryOS2 and both new tests.
- Add named npm scripts in runtime/neuro-kurisu/package.json.

**Contracts tested**
- Encode overflow preserves protected rows and evicts the weakest eligible record.
- The common deletion path removes every relation target, repairs indexes/caches and keeps byte accounting exact.
- Restore examines the complete bounded snapshot, preserves protected tail rows, prioritizes retention, and prunes references to dropped rows.
- All-protected over-capacity restore remains lossless and yields an explicit capacity diagnostic; maintenance never silently slices the tail.
- snapshot({clone:false}) no longer leaks mutable canonical state.
- An encode-triggered eviction is reconciled across MemoryFabric, MultiTimescaleMemory, SemanticMemoryGraph, P62 history/lastFrame and hot IDs.

**RED commands**
- cd runtime/neuro-kurisu && node --experimental-strip-types tests/memoryos2-capacity-lifecycle-integrity.mjs
- cd runtime/neuro-kurisu && node --experimental-strip-types tests/memory-encode-overflow-projection-reconcile.mjs

Record expected pre-fix failures from the current implementation. Import/setup errors do not count as RED.

## Task 2 — One canonical removal primitive (GREEN)
**File:** runtime/neuro-kurisu/src/organism/developmental/MemoryOS2.ts

- Add a bounded in-process removal receipt queue for MemoryFabric reconciliation.
- Add one internal removal method that checks protected-kind/status policy; subtracts exact estimated bytes; removes spatial, token, metadata, bitemporal, concept, revision and dedup postings; clears lower-content and semantic embedding/retry caches; removes canonical row and item-index pointer; prunes incoming semantic, temporal, causal, contradiction and revision references; invalidates link-support cache; and records removed ID/reason in the bounded receipt queue.
- Route forgetById, byte-budget eviction, item-capacity eviction and maintenance through the same primitive.
- Preserve explicit-forget behavior for protected records (return false; never delete them).

**Acceptance**
- The same ID is absent from canonical storage, item index, retrieval indexes, cache state and relationship fields after removal.
- memoryAccountingDiagnostics().exact is true.
- indexDiagnostics().pass is true.

## Task 3 — Safe encode and maintenance capacity policy
**File:** MemoryOS2.ts

- Replace unconditional pop with deterministic lowest-retention eligible victim selection.
- Never select protected rows. Prefer lower utility, then older access/creation time, then stable ID tie-break.
- Preflight the full number of removals before mutating; if insufficient eligible rows exist, reject the new encode explicitly rather than partially mutate or silently evict protected memory.
- Remove the unconditional items.slice(0,1600) from maintain().
- Return/report unresolved over-capacity when protected rows alone exceed the cap.
- Keep the present 1,600 hot canonical cap for this patch; the separate 10,000 searchable-record target requires measured cold/durable residency and retrieval design.

## Task 4 — Restore and snapshot integrity
**File:** MemoryOS2.ts

- Normalize the complete allowed restore input before capacity selection (with a documented hard scan ceiling and fail-closed behavior beyond it).
- Retain all protected rows first; fill remaining slots by retention score while preserving source order among selected rows.
- When protected rows exceed the cap, retain all protected rows and expose the overrun explicitly.
- Prune all four relationship-link arrays against the retained canonical ID set; keep revision reconciliation fail-closed.
- Clear all derived semantic embedding and retry maps before rebuilding restored state.
- Make every public snapshot a defensive copy; the legacy clone:false option remains accepted for compatibility but no longer returns mutable canonical state.

## Task 5 — Reconcile projections on every deletion path
**File:** runtime/neuro-kurisu/src/organism/memory/MemoryFabric.ts

- Add a helper to consume MemoryOS2 removal receipts and call the existing canonical projection purge path.
- Call it after lifecycle encode and after maintenance/byte-budget changes.
- Keep reconciliation idempotent, retaining before/after canonical-ID comparison as a defensive fallback.
- Preserve explicit-forget behavior and avoid deleting projections for a protected record that remains canonical.

## Task 6 — Verification and documentation
**Files**
- Both new regression tests.
- Existing .github/workflows/nk1-memory-projection-retrieval-integrity.yml.
- Add runtime/neuro-kurisu/docs/MEMORYOS2_CAPACITY_LIFECYCLE_2026-11-23.md with source baseline, before/after behavior, residual 10k plan and run evidence.

**Commands**
- Both focused new tests.
- Existing memory-maintenance-projection-reconcile.mjs.
- Existing explicit-forget projection integrity test.
- Existing MemoryOS2 retrieval/vector/metadata/restore tests.
- npm run typecheck.
- Inspect exact-head workflow run on the PR.

**Before/after evidence**
- Before: oldest-row pop may drop protected memory, estimated byte drift remains, reverse references may remain, maintain() may truncate protected tails, restore prefix-truncates before priority, mutable snapshot leaks state, encode overflow does not purge projections.
- After: protected-aware removal, exact accounting, no dangling relation IDs, defensive snapshot, explicit capacity overrun, and encode-triggered projection reconciliation.
- Report item cap and any remaining 10,000-record limitation honestly; do not call this a 10k-capacity implementation.

## Task 7 — Integration boundary
- Create a Draft PR against workpass70-source.
- Do not merge automatically. Preserve the branch and test evidence for reviewer integration.
- Do not create or update a published Release.


---

## Execution status — 23 November 2026

- [x] Task 1 RED regressions added. Run 45124160080 reproduced protected identity eviction at the expected assertion.
- [x] Task 2 unified protected-aware canonical removal added.
- [x] Task 3 encode preflight and maintenance safe-cap policy added.
- [x] Task 4 full bounded restore selection, external-link-aware pruning, protected overrun diagnostics and defensive snapshots added.
- [x] Task 5 MemoryFabric removal-receipt reconciliation and bounded read APIs added.
- [x] Task 6 focused workflow passed on code commit 79395d0aa4e1201d429b08779998c90c3c29ac2a; all 13 checks passed including runtime TypeScript check.
- [ ] Task 7 integration remains pending: PR #1121 is Draft and not merged. No Release was created.
- The new default hot cap remains 1,600. A 10,000-record durable/cold-memory architecture is explicitly deferred to a separate measured aspect.
- Detailed before/after evidence and next waves: runtime/neuro-kurisu/docs/MEMORYOS2_CAPACITY_LIFECYCLE_2026-11-23.md.


## Final base refresh and exact-head verification

- [x] Merged the one new, non-overlapping workpass70-source commit d07bec7a75fd986f7a73ef77a6b8afdd1600df04 into the aspect branch.
- [x] Verified branch is 6 commits ahead and 0 behind current workpass70-source.
- [x] Exact merge-head run 45125682489 (commit 451e5d69b508100bb94e74311bc87c958f42efd4) passed all 13 memory workflow checks and runtime TypeScript check.
- PR #1121 remains Draft and unmerged.
