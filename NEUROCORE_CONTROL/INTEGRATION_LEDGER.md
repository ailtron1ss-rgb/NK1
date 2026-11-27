# Integration ledger

| Area | Existing owner/path | Current status | Next action |
|---|---|---|---|
| UI ↔ runtime API | `app/src/neuro-kurisu/api.ts`, `app/src/organism/store.ts`, backend `/api/organism/ui-snapshot` | IMPLEMENTED upstream; NeuroCore env alias added | Verify all UI actions against a live runtime |
| Recovery watchdog | `RecoveryWatchdog.ts` + canonical Core checkpoint | IMPLEMENTED: heartbeat is independent of durable marker; no store never advances marker; malformed/missing/negative/future timestamps fail restore; canonical marker commits only after store save. New source tests cover no-store and failed canonical persistence | Pass exact-head core/watchdog suite; physical process-kill and Android fsync tests remain open |
| Organism host | `OrganismRuntime.ts` | IMPLEMENTED; shutdown now emits `runtime.stop.durable` only after Core, cognitive-spine, risk-recovery, world, and continuity-ledger flush/close all report durable; otherwise emits `runtime.stop.partial` | Pass branch runtime typecheck + 5 shutdown durability regressions; then interrupted-restart/device test |
| Canonical state/core | `OrganismCore.ts` | Existing canonical owner preserved | Inspect persistence/recovery paths before changes |
| Subsystem composition | `OrganismSystemFabric.ts` | IMPLEMENTED upstream | Check subsystem contracts/health as one composition |
| Canonical memory | `MemoryOS2.ts` via `MemoryFabric` | SINGLE OWNER IN CODE; identity, restore/round-trip and capacity/lifecycle regressions are included in the gate. Continuity journal is now crash-safe (detached flush batches, write-ahead rollback marker, fsync, torn-tail repair, complete-line bounded compaction); 6 durability regressions added. Exact latest branch CI still pending | Confirm core-gate pass; test real interrupted process recovery, idempotent canonical writes and Android filesystem fsync semantics |
| Cognitive cycle | `UnifiedCognitiveCycle.ts`, `GlobalWorkspaceSubstrateV2.ts` | IMPLEMENTED: recurrent competition/recurrence/broadcast, bounded coalition, decision receipts; current-cycle workspace runs before P61/P64. Previous merge-head workspace-prearbitration + cognitive-cycle boundary tests PASS; current exact-head rerun pending | Pass current-head focused suite; measure outcome-credit calibration and coalition quality on holdout traces |
| Action permissions | `ActionGateway.ts` | Existing authority preserved; OpenClaw imports and signed perception add no action authority. G3 host admission is a separate trust boundary, not an action bypass | Pass current-head governance + host-proof suites; audit all action callers |
| Local LLM | `OpenAICompatibleLocalChatProvider.ts` + existing P40 ecology | OPTIONAL LOOPBACK provider; now supports bounded JSON Schema-constrained output, guarded schema cloning, abort/timeout and bounded response parsing; no second model selector | Pass current-head structured-output contract; test a configured llama.cpp server and phone RAM/latency |
| OpenClaw skill ingestion | `NekoExternalMarkdownMemoryAdapter.ts` → canonical `MemoryFabric` / `MemoryOS2` | IMPLEMENTED: `skills/<name>/SKILL.md` is accepted only as unknown external semantic facts, quarantined on preview, explicit review override required for commit; no tool/action authority | Pass current-head OpenClaw import contract; add user-facing review UX before production exposure |
| 3D embodiment | `proceduralHumanoidRig.ts`, `Avatar3DStage.tsx`, `AvatarStage.tsx`, `articulatedBodyParticles.ts` | 61-bone hierarchy / 60 movable pivots; material-batched skinned volumes; IK; current 22-particle / 21-segment source solver with 150° hinge limit + heel/toe contact/friction; actual body physics loop bounded to 20 Hz; VRM adapter, App typecheck and production bundle passed on the exact previous feature head; latest integrated rig/ESM tests are being rerun | Pass full current-head app and particle-solver suite; then continuous tissue surface, balance, gait, collision and phone profiling |
| Android/Termux | toolchain/startup scripts | DOCUMENTED; DEVICE UNVERIFIED | Test exact Node 24 / Python 3.11 and phone resource budgets |
| Product identity | browser metadata, home screen, health endpoint | PARTIALLY MIGRATED to NeuroCore | Search/fix remaining visible old product labels without breaking compatibility |
| Release acceptance | typecheck, app tests, runtime suites, CI, device tests | NOT YET VERIFIED for this branch | Run all gates and keep failure evidence |

