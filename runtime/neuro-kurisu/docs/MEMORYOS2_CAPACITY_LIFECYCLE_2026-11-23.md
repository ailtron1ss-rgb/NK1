# MemoryOS2 capacity and lifecycle integrity — implementation report

**Date:** 23 November 2026  
**Repository:** ailtron1ss-rgb/NK1  
**Base:** workpass70-source at 000be87d663dff925598f4b3b5785fee16bf50b1  
**Verified code commit:** 79395d0aa4e1201d429b08779998c90c3c29ac2a  
**PR:** #1121 — Draft, not merged  
**CI:** NK1 Memory Projection Retrieval Integrity, run 45125316900 — SUCCESS

## Summary

The canonical MemoryOS2 store now has a unified protected-aware removal path. Automatic capacity management no longer removes the last array element blindly, restore no longer truncates the raw snapshot prefix before examining record protection and retention, and public snapshots never return a mutable reference to canonical state even when callers pass clone:false.

MemoryFabric consumes removal receipts and purges the affected derived views. The current hot canonical cap remains 1,600; this work does not claim 10,000-record durability or cold residency.

## Before / after

| Area | Before (RED baseline) | After (verified GREEN) |
|---|---|---|
| Encode overflow | Unconditional pop of the last row | Preflighted lowest-retention eligible victim selection; protected identity/autobiographical/quarantined rows are excluded |
| No evictable capacity | Could silently lose protected data | Fails explicitly with MemoryCapacityExhaustedError before inserting the new row |
| Removal lifecycle | Forget and capacity deletion had different cleanup paths | One canonical removal primitive for forget, byte-budget, capacity and pressure removal |
| Byte accounting | Popped capacity row did not subtract its bytes; relationship pruning also changed row sizes | Recompute exact canonical byte total after removal and link cleanup |
| Reverse relationships | Capacity pop left inbound relationship IDs untouched | Semantic/temporal/causal/contradiction links and revision pointers to the removed row are cleaned |
| Derived caches | Capacity pop did not clear lower-content and semantic embedding caches | Common removal clears lower-content, semantic embedding and retry state plus retrieval indexes |
| Restore | Raw snapshot prefix was truncated to 1,600 before validating priority/protection | Up to 100,000 rows are normalized first; protected rows are retained first, then highest-retention eligible rows |
| Protected-only over-capacity | Tail slice could silently discard protected rows | All protected rows are preserved and over-capacity is explicitly diagnosed |
| Restore relationships | No capacity-aware pruning of links to records dropped from the restored snapshot | Prunes links only to rows present in the input snapshot but excluded by capacity; intentionally preserves external graph/substrate IDs |
| Public snapshot | snapshot({clone:false}) returned the live mutable internal state | Snapshot always returns a defensive copy; the old option remains accepted for compatibility |
| MemoryFabric projection | Size-neutral encode overflow could leave a stale projection because no before/after count delta was visible | Bounded removal receipts trigger cleanup of MultiTimescale, SemanticGraph, P62 and hot-ID projections |
| Read-path cost | Internal read-only callers depended on clone:false to avoid copying the full store | Added narrow defensive APIs for one item, a prefix, ID-only snapshots and bounded semantic/compatibility projections |

### Direct RED evidence

The test-only commit b0d61dedd7e32a72ec99371e77a1fb04cf27e947 was run before the production fix in Actions run 45124160080.

- Three existing tests passed: MultiTimescale/SemanticGraph integrity, explicit-forget projection integrity, and maintenance projection reconciliation.
- The new capacity test failed at the expected assertion: identity memory must never be evicted by capacity pressure.
- The failure occurred after the 1,600-row fill and encode overflow, proving the old pop path removed the protected row. It was not a setup/import failure.

### GREEN evidence

On code commit 79395d0aa4e1201d429b08779998c90c3c29ac2a, Actions run 45125316900 completed with conclusion SUCCESS.

All 13 workflow checks passed:

1. Multi-timescale and semantic graph regression.
2. Explicit forget and source-isolated projection integrity.
3. Automatic eviction projection reconciliation.
4. MemoryOS2 capacity lifecycle integrity (new).
5. Encode overflow projection reconciliation (new).
6. MemoryOS2 semantic vector integrity.
7. MemoryFabric retrieval accounting.
8. MemoryOS2 metadata retrieval.
9. Memory subsystem state roundtrip.
10. Bilingual retrieval bridge.
11. Restore integrity and duplicate identity, including restore shape-hardening.
12. Candidate coverage regression.
13. Runtime TypeScript check.

