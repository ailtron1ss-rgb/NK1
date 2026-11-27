# NeuroCore progress

**Snapshot:** 2026-11-27 — live engineering pass  
**Product branch:** `neurocore-unified/main`  
**Source branch synchronized through:** `workpass70-source@8994a103f6b735f6347d77d926ee9c024a4d4f4d`  
**Latest product HEAD:** `ef23301c228b0b3c4da0f9ab9f5cd38f29651e52` (PR #1221; Draft; mergeable)  
**Latest product/source merge:** `cb1c22e3c6c7f4eba73ad00b213442cee71c65d2` (two parents: product head `59b246e...` + source head `8994a103f6b735f6347d77d926ee9c024a4d4f4d`)  
**Seed baseline:** `3526f61814e19f1f10766f3b2385488eb04e3d2e`

The percentage below tracks the build plan, not model intelligence, consciousness, or upstream historical completion. Synchronizing upstream commits improves source coverage but does not count as tested product acceptance.

| Workstream | Weight | Current completion | Weighted |
|---|---:|---:|---:|
| Full source baseline and isolated product branch | 20% | 100% | 20.0% |
| Existing app ↔ runtime integration carried into branch | 20% | 75% | 15.0% |
| Canonical organism/subsystem/memory ownership preserved | 15% | 85% | 12.75% |
| NeuroCore product identity migration | 10% | 60% | 6.0% |
| New branch-specific test execution and CI acceptance | 15% | 0% | 0% |
| Requested anatomical 3D body implementation slice | 10% | 60% | 6.0% |
| Termux packaging and device acceptance | 10% | 0% | 0% |
| **Weighted assembly progress** | **100%** |  | **59.75%** |

**Overall assembly: 59.75%.** This pass adds two donor capabilities and synchronizes the newer source commit, but the percentage remains unchanged until exact-head product CI and device evidence exist. This is not a runtime pass rate or release-readiness score.

## Current evidence

- **PROVEN:** the product branch is based on the pinned seed and now has a two-parent source merge at `cb1c22e3c6c7f4eba73ad00b213442cee71c65d2`, including current source head `8994a103f6b735f6347d77d926ee9c024a4d4f4d`; source ancestry is preserved, and the product branch is not behind the source line.
- **IMPLEMENTED:** NeuroCore-facing title, home screen, chat label, API-base alias and runtime health identity.
- **IMPLEMENTED:** one canonical `MemoryOS2` instance is constructed by `MemorySubsystemRuntime` and injected into `MemoryFabric`; an identity regression is present. It is not yet branch-CI accepted.
- **IMPLEMENTED, EXACT PRODUCT CI PENDING:** OpenClaw `skills/<name>/SKILL.md` imports enter the existing N.E.K.O. Markdown adapter as unknown external semantic facts, quarantined by default; preview is read-only and commit requires explicit review override. Imported text gains no tool/action authority.
- **IMPLEMENTED, EXACT PRODUCT CI PENDING:** the existing loopback-only `OpenAICompatibleLocalChatProvider` accepts bounded JSON Schema response formats for llama.cpp, rejects unsafe schema objects before transport, bounds the response payload, and rejects malformed structured JSON. No second LLM runtime or model selector was added.
- **IMPLEMENTED:** default 3D humanoid rig with 61 bones, 60 movable pivots and material-batched skinned meshes built from the anatomical part volumes; arm/leg IK and particle-to-bone binding are wired.
- **INHERITED FROM CURRENT SOURCE:** the 22-particle / 21-segment articulated solver now includes heel/toe ground contacts, tangential friction, swing take-off handling and 150-degree elbow/knee hinge constraints. The upstream change records 11/11 checks on its source PR head; that result is not a pass for this NeuroCore branch.
- **IMPLEMENTED IN THIS PASS:** body control/physics cadence is changed to 20 Hz and every solved snapshot is published; a dedicated scheduler regression is wired into the real `AvatarStage` loop. Earlier exact-head VRM workflow passed app typecheck and production bundle; the latest integrated body suite is pending after ESM import correction.
- **IMPLEMENTED IN THIS PASS:** the NeuroCore core regression command now includes memory state round-trip and capacity/lifecycle integrity suites. Execution is pending.
- **UNRESOLVED:** the procedural surface remains composed from anatomical parts; continuous tissue deformation, collision, balance, foot planting and full gait are not accepted.
- **UNRESOLVED:** browser hydration, end-to-end chat, actual configured local-model handshake, persistence under interrupted shutdown, and Android/Termux installation/performance. Donor-adapter checks passed on their earlier source PR head (documented in the donor review), not on the latest product head. Durable marker/rollback behaviour is covered by synthetic process-restart tests only; real phone filesystem behaviour is not measured.
- **DEVICE-TESTED:** none in this pass.

## Next checkpoint

1. Run the focused NeuroCore integration workflow on the merged product branch and inspect every failed or skipped job.
2. Run root/app/runtime typecheck, all embodiment suites, memory round-trip, capacity/lifecycle and canonical-owner regressions.
3. Verify browser hydration, chat, memory readback, sleep/wake and error recovery against a live runtime.
4. Advance the body from segmented volumes to continuous skin/deformation, then validate contact, balance, gait and mobile frame pacing.
5. Complete Termux install/start/stop/restart and persistence acceptance before publishing a runnable full application package.

Progress changes only when corresponding code, tests and evidence exist.

## Live checkpoint — 2026-11-27, later engineering pass

**Exact current product SHA:** `ef23301c228b0b3c4da0f9ab9f5cd38f29651e52`  
**Base:** `workpass70-source@8994a103f6b735f6347d77d926ee9c024a4d4f4d`  
**PR:** [#1221 NeuroCore product branch](https://github.com/ailtron1ss-rgb/NK1/pull/1221), Draft / mergeable.

### Implemented in this pass
- Procedural humanoid rig now binds ten additional canonical particle landmarks to forearm/wrist/hand/knee/ankle bones; the focused regression requires 17 total particle-to-bone bindings.
- Corrected left/right knee IK bend direction and knee-relative angle handling; mirrored limb-limit envelopes remain tested.
- Fixed browser-smoke selectors for NeuroCore product title, actual `NeuroCore 3D` preview accessible name, and actual `Write to NeuroCore…` chat placeholder.
- Mobile browser smoke now checks the product's real no-preference default (`3d`) and then explicitly switches to Live2D before requiring a loaded Live2D model. No product renderer default was changed.
- Fixed runtime shutdown error accounting so concrete ContinuityLedger `flush()`/`close()` failures remain the primary error instead of triggering a duplicate generic error based on text matching. Added an injected close-failure regression and safe fixture teardown.
- Corrected the NeuroCore integration workflow to run the app build through `npm run build`, ensuring `app/node_modules/.bin` is present on PATH for Vite.
- Restored the full 3,546-line `OrganismRuntime.ts` after a partial-range Contents API write mistake in the feature branch, then reapplied the shutdown change to the full file. This was isolated to the product branch; canonical source and `main` were never modified.

### Exact-head CI status at this checkpoint
- **17/95 successful check runs (17.9%)**, 11 in progress, 67 queued, 0 failures at the last poll of this SHA.
- The app regression suite has previously passed on the preceding exact head, including app-script tests, app typecheck/build, runtime typecheck, memory retrieval/unanswerable tests, Hexis evidence/restart persistence, P23 learning restore, local LLM bounded-output and HTTP tests, governance/approval boundaries, speech gateway/timescale/persistence, and shutdown durability regressions. These prior-head passes are evidence of the implementation but do not replace the current-head full matrix.
- On the current head, the full browser smoke has not yet completed; the current run is in progress. Treat browser acceptance as **PENDING**, not passed.
- The weighted assembly figure remains **59.75%** until this branch's complete exact-head acceptance and the formal plan crosswalk are re-evaluated. The 17/95 figure is a live CI execution ratio, not a substitute for the weighted prototype score.

### Separate avatar-surface PR #1220
- Added source model axis/bounds diagnostics, then corrected camera framing to refresh every `SkinnedMesh` skeleton palette, recompute skinned bounds, and use `Box3.setFromObject(root, true)` for pose-aware vertex bounds before and after normalization.
- Updated the GLB motion integration contract to require skeleton refresh, bounding-box recomputation and the pose-aware bounds call.
- The earlier framebuffer artifact showed only a 4-pixel-tall visible stripe from an otherwise loaded 101-mesh/99-skinned-mesh GLB. This was a real visual failure, not a threshold-only test issue.
- Latest diagnostic/pose-aware patch is now on PR #1220 head `747a5f54ea3591bd3acb0195b5a5b8ddbea82b3e`; its fresh CI is running. No WebGL visual pass is claimed yet.

### Remaining acceptance gates
1. Current-head #1221 full-app browser smoke and final integration/runtime workflows.
2. #1220 pose-aware WebGL framebuffer readback with meaningful model occupancy; preserve strict pixel acceptance.
3. Actual configured local LLM provider handshake (optional live smoke is skipped unless a loopback endpoint is supplied).
4. Android/Termux install, memory/thermal/battery profiling, physical restart/power-loss and audio/lipsync measurements.
5. Independent bilingual retrieval holdout and legal/release provenance, ZIP parity and human license approval.

No PR was merged, no branch was force-pushed, and no `main`, canonical `workpass70-source`, or Release asset was modified by this pass.
