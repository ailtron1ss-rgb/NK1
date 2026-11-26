# Runtime Checkpoint Envelope Implementation Plan

> **For agentic workers:** Use the native session to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Commit the critical runtime-owned sidecar snapshots in the same atomic Core checkpoint, then recover and repair them as one generation.

**Architecture:** OrganismRuntime supplies a synchronous contributor that returns snapshots for World, OpenLoopRadar, CognitiveSpineScheduler, RiskAwareRecoveryController and CognitiveHealth. OrganismCore creates the generation and embeds a raw-deflate/base64, SHA-256-verified envelope in the canonical Core object immediately before the atomic FileStateStore save. The post-commit observer repairs sidecar projections. Startup preflights exact keys, aggregate/per-owner sizes, hashes and owner restorers before applying all snapshots; absent/invalid envelopes use the legacy sidecar path.

**Tech Stack:** TypeScript, Node.js 22, existing FileStateStore, Node test scripts.

**Spec:** docs/superpowers/specs/2026-11-24-runtime-checkpoint-envelope-design.md

## Global Constraints

- Keep workpass70-source unchanged; work on aspect/p0-runtime-checkpoint-envelope-20261124.
- Do not create duplicate version-suffixed branches.
- Do not add a new multi-megabyte Core snapshot or force a disk flush on every cognitive tick.
- Keep Synaptic replay-anchor authority external and monotonic.
- Preserve legacy sidecar restore when no verified envelope exists.
- Do not merge or update Release artifacts.

## Review Focus

- Corrupted owner snapshot with an unchanged digest must invalidate the entire envelope, not partially restore one owner.
- A newer sidecar from an interrupted projection must not override a valid committed generation.
- Invalid owner snapshots must not mutate live owners before the whole envelope is accepted.
- A legacy Core file with no envelope must still start from its existing sidecars.
- Sidecar repair failure must not invalidate the already committed Core checkpoint.

---

### Task 1: Runtime checkpoint regression

**Files:**
- Create: runtime/neuro-kurisu/tests/runtime-checkpoint-envelope-workpass73.mjs
- Modify: runtime/neuro-kurisu/package.json
- Modify: .github/workflows/nk1-cognitive-core-consolidation.yml

**Interfaces:**
- Consumes: existing OrganismRuntime.init/step/flush/stop.
- Produces: a failing real-runtime contract proving the Core file currently has no shared runtime-owner envelope.

- [x] Add the test that verifies one committed envelope contains the five owners and that a mixed World/OpenLoop sidecar set is repaired from it.
- [x] Run npm run test:runtime-checkpoint-envelope and confirm the initial red failure on the missing Core envelope.
- [x] Add the test command and workflow path trigger so future changes always execute this regression.

### Task 2: Bounded envelope primitive

**Files:**
- Create: runtime/neuro-kurisu/src/organism/system/RuntimeCheckpointEnvelope.ts
- Test: runtime/neuro-kurisu/tests/runtime-checkpoint-envelope-workpass73.mjs

**Interfaces:**
- createRuntimeCheckpointEnvelope({generation,checkpointId,coreTick,createdAt,snapshots}): RuntimeCheckpointEnvelope
- validateRuntimeCheckpointEnvelope(value): RuntimeCheckpointEnvelopeValidation
- Each owner payload is bounded and raw-deflate compressed; each uncompressed JSON payload has a SHA-256 digest. The envelope carries version, generation, checkpointId, coreTick, worldTick, createdAt, payload sizes and owner digests.

- [x] Validate exact object/key shape, safe integer counters, per-owner and aggregate payload limits before decompression, encoded lengths and all owner hashes.
- [x] Reject the entire bundle if any owner digest or required snapshot is invalid.

### Task 3: Capture at the Core durable boundary

**Files:**
- Modify: runtime/neuro-kurisu/src/organism/core/OrganismCore.ts
- Modify: runtime/neuro-kurisu/src/organism/core/OrganismRuntime.ts
- Modify: runtime/neuro-kurisu/src/organism/persistence/StateMigrations.ts

