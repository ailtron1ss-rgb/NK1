# NeuroCore progress

**Snapshot:** 2026-11-27 23:00 America/New_York  
**Product branch:** `neurocore-unified/main`  
**Live product HEAD:** current PR #1221 head (this progress snapshot is not a release pin)  
**Latest source:** `workpass70-source@99859cc488efa342ccba1cc74aecb4d2ffdaceb1`  
**Latest cognitive merge:** `53a5926f753c56b97599b1ee28a0e46d769662b2`
**Latest watchdog merge:** `ae26fb8d1bae5dfc1acc985710ec7251ac433d3a`  
**Seed:** `3526f61814e19f1f10766f3b2385488eb04e3d2e`  
**PR #1221:** Draft, mergeable; 174 commits ahead, 0 behind source.

Percentages measure the engineering build plan, not intelligence, consciousness or autonomy. Source synchronization alone is not test acceptance.

| Workstream | Weight | Completion | Weighted |
|---|---:|---:|---:|
| Full source baseline and isolated product branch | 20% | 100% | 20.0% |
| App ↔ runtime integration and cognitive wiring | 20% | 80% | 16.0% |
| Canonical organism, memory and action ownership | 15% | 88% | 13.2% |
| NeuroCore product identity migration | 10% | 60% | 6.0% |
| Branch-specific test execution and CI acceptance | 15% | 20% | 3.0% |
| Anatomical 3D body implementation | 10% | 65% | 6.5% |
| Termux packaging and device acceptance | 10% | 0% | 0.0% |
| **Total weighted build progress** | **100%** |  | **64.7%** |

The weighted score increased because the current product branch now contains integrated workspace, metacognitive, planner-lineage and signed-perception paths; the app/runtime and canonical-owner workstreams advanced, and several focused CI suites passed on the immediately preceding merge-head. The current exact head is still re-running its full matrix.

## Implemented capabilities

### Cognition and decision making
- **IMPLEMENTED:** `GlobalWorkspaceSubstrateV2` performs bounded competition, recurrent latent updates and broadcast; current-cycle workspace arbitration runs before P61/P64. It keeps bounded coalition and decision receipts and supports decision-scoped delayed outcome credit.
- **IMPLEMENTED:** metacognitive input is 27-dimensional; migration preserves older 24-feature checkpoints by zero-padding; output/target pairs align; gradient updates use the current observation; restored neural state is sanitized.
- **IMPLEMENTED:** planning is bound to exact decision ID/tick, active goal revision and world fingerprint; plans carry integrity fingerprints, step preconditions and expected outcomes. A prior-plan revision hint is accepted only for the immediately preceding tick and a sufficiently verified, independent, externally observed outcome.
- **IMPLEMENTED:** G3 observed-perception admission requires trusted public-key verification, expected device/session identity, active host consent and durable nonce replay prevention. Missing or invalid proof fails closed; external callers cannot self-promote data to observed/verified.

### Memory and persistence
- **IMPLEMENTED:** one canonical `MemoryOS2` is injected into `MemoryFabric`; identity regression remains in the core gate.
- **IMPLEMENTED:** continuity journal detached-batch flush, write-ahead rollback marker, fsync, torn-tail recovery, complete-record compaction and durability diagnostics; six concurrency/recovery/retention regressions added.
- **IMPLEMENTED:** runtime shutdown now distinguishes Core, cognitive-spine, risk-recovery, world and continuity-ledger persistence; it emits `runtime.stop.durable` only after all obligations are confirmed, otherwise `runtime.stop.partial` and propagated errors. Five fault-injection tests added.

### Body and model
- **IMPLEMENTED:** 61-bone / 60-pivot humanoid rig; 22-particle / 21-segment body solver, IK, heel/toe ground contacts, friction, 150-degree elbow/knee hinge limit, material-batched skinned anatomical volumes and body-channel motor wiring.
- **IMPLEMENTED:** actual body update loop is bounded to 20 Hz; visual rendering is independent.
- **IMPLEMENTED:** OpenClaw SKILL.md is imported as untrusted external knowledge through the existing N.E.K.O. adapter; preview is read-only, commit requires explicit review and imported text receives no tool/action authority.
- **IMPLEMENTED:** existing loopback-only llama.cpp provider supports bounded schema-constrained JSON output; no duplicate provider/model selector was created.

## Exact-head evidence

**Previous merge-head `53a5926f...`:**
- **PASS:** articulated particle body physics, TypeScript validation and development bundle (workflow `46061089920`).
- **PASS:** current-cycle Global Workspace pre-arbitration and cognitive-cycle boundary (workflow `46061090171`).
- **PASS:** metacognitive memory projection, full-cycle runtime lineage regression and runtime typecheck (workflow `46061090137`).
- **FAILED:** broad core regression reached app script tests and found one stale health assertion expecting `reason: public-health`. The actual public health response exposes `service: neurocore`, `legacyService: neuro-kurisu`, schema/version and tick instead. The test was corrected; no production runtime behaviour was changed to satisfy the stale assertion.

**Current exact head `4dfc60c4...`:**
- New Actions workflows are queued/in progress: core regression, focused NeuroCore integration, body physics, normalized VRM motor, ActionGateway governance, Global Workspace, G3 evidence admission, goal-bound planner, metacognitive projection, unified runtime and browser smoke.
- **PENDING:** exact-head app script suite after health contract correction; app/runtime typecheck and full core gate depend on that step.
- No G3 host-device PASS or planner exact-head PASS is claimed yet.

## Unresolved / not accepted
- **UNRESOLVED:** browser hydration, end-to-end chat, local model handshake with an explicitly configured llama.cpp server, interrupted-process recovery and Android/Termux installation.
- **UNRESOLVED:** continuous anatomical skin/deformation, full balance, collisions, foot planting, gait and mid-range Android frame/RAM/thermal profiling.
- **UNRESOLVED:** host key provisioning, active consent authority and real Android G3 nonce-store/fsync behaviour.
- **DEVICE-TESTED:** none in this pass.
- **RELEASE:** not ready; PR remains Draft.

## Next execution order
1. Clear exact-head app regression failures, then require app typecheck/build and runtime typecheck on the same SHA.
2. Pass NeuroCore core, Global Workspace, planner-lineage, G3 admission, metacognitive and body gates on the exact current SHA.
3. Run live runtime smoke: chat, wake/sleep, action approval, memory write/read/forget, restart/restore and structured local-LLM handshake.
4. Complete Termux clean install/start/stop/restart and phone resource profiling.
5. Continue embodiment from segmented skinned volumes toward continuous surface, stable foot contact, balance and gait.
6. Only then prepare a user-facing release archive and consider taking the PR out of Draft.

Progress changes only when corresponding code and evidence exist.


## RecoveryWatchdog source correction — 2026-11-27

- **IMPLEMENTED:** durable timestamp no longer advances when no backing store exists; heartbeat/tick liveness is still updated independently.
- **IMPLEMENTED:** restore rejects missing, malformed, negative and implausibly future checkpoint timestamps rather than coercing arbitrary values.
- **IMPLEMENTED:** canonical Core marker is committed only after the canonical store save succeeds; a failed save leaves the previous durable marker unchanged.
- **TEST ADDED:** no-store checkpoint, malformed restore and injected canonical-save failure contracts.
- Source head `99859cc...` was integrated by two-parent merge `ae26fb8...`; exact-head CI remains queued/in progress.