## Source synchronization and donor decisions

- Product branch is seeded from `3526f618...`; it was first synchronized through `3857e805...` (`e5fa0fbb...`) and then through `8994a103...` (`cb1c22e...`). The latest merge preserves both product and source histories; `main` and `workpass70-source` were not modified by product work.
- PR #1218 RecoveryWatchdog durability fix is already present in the pinned baseline. Do not port it a second time.
- PR #1217 is the superseded test-first predecessor; no port.
- PR #1198 was reviewed file-by-file. Its improved `ContinuityLedger.ts` and `continuity-ledger-durability-20261124.mjs` were selectively ported because the current implementation could lose records arriving during an awaited flush and could truncate JSONL mid-record at capacity. Port adds detached batch draining, rollback marker + fsync, torn-tail recovery, whole-line bounded compaction, and six focused regressions. Its `RuntimeCheckpointEnvelope` and broad runtime integration were NOT ported.
- PR #1174's older `RecoveryWatchdog` implementation was not ported: the current source already contains the later PR #1218 durable checkpoint commit semantics; do not regress/duplicate that owner.
- PR #1170 is not copied wholesale; its checkpoint-envelope overlap remains a candidate for separate contract review only.
- External/legacy research projects remain donor material. Assimilate only specific tested behaviour with a mapped canonical owner.

- Source commit `8994a103...` adds the OpenClaw skill import and llama.cpp structured output integration. Those code/test files and donor review were brought into the product branch with the two-parent `cb1c22e...` merge. The donor review records 19/19 successful checks on predecessor PR head `b042498...`; this evidence is inherited and is not a substitute for exact-head NeuroCore product CI.

Upstream implementation is recorded as inherited baseline, not as work completed by this pass. A test entering the CI command is not equivalent to a passed test.

## Current-pass evidence update

- **IMPLEMENTED, CI PENDING:** one 20 Hz scheduler controls the actual particle/rig update loop; new tests cover the 60 Hz RAF timing and confirm the production `AvatarStage` consumes it.
- **IMPLEMENTED, CI PENDING:** `OrganismRuntime.stop()` now distinguishes Core, world, cognitive-spine, risk-recovery and continuity-ledger durability. It writes a final durable receipt only after ledger close; otherwise it emits a partial receipt and propagates failures.
- **IMPLEMENTED, CI PENDING:** six journal recovery/retention/concurrency tests and five shutdown-receipt tests are added to `test:neurocore-integration`.
- **OBSERVED PASS on exact earlier product head:** normalized VRM adapter, app typecheck and production build; Action Gateway governance/runtime typecheck. These passes do not substitute for the currently pending exact-head integrated suite.
- **FAILED on earlier product head, fixes now committed for rerun:** app test import resolution, particle-frame type alias and shutdown snapshot scope. Do not reuse old failures as current-head result; do not call the fixes PASS until exact-head CI completes.
- **NOT DEVICE-TESTED:** fsync/atomic rename on Android/Termux, 20 Hz frame pacing/thermal behaviour, long-run persistence recovery.

- **IMPLEMENTED, EXACT PRODUCT CI PENDING:** OpenClaw skill instructions are stored as external/unverified knowledge only after explicit per-candidate review; the adapter does not execute them or grant tool permissions.
- **IMPLEMENTED, EXACT PRODUCT CI PENDING:** local llama.cpp provider supports schema-constrained structured JSON responses using the existing model ecology; malformed output and unsafe schemas fail closed.

## Live integration repairs — 2026-11-27

**Product exact head:** `ef23301c228b0b3c4da0f9ab9f5cd38f29651e52`  
**Canonical base:** `workpass70-source@8994a103f6b735f6347d77d926ee9c024a4d4f4d`

