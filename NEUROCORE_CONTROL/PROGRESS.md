# NeuroCore progress

**Snapshot:** 2026-11-27  
**Product branch:** `neurocore-unified/main`  
**Source branch synchronized through:** `workpass70-source@8994a103f6b735f6347d77d926ee9c024a4d4f4d`  
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
