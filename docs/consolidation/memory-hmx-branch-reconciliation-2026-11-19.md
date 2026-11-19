# NK1 MemoryOS2 / HMX branch-family reconciliation — 2026-11-19

## Scope and evidence

- Repository: `ailtron1ss-rgb/NK1`
- Current source observed during this review: `workpass70-source` @ `0a3e4c4e51d7c2ec154a87cc0912e4a1cd6752e0`
- Candidate: PR #953, branch `aspect/memory-hmx-semantic-integrity-20261119`
- Exact inspected candidate HEAD: `fbab11da4e07a09282b8cb043904a05a4f638663`
- PR #953 remains Draft and open.
- Exact-head Actions query: **50 runs, 50 success, 0 failures, 0 pending**.
- Candidate base recorded on PR: `9742b5a82966e11ba9c913074615b2420736bcee`; current source is one commit ahead after the #950 asset merge. Compare previously showed 21 commits ahead / 1 behind; synchronize before any merge.

This is a focused file-level review of PR #953, not a completion claim for all memory branches.

## Unique functional contribution worth preserving

### 1. Canonical MemoryOS2 projections and restore reconciliation

`MemoryFabric` now treats MemoryOS2 as the only durable owner and maintains read-only derivatives:
- bounded MultiTimescale compatibility projection;
- source-namespaced SemanticMemoryGraph projections;
- P62 recall-frame cache.

It adds:
- canonical graph sync on encode/revise/link operations;
- full graph reconciliation during `MemorySubsystemRuntime.restoreFromPersisted()`;
- stale canonical projection retention/purge against the active MemoryOS2 set;
- compatibility projection updates after content/status/context/link revisions;
- explicit forget cleanup for multi-timescale rows, semantic graph nodes/edges and P62 history.

This avoids promoting compatibility rows back into MemoryOS2 as weaker duplicate beliefs. `MemorySubstrateCoordinator.compatibilityInputs()` explicitly skips canonical projection rows and HMX-origin rows.

### 2. Forget / projection integrity

The earlier exact-head run failed at `memory-forget-projection-integrity-20261113.mjs:91` because canonical deletion left a MultiTimescale projection behind. The current candidate adds cleanup in `MemoryFabric.applyLifecycleCommand({action:'forget'})`.

On the inspected latest HEAD, the dedicated `NK1 Memory Projection Retrieval Integrity` run completed successfully; its steps include multi-timescale/semantic graph regression, explicit forget/source isolation, vector integrity, retrieval accounting, metadata retrieval, roundtrip restore, bilingual bridge, restore/identity, candidate coverage and typecheck.

### 3. Bitemporal relationship ownership

`MemoryOS2.addLinks()` is a unique canonical owner operation:
- accepts only known target IDs and bounded relationship arrays;
- updates semantic/temporal/causal/contradiction links;
- records a transaction-time revision through `beginBitemporalRevision()`;
- invalidates relationship support cache;
- updates byte accounting and revision audit.

This is the correct architectural direction for HMX imports: relationship edges must go through MemoryOS2, not directly mutate a second semantic graph authority.

### 4. HMX cluster import

`HexisHmxCanonicalMemoryBridge` moves `clusters` out of deferred-only sections and supports bounded cluster records with explicit member refs. It maps cluster membership into bidirectional semantic links, imports typed relationships through canonical MemoryFabric/MemoryOS2 link writes, validates missing/out-of-scope member references and keeps external imports low-confidence/hypothesis with source provenance. Retry IDs are deterministic and a partial commit is declared retryable.

The new integration test covers:
- two canonical memories and an episode;
- a cluster referencing the memory records;
- relationship direction mapping;
- canonical semantic/temporal/causal links;
- idempotent replay;
- refusal to retain unknown target IDs.

This HMX cluster and typed-link support is a genuine unique addition, not merely a duplicate branch.

### 5. Semantic retrieval abstention and diagnostic benchmark

`MemoryOS2.previewRetrieveWithEmbeddings()` adds a bounded similarity floor (clamped to 0.60–0.95, default 0.72). When all vector candidates fall below the floor, it returns the grounded lexical fallback with explicit `abstained` diagnostics instead of enabling weak semantic matches.

The benchmark path is diagnostic-only:
- a deterministic local fixture verifies EN/RU answerable and unanswerable cases;
- a loopback embedding-provider CLI test validates the command contract;
- the report must not include raw query text;
- promotion is hard-disabled and live state must not change.

