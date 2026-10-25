# NK1 / Hexis deep integration pass — 2026-10-24

## Source of truth

NK1 remains the runtime and canonical memory owner. The upstream reference is [QuixiAI/Hexis](https://github.com/QuixiAI/Hexis); the interoperability envelope is [HMX 1.7](https://github.com/QuixiAI/Hexis/blob/main/schemas/hmx-1.7.schema.json). Hexis Python/PostgreSQL files remain a reference archive under `legacy/input-archives/`; its migrations are not run against NK1.

## WorkPass330 — format bridge and import boundary

- Added `Nk1HmxExportAdapter.mjs` and wired it to the server's HMX export endpoint so NK1-native identity, memories, skills, goals, relationships and episodes are converted into an HMX 1.7 envelope rather than passing through an incompatible native object.
- The adapter emits the required export ID, intent, timestamp, lineage, capabilities, privacy, scope and statistics fields. NK1 native skills become procedural-memory records. Unsupported or malformed native extensions are preserved in metadata/config rather than silently discarded.
- The export explicitly sets `privacy.redaction_policy: none` and warns that no automatic redaction was performed. It also records that source vectors were not exported and must be re-embedded before vector retrieval.
- Hardened HMX staging: validates the envelope and source lineage, limits payload/section/aggregate sizes, rejects unknown sections, and checks the required memory reference/type/content fields before approval.
- Hardened the HTTP decision endpoint: `accept` records approval only, `apply` is a separate operation, invalid requests return 400, missing stages return 404, and conflicted stages cannot be accepted.

## WorkPass331 — projection into canonical memory

- Added `HexisCanonicalMemoryProjector.mjs` and bound it in `OrganismSystemFabric` to the existing `MemorySubsystemRuntime.fabric`.
- Writes go through `MemoryFabric.encode()` into `MemoryOS2`; persisted JSON is never directly edited and a second memory store is not created.
- An explicit `apply` decision is required after approval. Each receipt records the attempt, source lineage, imported/deduplicated memory IDs and any deferred sections. An applied stage replays its original receipt without repeating the write.
- Imported records retain HMX source/ref/lineage provenance, map external trust to bounded confidence, and are not promoted to facts merely because they were imported.

## WorkPass332 — semantic relationships and source isolation

- The canonical projector now receives NK1's existing `SemanticMemoryGraph`. It creates/reuses graph nodes for imported memory records and projects only relationships whose **both endpoints** are in the imported memory set. Relationships pointing to deferred goals, identity or other non-memory records remain explicitly deferred.
- Application receipts expose `projectedRelationships`, `deferredRelationships`, and semantic edge IDs. Existing graph nodes/edges are reused on re-import instead of being reinforced again.
- Each canonical import gets a stable ID and source key derived from source lineage, the export-independent HMX record-reference suffix, and content hash. This deduplicates re-exports whose `export_id` changed while their lineage and underlying records stayed the same.
- Extended the canonical `MemoryFabric` mutation command with an explicit `forceDistinct` option. The importer now uses a stable distinct ID, so a same-text native NK1 record is not reconsolidated with incoming Hexis metadata/provenance.
- If a multi-record write fails, new memory rows are compensated through canonical `MemoryFabric.forgetById()` calls and the semantic graph is restored to its pre-apply snapshot. The HMX stage remains approved/retryable; the retry uses a new command attempt but the same stable imported record IDs.

## WorkPass333 — reviewed goals and canonical lifecycle

- Removed the obsolete `OrganismCore.hexisDecideHmx` path that inserted memories during `accept`. `accept` now only records the human review decision; only `apply` invokes the canonical projector, and then persists MemoryOS2, MemoryFabric, semantic graph, event log and Hexis receipts.
- Added a durable bounded `goalProposals` registry to `HexisAdaptationFabric`. Approved HMX stages can produce stable, deduplicated proposals, but preparing the queue does not create a canonical organism goal.
- Added explicit goal decisions: `pending → approved → materialized → active`. Approval creates a canonical NK1 goal only as `paused`, with `source: external` and `activationApproved: false`. A separate `activate` call is required and checks for capacity, title collisions, and identity continuity. A stale reject can no longer overwrite an already approved/materialized decision.
- Added server endpoints `POST .../hmx/goals/prepare`, `GET .../hmx/goals/proposals`, and `POST .../hmx/goals/decide`. The server smoke covers a rejected early activation, the paused state after approval, explicit activation, and durable proposal retrieval.
- Added an optional `sourceKey` namespace to `SemanticMemoryGraph` nodes. Imported HMX graph nodes now reuse only nodes in the same provenance namespace, avoiding accidental connection of a same-label native node to external-source relationships.
- P68 retention pruning now protects external goals explicitly marked `activationApproved: false`, so an approved-but-not-activated goal is not lost during routine goal cleanup.
- The bounded 256-entry HMX goal-proposal registry preflights the full batch capacity before its first mutation; when full, it fails closed rather than silently evicting pending or reviewed proposals.
- The canonical projector and HMX decision layer now both reject memory mutation unless the staged candidate is `intent=port`, `strategy=additive`; unsupported analysis/authoritative strategies remain reviewable but write nothing.
- Corrected P68's paused-goal traversal (the old loop iterated active goals only, making its paused-to-active transition unreachable). Native paused goals can again resume under the existing ecology conditions, but reactivation respects a four-active-goal cap. External goals without explicit activation remain paused and are protected from routine retention pruning, including older records that lack the new marker.
- Failed HMX apply attempts are persisted by `OrganismCore` even when the projector throws, so a restart increments the attempt ID before retry instead of reusing a command receipt from a compensated write.
- Extended tests for goal proposal deduplication across exports, immutable decisions, P68 not auto-reactivating externally imported paused goals, and same-label graph-node isolation. Exact-head run [40161146253](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40161146253) at `d2e01c4d76f85f6582cb6b3f0c1904addc90243d` passed all five Hexis workflow steps, including the goal proposal regression and live HTTP server smoke.

## Explicit limits — not claimed complete

Only HMX `sections.memories` is projected as memory records in this pass. Relationships are projected only when both endpoints resolve to imported memory records. Structural `identity`, goal/identity-linked relationships, `narrative`, `config`, `audit_records`, and `in_flight_work` remain deferred. HMX goals have a separate reviewed-proposal path and are not imported as active goals by memory apply; an HMX identity section cannot overwrite NK1's canonical identity model through this memory path. Further work needs separate projections with consent, conflict handling, fidelity checks and rollback for those owners.

Embeddings are not transferred; the current adapter warns that re-embedding is required. No measured learning uplift or production-readiness claim is made.

## Validation

GitHub Actions run [40127691364](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40127691364) at commit `c97e512b84cd25784bf6257db7bdf46051437053` completed all five Hexis workflow steps successfully, including the server smoke and the tests for:
- approval/application separation and canonical MemoryFabric/MemoryOS2 writes;
- partial semantic relationship projection, deduplication and graph rollback;
- isolation of an existing same-text native memory from external HMX provenance.

The WorkPass333 follow-up, including cross-export goal proposal deduplication and explicit external-goal activation, passed exact-head run [40161146253](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40161146253) at commit `d2e01c4d76f85f6582cb6b3f0c1904addc90243d`. WorkPass334 boundary typing and WorkPass334 batch-integrity regression subsequently passed all five steps at [40161669084](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40161669084), commit `d97e3a01169ee78dfc8d6eafc7f958adc0347a52`.

The parallel WorkPass110 metrics workflow continues to fail on the separate `tests/big-pass-90-causal-learning-stream.mjs:18` assertion (`record` is null). That failure has not been attributed to Hexis.

## Pull request status

Changes are on `operation-omega-hexis-deep-pass-2026-10-24` and tracked in [PR #95](https://github.com/ailtron1ss-rgb/NK1/pull/95). The PR is open and is not merged into its base branch.


## WorkPass334 — canonical goal provenance chain

- Canonical external goals now store the source HMX export ID, source lineage, source reference, reviewed proposal ID and import timestamp directly on `OrganismGoal`; this provenance survives restart and is included in subsequent organism exports.
- Activation validates that the canonical goal's provenance still matches the reviewed proposal. An ID collision or a goal that has been changed to another source fails closed instead of granting external intent to an unrelated native goal.
- A narrow recovery path only fills missing provenance for the exact same paused external goal and proposal after a partially completed materialization; it does not adopt native goals or overwrite mismatched source lineage.
- The live server smoke now asserts that provenance exists after review/materialization and remains consistent after explicit activation.


## WorkPass334 — strict typing at Hexis boundaries

- Narrowed untrusted HMX `source` and goal metadata to validated record objects before reading dynamic fields; this removes strict TypeScript errors without weakening runtime validation.
- Added a NodeNext `.d.mts` declaration for `HexisCanonicalMemoryProjector.mjs`, connecting it to the canonical MemoryFabric, semantic graph, HMX stage and receipt types.
- Added an explicit impossible-state guard before finalizing goal proposal materialization.
- Exact branch-head Hexis run [40161669084](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40161669084) at `d97e3a01169ee78dfc8d6eafc7f958adc0347a52` passed all five workflow steps, including the oversized-goal-batch regression and live server smoke. The HMX-specific source/metadata and `.mjs` declaration errors were absent from the typecheck log on that head. Remaining full-runtime type errors were outside the HMX adapter; WorkPass335 addresses those separately, and its typecheck is still pending.


- **WorkPass334 batch-integrity follow-up:** HMX goal review now rejects batches larger than 64 proposals as a whole instead of silently truncating the staged goal section. A regression asserts that proposal state and metrics remain unchanged on this failure.


## WorkPass335 — follow-up runtime typecheck repairs

- Fixed the Node spawn error event's callback type in Android/Termux TTS without changing its uncertain-playback fail-safe.
- Guarded nullable causal-experience results before generating unified-learning input, so a deduplicated/absent causal event is not dereferenced or treated as a new observation.
- Updated the trusted-shadow registration wrapper to await registrar persistence without leaking its synchronous result through a void-only callback contract.
- Added the opt-in P23 compound repair runtime-clock ID to both the type union and scheduler allowlist, and added scheduler regression coverage. This fixes a type error and a real path where enabling the loop would previously have thrown "Unknown runtime clock".
- Tightened optional numeric normalization in skill retrieval for strict TypeScript narrowing.
- Exact-head tests for this follow-up are pending at commit `b4ec50e2e1893d4d9dcfb32d169a4b6c5079765c`; no full-runtime typecheck pass is claimed yet.