| Seam | Concrete repair | Exact status |
|---|---|---|
| Particle solver → procedural humanoid | Bind elbow, wrist, hand, knee and ankle particle landmarks to their matching skeleton bones; preserve bind offsets before IK and apply absolute particle targets after the parent-chain solve | IMPLEMENTED; focused suite passed on a preceding exact head; rerun queued on current head |
| Leg IK → joint limits | Correct mirrored bend sign and knee-relative angle calculation so left/right target angles respect their own limit envelope | IMPLEMENTED; app-script regressions passed on preceding exact head; rerun queued |
| ContinuityLedger → OrganismRuntime.stop | Preserve injected flush/close errors without message-substring heuristics or duplicate generic failures; final durable receipt only when both operations and ledger diagnostics are clean | IMPLEMENTED; shutdown durability regression suite passed on preceding exact head |
| NeuroCore workflow → app Vite binary | Route build through `npm run build` within the app workspace so the local Vite executable is available on PATH | IMPLEMENTED; `neurocore-integration` and integrated software baseline passed on preceding exact head |
| Browser UI smoke → product naming | Align page heading, 3D preview accessible name and chat-input placeholder with the actual NeuroCore UI; mobile smoke checks the actual default 3D preview and then verifies Live2D selection | IMPLEMENTED; current exact-head UI smoke running after last selector correction |
| GLB skins → camera fitting (PR #1220) | Refresh each skin palette, recompute skinned bounds, and use pose-aware vertex bounds before/after normalization; strict framebuffer occupancy gate retained | IMPLEMENTED on PR #1220 Draft head `747a5f54ea3591bd3acb0195b5a5b8ddbea82b3e`; fresh CI queued/running; no visual pass claimed |

### Current boundary
- PR #1221 remains Draft; no source/main/release changes.
- PR #1220 remains Draft and is based on an older source head; no blind merge/rebase.
- The mobile and desktop browser smoke must both pass on the same exact product head. A selector fix is not UI acceptance by itself.
- The 3D framebuffer acceptance still requires a model whose rendered opaque-pixel bounds occupy a meaningful portion of the selected canvas; model-loaded metadata or draw-call count alone is insufficient.


## Cognitive upgrade — source merge `53a5926f...` (45 changed source paths)

| Capability | Canonical owner | Contract now integrated | Acceptance state |
|---|---|---|---|
| Global workspace | `GlobalWorkspaceSubstrateV2.ts` + `OrganismCore` | Bounded candidate admission; recurrent 24-wide latent state; competition, recurrence and broadcast; workspace runs before P61/P64; decision-scoped coalition receipts and delayed outcome credit | Prior exact merge-head workflow PASS; latest exact head queued |
| Metacognitive self-observation | `MetacognitiveNeuralSubstrate.ts` | 27 input features; 24→27 checkpoint migration; prediction targets stay paired with outputs; gradients use current observation; restore state sanitized | Prior exact merge-head projection + typecheck PASS; latest exact head queued |
| Goal-bound planning | `PlanEngine.ts` + `GroundedWorldState.ts` | Decision ID/tick + goal revision + world fingerprint; integrity fingerprint; step preconditions/expected outcomes; one-cycle revision from verified independent observed outcome only | Latest exact head queued |
| G3 observed perception | `SignedObservationAdmissionAuthority.ts` + `FileHostObservationNonceStore.ts` + `PerceptualEvidenceCompiler.ts` | Host public-key receipt verification; trusted device/session; active consent; durable nonce replay prevention and monotonic clock; invalid/missing proof fails closed | Latest exact head queued; host private-key provisioning and Termux fsync still untested |
| Restore sanitization | `RestoreSanitizers.ts`, embodiment restore path | Validate own-data records before touching untrusted/proxy-backed restore payloads | Current exact head covered by full core suite; pending |

### Source update provenance
- Source head advanced from `8994a103...` to `9de695dd...` by four commits: goal-bound planner lineage, G3 signed perception admission, current-cycle workspace arbitration and metacognitive neural integrity.
- These commits modified 45 paths. Exactly two paths overlapped with product-specific changes: `OrganismRuntime.ts` and `runtime/neuro-kurisu/package.json`. They were merged explicitly: source runtime cognition plus product shutdown-durability path; source scripts plus product durability/NeuroCore gates and the three planner/workspace test scripts. The other source changes were overlaid without replacing product-only files.
- Merge commit `53a5926f...` has two parents: product `24416f34...` and source `9de695dd...`. The follow-up health-test correction is `4dfc60c4...`.
- No direct write was made to root `main` or `workpass70-source`.


- Latest source update `9de695dd... → 99859cc...` was three commits and touched only `RecoveryWatchdog.ts` and its focused durability test. Neither path overlapped product changes; both were overlaid in two-parent merge `ae26fb8d...`. Product branch compares ahead 181 / behind 0 against source.
