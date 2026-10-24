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

## Explicit limits — not claimed complete

Only HMX `sections.memories` is projected as memory records in this pass. Relationships are projected only when both endpoints resolve to imported memory records. Structural `identity`, `goals`, goal/identity-linked relationships, `narrative`, `config`, `audit_records`, and `in_flight_work` remain deferred, and an HMX identity section cannot overwrite NK1's canonical identity model through this memory path. Further work needs separate projections with consent, conflict handling, fidelity checks and rollback for those owners.

Embeddings are not transferred; the current adapter warns that re-embedding is required. No measured learning uplift or production-readiness claim is made.

## Validation

GitHub Actions run [40127691364](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40127691364) at commit `c97e512b84cd25784bf6257db7bdf46051437053` completed all five Hexis workflow steps successfully, including the server smoke and the tests for:
- approval/application separation and canonical MemoryFabric/MemoryOS2 writes;
- partial semantic relationship projection, deduplication and graph rollback;
- isolation of an existing same-text native memory from external HMX provenance.

The latest addition tests deduplication across two exports with different HMX `export_id` values but the same lineage/record identity. Exact-head CI for that cross-export case is still queued, so it is not yet reported as passed.

The parallel WorkPass110 metrics workflow continues to fail on the separate `tests/big-pass-90-causal-learning-stream.mjs:18` assertion (`record` is null). That failure has not been attributed to Hexis.

## Pull request status

Changes are on `operation-omega-hexis-deep-pass-2026-10-24` and tracked in [PR #95](https://github.com/ailtron1ss-rgb/NK1/pull/95). The PR is open and is not merged into its base branch.
