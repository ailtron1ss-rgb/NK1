# NK1 rebuild checkpoint — live repository state (2026-10-20)

## Purpose
Resume work from the live GitHub state, not from a stale chat summary. This checkpoint records only facts confirmed during the 2026-10-20 repository inspection.

## Repository and branch separation
- Canonical repository: https://github.com/ailtron1ss-rgb/NK1
- Stable branch: `main`; do not modify it during island implementation.
- Rebuild branch: `rebuild`; the current NK1 v2.0 rebuild charter and staged implementation notes are here.
- Additional existing branches: `workpass70-source`, `workpass73-audit-fixes`, `workpass79-cognitive-rebuild`, `workpass94-avatar-voice-live2d-audit`.
- Open draft PR #1: `workpass79-cognitive-rebuild` → `workpass70-source`; it is open, draft, unmerged, and mergeable. It is a separate WorkPass line and must not be assumed identical to `rebuild`.
- Latest `main` commit observed: `69f8186c8bc2cfcadc7c88fc89406358eedbe8c1` (“Point NeuroCore README to validated WorkPass70 hotfix release”).
- The `main` README identifies WorkPass70 Hotfix 1 as the last validated source archive and explicitly says it is not production-approved.

## Rebuild branch: confirmed recent implementation records
The `rebuild` CHANGELOG currently records these 2026-10-20 slices:
1. Canonical core observation-boundary validation (`CognitiveCycleBoundary.ts`) with malformed observation/mode rejection.
2. ActionGateway restored-receipt integrity: corrupted persisted completion records become fail-closed tombstones; duplicate side effects are not replayed.
3. ActionGateway finalizer-boundary regression: finalize-before-receipt, replay suppression, and fail-closed behavior when finalization fails.
4. Autonomous planner route guard: the resource/tool/life planner must use the canonical OrganismCore execution wrapper.
5. Project-tool route fix: fresh project-tool execution now dispatches through `OrganismCore.executeTool`, including canonical finalization/checkpoint handling for unkeyed read-only outcomes.
6. Legacy avatar storage hardening: sprite outfit preference storage errors no longer break avatar operation.
7. Stage-0 rebuild charter, 12-layer target contracts, six-island roadmap and evidence boundaries.

The changelog lists tests including:
- `test:cognitive-cycle-boundary`
- `test:workpass95:receipt-integrity`
- `test:workpass96:finalizer-boundary`
- `test:workpass97:planner-route`
- `test:avatar-storage`

These are implementation records, not proof that the current `rebuild` HEAD has a green exact-head Actions run. Check Actions for the live HEAD before labeling any slice CI-validated.

## Current architecture state and honest boundaries
- `docs/REBUILD.md`, `docs/ARCHITECTURE.md`, and `docs/ROADMAP.md` are present on `rebuild`.
- The rebuild charter explicitly treats the 12 layers as target architecture, not completed features.
- Current documented canonical owners include `OrganismCore` for cycle sequencing, `MemoryOS2` for persisted memory/retrieval, `EthicalGate` for intent authorization, and `ActionGateway` for side effects.
- Remaining core work includes tracing a real production cycle end-to-end, defining/enforcing the versioned live cycle/event contract, classifying all remaining direct gateway paths, and testing cancellation/stale-event behavior.
- Memory quality is not proven: independent human-labelled RU/EN retrieval uplift remains open; synthetic benchmark fixtures validate test plumbing only.
- Real local-model inference on target hardware, learning transfer/anti-forgetting, browser/Live2D/TTS/device E2E, clean install/rollback, soak, licence/provenance and release security remain open.
- No available evidence supports a claim of subjective consciousness.

## Next code-first task
Continue Stage 1 on `rebuild`: inspect every remaining direct `ActionGateway.executeTool` call site (especially skill execution and reconciliation), classify whether it is a side effect or read-only path, route eligible execution through the canonical core/authorization/finalizer contract, and add a runtime regression that proves EthicalGate/receipt/finalization behavior on the live path. Do not settle for a source-text guard alone. Then run the focused tests and check exact-head GitHub Actions.

## Session rule
At each resume: fetch the live `rebuild` head, compare it with `main` and the PR head, inspect the latest Actions runs, read this checkpoint and `docs/REBUILD.md`, then implement one bounded behavioral change. Update this checkpoint and CHANGELOG only with observed facts and exact evidence.
