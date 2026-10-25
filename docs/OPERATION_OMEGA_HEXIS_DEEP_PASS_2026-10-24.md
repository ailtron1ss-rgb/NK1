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

## WorkPass333 — HMX goal proposals, stable identity, and explicit activation

- Added a durable HMX goal-proposal review queue. External goals remain proposals until reviewed; approval materializes a paused canonical goal, and activation requires a separate explicit decision plus capacity and identity-continuity checks.
- Kept imported goal provenance attached to the canonical goal and preserved relationship receipts for the goal's source stage; identity/policy sections remain protected.
- Fixed re-export deduplication to key HMX goals by the original NK1 goal ID preserved in adapter metadata rather than the export-scoped HMX ref.
- Added integration and HTTP smoke coverage for proposal preparation, approval, activation denial before review, explicit activation, provenance, and re-export idempotency.
- Validation note: the first exact-head HMX workflow exposed a real re-export dedupe regression (the goal's HMX ref changes on each export). The fix is committed; the next exact-head CI run is the validation gate. The unrelated WorkPass110 causal-stream failure and other older workflows remain separate.


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


## WorkPass335 — CI script wiring repair

- The `WorkPass292 verified experience lanes` workflow invoked `npm run test:workpass292:evidence-lanes`, but the package script map did not declare that command even though `tests/workpass292-evidence-lanes.mjs` existed. Added the missing script with Node's strip-types runner. The prior failure was a workflow/package wiring error, not a failing causal-experience assertion. Fresh exact-head workflow confirmation is pending.


- **WorkPass335 registrar follow-up:** The broad typecheck narrowed to one remaining incompatibility: `OrganismCore` returns the registry receipt synchronously, while the minimal coordinator contract allows only void or an awaited result. The Core entry point now wraps the trusted registrar as an async void capability. Durable registration is still awaited before child spawn; the registry result is not leaked through the coordinator callback.


- **WorkPass335 CI wiring follow-up:** The P23 autonomous-revision workflow also referenced a missing npm script (`test:workpass293:p23-revision`) despite the regression file being present. Added the script mapping to `tests/workpass293-autonomous-p23-revision.mjs`. The preceding workflow failed before invoking the test, so the new head must verify both script resolution and actual test behavior.


## WorkPass336 — explicit goal-linked semantic relationship projection

- Goal activation now inspects relationship rows from the exact staged HMX export/lineage and projects only edges that touch the reviewed goal's source reference.
- Edges to imported memories resolve only to existing source-namespaced Hexis graph nodes from canonical memory apply. Edges to another external goal resolve only when that second goal has its own materialized proposal, matching source provenance and explicit active/approved state; unresolved endpoints remain deferred.
- Goal graph nodes use a dedicated `hexis-goal:<proposalId>` source namespace so imported labels cannot merge into NK1's native goals. External relation weights are capped at `0.55`, and existing matching edges are reused rather than reinforced.
- Activation stores a durable receipt (`sourceStageFound`, candidate/projected/deferred counts, semantic edge IDs, timestamp), persists the semantic graph, and includes projection counts in the goal event. A graph mutation error restores the previous graph and leaves activation blocked.
- The live server smoke now imports a reviewed goal plus a weighted relationship to its imported memory and asserts that the edge is projected only after explicit activation. Fresh exact-head CI is pending.


- **WorkPass336 validation correction:** The first live-server check confirmed the core produced the goal relationship receipt but found the HTTP handler did not serialize it in the API response. The route now returns the receipt from the activation result/proposal. The same CI wave also found the new WorkPass293 test imports TypeScript parameter properties, which Node's strip-only loader cannot handle; its script now uses `--experimental-transform-types`. The graph-label helper's Unicode property-escape regex was corrected to match the canonical SemanticMemoryGraph normalizer. Fresh CI is pending.


## WorkPass337 — activation ordering and deferred-goal edge recovery

- A new external goal may only be activated while its original HMX stage is still available and marked `applied`; accepting/reviewing a document is not enough to promote its intent into active planning.
- When an explicitly activated goal has HMX edges to another not-yet-activated external goal, NK1 now preserves the first goal's source-isolated semantic node while recording the edge as deferred. The second goal's later activation can then resolve its endpoint and project the edge.
- The durable relationship receipt is idempotent: replayed activation evidence cannot replace its original counters/edge IDs or increment the activation metric again. Unit regression covers receipt replay; live server smoke covers explicit goal-to-memory projection. Fresh exact-head CI is pending.


## WorkPass338 — missing runtime test command wiring

- Corrected three more workflow/package mismatches identified by exact GitHub Actions logs: WorkPass291 reflective payload budget, WorkPass294 correlated external postconditions and P26 learning input integrity all pointed at test files that existed but had no corresponding npm scripts.
- Added the missing script entries using Node's transform-types loader, which supports the repository's TypeScript parameter-property syntax. The previous CI failures stopped at npm's `Missing script` error and did not establish whether the test assertions passed; that remains for the next exact-head run.


- **WorkPass338 follow-up:** The WorkPass287 restore-contract test expected only `action` to be missing after restoring an invalid timestamp, while the implementation correctly fails closed to the full six-stage missing list when the previous completion claim is invalid. Updated that assertion to match the conservative restore invariant rather than weaken production validation.


- **WorkPass338 P26 follow-up:** A comparison of the whole P26 workflow with `package.json` found two more missing commands that the workflow would reach only after its first regression: `test:p26:learning-recovery-benchmark` and `test:p26:learning-continual-matrix`. Both point to existing test files and have now been wired. The learning-validation workflow can now test the actual assertions instead of stopping at npm command resolution.
