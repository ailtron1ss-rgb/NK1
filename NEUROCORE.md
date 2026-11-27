# NeuroCore

NeuroCore is the product identity for this standalone NK1 application branch. It combines the existing organism runtime, web control surface, and integrations without creating parallel memory or action authorities.

## Current source baseline

- Source repository: `ailtron1ss-rgb/NK1`
- Source branch: `workpass70-source`
- Current source head: `9de695dd4713ec909d7312b45966d30dfb76d5c2`
- Initial pinned product seed: `3526f61814e19f1f10766f3b2385488eb04e3d2e`
- Product branch: `neurocore-unified/main`
- Product/source merge: `53a5926f753c56b97599b1ee28a0e46d769662b2`
- Current product head: `4dfc60c4d1079bc694f3bc0043bced6c59bad564`

## Runtime and application

The root package orchestrates the application and runtime. The web UI is under `app/`; the canonical organism runtime remains under `runtime/neuro-kurisu/` because a destructive path rename would break a large import graph. The visible product and HTTP health identity are NeuroCore. The browser is a projection/control surface; the runtime owns state, cognition, memory, and action execution.

The backend now includes the current source's integrated cognitive upgrade:
- recurrent Global Workspace competition/recurrence/broadcast before P61/P64 arbitration, with bounded coalitions and decision-scoped delayed outcome credit;
- metacognitive neural input expanded from 24 to 27 features with backward-compatible checkpoint migration, target/output alignment, current-observation gradients, and restore sanitization;
- goal/world-bound planner lineage with decision/tick binding, sealed plan integrity, step preconditions/expected outcomes, and one-cycle revision only from independently verified observed outcomes;
- G3 signed observation admission requiring trusted host proof, device identity, active consent and durable nonce replay protection; missing proof fails closed.

These are implemented source capabilities. Exact product CI, host-key provisioning and Android sensor/nonce-store behaviour remain separate acceptance gates.

## Embodiment

The default 3D view instantiates a built-in 61-bone humanoid rig with 60 movable pivots and material-batched skinned anatomical volumes. It is connected to the 22-particle / 21-segment body solver, arm/leg IK, heel/toe contact, friction and 150-degree elbow/knee hinge limits. The actual body solver is bounded to a 20 Hz cadence; the renderer remains independent.

The body is not yet a continuous deformable human: continuous tissue deformation, full balance, collision handling, foot planting, gait and phone profiling remain open.

## Canonical memory ownership

There is one durable memory owner:

`OrganismCore → OrganismSystemFabric → MemorySubsystemRuntime → MemoryFabric → MemoryOS2`

`MemorySubsystemRuntime` constructs one `MemoryOS2` and injects that exact instance into `MemoryFabric`. Do not create another durable memory store or bypass `MemoryFabric` for writes.

The continuity journal has a separate durability role: detached flush batches, rollback marker + fsync, torn-tail recovery, complete-line compaction and explicit durability diagnostics. It is not a second semantic memory owner.

## Model and external knowledge boundaries

The existing loopback-only llama.cpp provider now supports bounded JSON Schema-constrained output; there is no second model selector or runtime. A live phone/local-model handshake still needs explicit configuration and measurement.

OpenClaw `skills/<name>/SKILL.md` is treated as untrusted external knowledge. Import preview is read-only; explicit review is required before canonical memory write. Imported instructions never grant action/tool authority.

## Working commands

- `npm run install:all` — install root-managed app/runtime workspaces
- `npm run typecheck` — typecheck app and runtime
- `npm run test:neurocore` — integrated NeuroCore gate
- `npm run dev` — development orchestration
- `npm run start` — production start (requires production build)
- `npm run doctor` — environment and project diagnostics

Pinned toolchain: Node 24 and Python 3.11. Android/Termux installation and device acceptance are not yet claimed.

## Evidence rules

A module count is not proof of working behaviour. Reports distinguish source-present, implemented, wired, locally tested, CI-tested, device-tested and measured. No intelligence uplift, consciousness, autonomy or mobile-readiness claim is made without relevant evidence.

See `NEUROCORE_CONTROL/` for progress, architecture, integration ledger, source provenance and next work.
