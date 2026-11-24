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


## Current source-head confirmation — 23 November 2026

The base branch subsequently advanced to workpass70-source HEAD 06e2deb640807acf20ebb950524d0442ad75356f. This is a merge commit with parents d07bec7a75fd986f7a73ef77a6b8afdd1600df04 and 54b9b0dcc62425c9d860c08fe78b91e557d4c800. The aspect branch contains both ancestry lines; comparison from 06e2deb to the aspect branch head reports ahead_by=7 and behind_by=0. No additional rebase is currently needed.

The final memory workflow remains run 45125682489 on integration head 451e5d69b508100bb94e74311bc87c958f42efd4, with conclusion SUCCESS and all 13 checks passing. The current branch tip after documentation-only commits is later than that tested code head; no runtime source changed after the verified integration head.


## Full current-base merge and verification — 23 November 2026

The complete current workpass70-source HEAD 06e2deb640807acf20ebb950524d0442ad75356f was merged into the aspect branch. Its second-parent line contained twelve additional agency/autonomy commits; the package.json overlap was resolved by preserving the current base manifest and adding both MemoryOS2 regression scripts. The other feature files did not overlap with that line.

Final integrated head: fd5010a51496fb994e5fa8a588a89c4ec7cf50e2.

Exact-head GitHub Actions run 45126160004 completed SUCCESS on this commit. All 13 checks passed:
- Multi-timescale and semantic graph regression
- Explicit forget and source-isolated projection integrity
- Automatic eviction projection reconciliation
- MemoryOS2 capacity lifecycle integrity
- Encode overflow projection reconciliation
- MemoryOS2 semantic vector integrity
- MemoryFabric retrieval accounting
- MemoryOS2 metadata retrieval
- Memory subsystem state roundtrip
- Bilingual retrieval bridge
- Restore integrity and duplicate identity
- Candidate coverage regression
- Runtime TypeScript check

The current comparison workpass70-source (06e2deb6) → aspect branch (fd5010a5) is ahead_by=9 and behind_by=0. The eight-file diff is limited to the planned MemoryOS2, MemoryFabric, tests, scripts, workflow and documentation paths.


## Capacity profile expansion and runtime persistence verification — 24 November 2026

**Repository:** `ailtron1ss-rgb/NK1`  
**PR:** #1168 — Draft, open, unmerged  
**Verified code head:** `61d2f67482c1a2ff8b7ac344940cf0cce8b49068`  
**Base / current `workpass70-source`:** `87c9ed9034e09ca9fb83fd676ac52bb46434c4fe`  
**Exact-head CI:** 51/51 workflow runs SUCCESS; 0 failures; 0 active at the verification checkpoint.

### Capacity profile and ownership

MemoryOS2 remains the sole canonical writable owner. The host configuration is now propagated through `MemorySubsystemRuntime`, P70/P75 lifecycle planning, `OrganismCore`, `CanonicalMemoryLifecycleAuthority`, and `MemoryFabric`.

| Profile | Canonical item cap | Canonical byte budget | Status |
|---|---:|---:|---|
| Default / mobile-safe | 1,600 | 1 MiB | Existing default preserved |
| Explicit extended | 10,000 | 7.2 MB derived | Opt-in, verified in CI |
| Explicit byte override | Up to 10,000 | 256 KiB–8 MiB | Bounded operator override |

Host variables:
- `NEURO_MEMORY_ITEM_CAP`: default 1,600; validated range 128–10,000.
- `NEURO_MEMORY_BYTE_BUDGET`: default 1 MiB for the default profile; 7.2 MB derived for an explicit 10k profile; validated range 256 KiB–8 MiB.

Invalid or absent item-cap values preserve the 1,600-row default. The extended profile is not enabled implicitly on phones.

### Lifecycle pressure limits

The ordinary count cap and the pressure-retention cap are separate. The old default-profile pressure limits remain unchanged: 720 rows at critical pressure and 960 rows at elevated pressure. These limits now scale by the same 45% / 60% ratios for expanded profiles, rather than silently reapplying absolute 720/960 limits to a 10k store. At lower pressure, maintenance uses the planned P70/P75 budget, bounded by the configured capacity.