The fixture is synthetic and hand-labeled. Passing it does not establish real-world recall improvement, production holdout quality, or a positive `recallDelta`. Those require a separate independent dataset and measured paired evaluation.

## Concrete review blocker still to close

### P62 semantic-prefixed cache alias

`MemoryFabric.recall()` maps SemanticMemoryGraph hits to `semanticNodes` with the graph node ID. `P62MemoryFabric.recall()` stores those as hit IDs `semantic:<graphNodeId>`. Canonical graph node IDs are stable hashes such as `memoryos2:<hash>`, not the original MemoryOS2 item ID.

The current `P62MemoryFabric.forgetMemory(memoryId)` removes a frame only when one of its hits has `hit.id === memoryId`. Therefore a frame that contains only a semantic-graph alias (possible when the row is outside the first 64 direct P62 MemoryOS2 inputs and has no MultiTimescale copy) can retain the forgotten text after its graph node has been removed.

The test currently asserts the common direct-ID path but does not construct this semantic-only case. Add a production-seam regression that:
1. Inserts more than 64 direct canonical rows, then encodes a target through MemoryFabric without a compatibility projection.
2. Recalls a query that selects the target's canonical semantic graph node while excluding it from the direct P62 MemoryOS2 slice.
3. Confirms P62 stores the `semantic:<nodeId>` hit.
4. Forgets the canonical row and confirms no P62 history/lastFrame contains the alias or its content.

A second outcome-accounting detail: the orphan-only `applied` calculation includes MultiTimescale removal and P62 frame removal, but not the boolean result of `SemanticMemoryGraph.removeCanonicalProjection()`. If the only remaining derived copy is a graph node, the graph is cleaned while the lifecycle result can still be reported as `noop/false`. Include graph removal in the applied calculation and test it.

The finding was added as a review comment to PR #953 (issue comment ID 7000438530). Keep the PR Draft until the regression is covered and exact-head Actions passes.

## CI workflow consolidation recommendation

Current source already has `.github/workflows/nk1-memory-integrity.yml`, which triggers on the same runtime memory areas and runs typecheck, restore integrity, state roundtrip, semantic vector, retrieval accounting, metadata, bilingual retrieval, candidate coverage and benchmark gates.

The new `nk1-memory-projection-retrieval-integrity.yml` repeats most of these commands plus the new projection/forget tests. The new `nk1-semantic-retrieval-evaluation.yml` repeats typecheck while adding new benchmark and CLI tests. Prefer one canonical memory-integrity workflow:
- add the two new focused projection/forget test steps;
- add the semantic benchmark/CLI test steps;
- retain the existing broad restore/holdout gates;
- avoid maintaining duplicate workflow jobs unless a separate cadence/ownership is documented.

The existing `nk1-hexis-hmx-canonical-memory-bridge.yml` remains the appropriate owner for HMX bridge and adaptation tests. PR #953's HMX-specific run also completed successfully on the inspected exact head.

## File disposition

| Path / area | Decision |
|---|---|
| `MemoryFabric.ts` | Preserve candidate lifecycle/graph reconciliation and forget cleanup, after P62 alias fix |
| `MemoryOS2.ts` | Preserve bitemporal `addLinks` and similarity abstention, after contract review |
| `MemorySubstrateCoordinator.ts` | Preserve canonical projection exclusion and valid-time filtering |
| `MultiTimescaleMemory.ts` | Preserve bounded token/vector/cache hardening and canonical purge |
| `SemanticMemoryGraph.ts` | Preserve source namespace, validated restore, canonical projection/reconciliation |
| `P62MemoryFabric.ts` | Preserve forget-history support; extend canonical alias mapping before integration |
| `HexisHmxCanonicalMemoryBridge.ts` | Preserve explicit cluster and typed relationship import after final tests |
| New benchmark and CLI | Preserve as diagnostic-only; no automatic promotion or production efficacy claims |
| Two new memory workflows | Consolidate into existing memory-integrity workflow if trigger/coverage review confirms no unique cadence |
| New tests | Preserve; add semantic-prefixed P62 forget and graph-only orphan-result regression |

## Current decision

- PR #953 is **not merged**.
- Exact-head CI is 50/50 success, but that does not replace the missing semantic-alias regression review.
- No source code was changed in this audit branch.
- No branch or PR was deleted/closed by this review.
- The October 19 archive is still not materialized; no byte-level archive parity is claimed.