**Interfaces:**
- OrganismCore.setRuntimeCheckpointContributor(provider: ((coreTick:number) => RuntimeCheckpointOwnerSnapshots) | null): void
- OrganismCore.validateRuntimeCheckpointEnvelope(value): RuntimeCheckpointEnvelopeValidation
- The provider is synchronous and invoked immediately before the Core durable save, after the Core projection is complete. Core owns the monotonic generation, checkpointId and encoding; Runtime contributes the five owner snapshots.
- The resulting envelope is stored in PersistedOrganism.system.runtimeCheckpointEnvelope within the same atomic Core file replacement.

- [x] Preserve the optional envelope through the canonical StateMigrations allow-list.
- [x] Verify the envelope is captured on real Runtime flushes and normal Core durable checkpoints.
- [x] Keep the Core-to-Runtime boundary structural; Core consumes only the owner snapshot contract.

### Task 4: One-generation recovery and sidecar repair

**Files:**
- Modify: runtime/neuro-kurisu/src/organism/core/OrganismRuntime.ts
- Test: runtime/neuro-kurisu/tests/runtime-checkpoint-envelope-workpass73.mjs

- [x] Validate the complete envelope and preflight all owner restorers before mutating live owners.
- [x] When valid, restore all five owners from it and rewrite existing sidecars from exactly those snapshots.
- [x] When absent or invalid, retain the legacy sidecar restore path and record a bounded warning for invalid envelopes.
- [x] Verify stale sidecars cannot erase a valid committed obligation or World state; also verify legacy no-envelope compatibility.

### Task 5: Verification

- [x] Run npm run test:runtime-checkpoint-envelope (real runtime: PASS).
- [x] Run runtime typecheck in the Module Dependency Audit workflow (PASS).
- [x] Run Cognitive Core Consolidation, Unified organism runtime and Core regression workflows (all PASS).
- [x] Inspect the final branch diff; workpass70-source and Release assets remain unchanged.


## Verified execution record — 2026-11-24

- Repository: `ailtron1ss-rgb/NK1`
- Canonical base: `workpass70-source` at `87c9ed9034e09ca9fb83fd676ac52bb46434c4fe`
- Working branch: `aspect/p0-runtime-checkpoint-envelope-20261124`
- Verified implementation head: `91093837f72863633313b957e68e6780db2ab387`
- PR: [#1170](https://github.com/ailtron1ss-rgb/NK1/pull/1170), open and Draft.

Latest-head GitHub Actions: **73/73 workflows successful, 0 failed, 0 cancelled, 0 active**. Commit checks: **30/30 successful**.

Focused evidence:
- Cognitive Core Consolidation: PASS; checkpoint envelope generation `3`, mixed-sidecar recovery, owner hash tamper rejection, aggregate size preflight and legacy no-envelope path.
- Module Dependency Audit: PASS; 65 dependency-budget checks, zero violations, zero cycles, zero boundary violations; transitive server-import audit and runtime typecheck passed.
- Unified organism runtime: PASS.
- NeuroCore core regression validation: PASS.
- Integrated software baseline: PASS.
- Cognitive Health Runtime Supervision: PASS.
- Clean prototype startup smoke: PASS.

The initial TDD red was recorded on the first PR head: a real Runtime flush left `system.runtimeCheckpointEnvelope` undefined. The same regression passes after implementation.

## Remaining post-implementation work

1. Independent code review of PR #1170, especially the owner-preflight/restore boundary and Core post-commit observer failure handling.
2. Failure-injection coverage for a sidecar write failure after a successful Core commit, verifying the Core envelope remains authoritative and repair retries on restart.
3. On-device mobile soak measurements for envelope payload/compressed bytes, checkpoint p50/p95 latency, heap peak and restart recovery time.
4. Only after review and those measurements: mark PR ready and discuss integration into the canonical source. Do not publish a Release ZIP from this Draft branch.