### Exact WorkPass75–76 evidence

The exact-head capacity workflow on this code head passed:
- Default 1,600-row restore remains unchanged; the 10k source fixture reports 8,400 rows truncated under the default profile.
- Explicit 10k restore accepts all 10,000 rows with no truncation.
- 64 warmed direct-retrieval samples at 10k: p50 **11.31 ms**, p95 **14.60 ms** on the CI runner.
- Canonical MemoryFabric maintenance: 10,000 rows retained; 7.2 MB byte budget; zero byte evictions; indexes and byte accounting exact.
- Actual P70 → CanonicalMemoryLifecycleAuthority → MemoryFabric cycle: target **8,840**, after-maintenance **8,840**; zero byte evictions; indexes and byte accounting exact.
- Protected-overflow case: 130 protected identity/quarantined rows remain under a 128-row cap; an ordinary write fails closed without displacing them.
- Pressure-cap assertions preserve the 720/960 default limits and verify the scaled 4,500/6,000 limits at 10k.

### Snapshot / restore round-trip

A complete `MemorySubsystemRuntime.snapshot()` was serialized with the V8-backed `MemoryStateStore`, loaded into a fresh `MemorySubsystemRuntime`, and restored through `restoreFromPersisted()`.

Verified after restoration:
- The canonical count remains **8,840**.
- The complete ordered canonical ID set is identical.
- Canonical estimated-byte accounting remains exact.
- MemoryOS2 indexes are valid.
- The first post-restore maintenance cycle retains all 8,840 rows with zero byte-budget evictions.

The serialized full-runtime payload measured **13,241,575 bytes**. This is the entire `MemorySubsystemRuntime` snapshot, not the MemoryOS2 canonical byte-budget alone. The test uses the in-memory V8-backed `MemoryStateStore`; it is a real serialization/restore round-trip into a fresh runtime instance, but **not** proof of filesystem durability, Android process-death recovery, or an on-device soak.

### Memory-to-action evidence — WorkPass77

The paired Core test used five different novelty/salience scenarios. Within each pair, the initial snapshot, query, observation, and evidence timestamp were matched; only the content of four retrieved episodic memories changed between the respond-cued and explore-cued arms.

- 5/5 scenarios showed the expected movement in the `respond - explore` candidate-score margin.
- Mean paired margin shift: **+0.242222**.
- Both arms retrieved four experiment memories in every pair.
- The final selected action remained `respond` in both arms. This proves that retrieved memory shifts candidate scores under these matched conditions; it does **not** yet prove that memory alone flips the final selected action under stronger policy constraints.

The WorkPass75 metadata ablation remains a synthetic bilingual diagnostic (80 paired queries over five seeds), not an independent licensed-data holdout or production uplift estimate. Metadata recall remains opt-in.

### Remaining limits and release boundary

- The 1,600-row / 1 MiB default profile is unchanged.
- The 10k profile is opt-in and has only been benchmarked on CI runners so far; no Android/phone soak is claimed.
- The round-trip test is not a file-backed or power-loss durability test.
- This adds a bounded 10k canonical searchable profile and cold residency inside MemoryOS2; it does not add a separate durable cold-archive service.
- PR #1168 remains Draft and unmerged. `workpass70-source`, `main`, and published Release ZIP artifacts were not changed.

### Next verification wave

1. Run the explicit 10k profile on a physical Android target: restore, recall, maintenance, sustained tick loop, memory pressure, thermal/battery and app restart.
2. Add file-backed `FileStateStore` save/reload and interrupted-write/corruption tests for the same 10k snapshot.
3. Extend the paired memory-to-action experiment to an internal-context/no-conversation condition and measure whether any scenario changes the final selected action, not just the candidate-score margin.
4. Record heap/RSS and peak save/restore allocation alongside the 13.24 MB full-runtime serialized payload.