The first GREEN run exposed one compatibility issue: restore had incorrectly removed a link ID that represented an external substrate reference rather than a row dropped from the incoming snapshot. The implementation was narrowed to prune only IDs that were in the source snapshot and lost capacity selection. The final GREEN run confirms that external-link behavior is preserved.

## Implementation details

### MemoryOS2
- Added a single internal protected-aware canonical removal path.
- Removal order preserves access to the canonical row while its secondary indexes are being deleted.
- Recomputes estimatedBytes from the remaining canonical set after relationship cleanup.
- Emits a bounded 512-entry removal receipt queue.
- Capacity victim score uses salience, confidence, goal relevance, identity relevance and retrieval count; ties prefer older last access/creation and stable ID order.
- Encode preflights all required victims before mutating canonical state.
- Maintenance no longer applies an unsafe final items.slice(0, 1600).
- Restore scans at most 100,000 rows and fails closed above that bound.
- The 1,600 limit remains the normal cap. If protected rows alone exceed it, they remain and a capacity diagnostic reports the overrun.
- Public snapshot always clones.
- Added narrow defensive read APIs to avoid cloning the entire state for common MemoryFabric operations.

### MemoryFabric
- Encode consumes MemoryOS2 removal receipts and cleans every corresponding derived projection.
- The "created" accounting handles size-neutral overflow correctly.
- Maintenance uses removal receipts as the primary path and retains before/after ID reconciliation as a defensive fallback.
- Internal lookups use bounded/item-specific snapshot APIs rather than whole-store defensive snapshots.

## Current limits and risks

- This remains a 1,600-row hot canonical store. It is not the 10,000 searchable-record/cold-residency upgrade.
- If every row is protected and capacity is exhausted, new encode is rejected. That is an intentional safe failure, not successful admission.
- Restore rejects inputs above 100,000 rows. That ceiling is a defensive scan bound, not a capacity target.
- Snapshot defensiveness is correctness-tested. No dedicated latency/heap benchmark has yet been run on an actual mobile device.
- Existing semantic/causal graph IDs may intentionally reference another substrate. Restore preserves such external IDs; it only removes references to rows that were present in the same incoming snapshot but were dropped during selection.
- The PR remains Draft and unmerged. No main-branch update or Release artifact was created.

## Next plan

### Wave A — verified persistence
1. Add explicit serialization/checksum schema for MemoryOS2 canonical state and bounded removal-receipt journal.
2. Add atomic save/restore and interrupted-write/corruption matrix.
3. Verify protected IDs, revision chains, evidence lineage and external links across process restart.
4. Measure snapshot latency/heap at 100, 1,000 and 1,600 rows.

### Wave B — 10k searchable memory (separate aspect)
1. Design hot/warm/cold residency with a durable cold archive.
2. Compare exact lexical/hybrid/semantic retrieval at 10k rows on the same sealed workload.
3. Track recall@k, MRR, stale/false recall, conflict recall, p50/p95, memory bytes and rebuild time.
4. Enforce promotion/eviction and explicit forget across canonical storage and all projections.
5. Raise capacity only after restore, deletion, retrieval and mobile resource gates pass.

### Wave C — organism integration
1. Keep MemoryOS2 as the single canonical owner.
2. Connect existing OrganismBus, verifier and runtime maintenance contracts to receipts and capacity diagnostics.
3. Exercise encode→retrieve→forget→restore cycles under concurrent/adversarial pressure.
4. Only then integrate additional learned memory/world-model components from the Neural Evolution lab as advisors.

## Release boundary

This code is present only on the aspect branch and Draft PR #1121. It has not been merged to workpass70-source, main, or a published Release ZIP.


## Final integration refresh — 23 November 2026

After the initial code verification, workpass70-source advanced by one unrelated commit:
- New base HEAD: d07bec7a75fd986f7a73ef77a6b8afdd1600df04.
- Change: structural runtime port for Aspect Fabric in OrganismRuntime.ts; no overlap with MemoryOS2, MemoryFabric, package scripts, workflow or regression tests.

The latest base commit was merged into this aspect branch without rewriting the five-work commit history. The final integration head at the time of verification was 451e5d69b508100bb94e74311bc87c958f42efd4. Compare against current workpass70-source showed:
- ahead_by = 6 (five feature/documentation commits plus the merge commit);
- behind_by = 0;
- the diff still consists only of the intended eight files.

A fresh exact-head workflow run 45125682489 completed SUCCESS on merge head 451e5d69. All 13 checks passed again, including both new regression tests, all existing memory regressions, candidate coverage and runtime TypeScript check.

The PR remains Draft and unmerged. No release artifact or main branch was modified.
