# NK1 Execution Checkpoint — Runtime Checkpoint Envelope

**Recorded:** 2026-11-24  
**Status:** implementation extended to checkpoint schema v2; exact-head CI and semantic typecheck in progress; independent review and mobile soak outstanding  
**Repository:** `ailtron1ss-rgb/NK1`

## Identity

- Canonical branch: `workpass70-source`
- Canonical base SHA: `29ab13c98b3a603bc1667a99fffb8ee33dc9560d`
- Aspect branch: `aspect/p0-runtime-checkpoint-envelope-20261124`
- Verified head SHA: `b6b5e4d48c0813a676c8cc6ae3e91781fcba530c`
- Pull request: [#1170](https://github.com/ailtron1ss-rgb/NK1/pull/1170)
- PR state: Open, Draft, mergeable; not merged.

## What changed

The canonical Core persisted object stores a version-2 runtime checkpoint envelope generated at the Core durable-save boundary. Version 1 remains readable for historical checkpoints. The envelope contains bounded, raw-deflate/base64 owner snapshots plus SHA-256 payload hashes for:

1. WorldEnvironment
2. OpenLoopRadar
3. CognitiveSpineScheduler
4. RiskAwareRecoveryController
5. CognitiveHealth monitor (or explicit null when not configured)

Version 2 additionally binds, in the same generation:
- A durable `OperationalJournal` cursor (retained segment count/bytes, active segment byte offset and record count, segment/last-record SHA-256, file fsync result and directory fsync capability).
- A SHA-256 manifest over generation/checkpoint identity, Core and World ticks, creation timestamp, journal cursor, each owner's encoding/size/hash metadata, and aggregate payload accounting.

Core owns envelope generation and the monotonic generation number. Runtime supplies owner snapshots via a structural contributor; after the atomic Core save, the commit observer writes existing sidecar files as projections. The contributor awaits an append-queue journal barrier before reading its cursor, so later appends cannot move the captured offset. The write-only test/custom journal adapter fallback is explicitly marked non-durable and empty (`fileSynced=false`); it is not represented as an fsync receipt.

Startup accepts schema v1 as legacy and validates v2's exact envelope/owner keys, journal cursor invariants, manifest hash, owner hashes, declared raw/compressed sizes, aggregate budgets and owner shapes before decompression. It validates Core tick alignment and preflights owner restorers before applying any owner. A valid envelope wins over stale or mixed sidecars and repairs them. Missing/invalid envelopes retain the documented legacy restore behavior or fail closed when a present generation is unrecoverable. Startup creates a structured recovery receipt (`restored`, `rejected`, `restore-failed`, or `legacy`) in the existing OperationalJournal.

Explicit OpenLoop mutations now force the canonical Core checkpoint before returning. World, Spine, RiskRecovery and CognitiveHealth updates mark the existing Core checkpoint governor dirty rather than racing their sidecar files independently.

## Verification

Latest implementation head: `b6b5e4d48c0813a676c8cc6ae3e91781fcba530c`.

Exact-head workflows are currently running after the schema-v2 additions. Previous green CI results apply to earlier heads only and are not carried forward as proof for this head. Semantic TypeScript checking has been added to the focused workflow using pinned CI-only TypeScript/Node typings; its result is pending.

Focused checks:
- `NK1 Cognitive Core Consolidation`: PASS
- `NK1 Module Dependency Audit`: PASS
- `NK1 Unified organism runtime`: PASS
- `NeuroCore core regression validation`: PASS
- `NK1 integrated software baseline`: PASS
- `NK1 Cognitive Health Runtime Supervision`: PASS
- `NK1 clean prototype startup smoke`: PASS

The real-runtime checkpoint regression exercises generation advancement across restart, tampered owner/manifest rejection, aggregate size guard, exact-key validation (including hostile Proxy own-key enumeration), mixed-sidecar repair, cursor queue ordering and legacy no-envelope restore.

## Preserved boundaries

- `workpass70-source` remains unchanged at the base SHA above.
- Latest Release remains `NeuroKurisu0.1`, tag `Neuro`; its ZIP asset was not modified.
- No changes were made to Release assets or `main`.
- Synaptic replay-anchor trust remains in the external monotonic authority.
- Procedural skill lifecycle remains in its own store.
- OperationalJournal and ContinuityLedger remain append-only streams.

## Remaining gates

- Complete exact-head CI and semantic runtime `tsc` without falling back to syntax-only mode.
- Independent review of PR #1170.
- Real Android/Termux soak: checkpoint payload size, p50/p95 latency, peak heap, cold restart and storage/power-loss recovery.
- Keep Draft until those review and device gates are complete. No merge or release is implied by the source changes.

---

## Live verification addendum — 2026-11-26

This addendum supersedes the earlier “in progress / pending” CI wording above; the earlier section is retained as the historical checkpoint record.

### Exact implementation head

- PR: [#1170](https://github.com/ailtron1ss-rgb/NK1/pull/1170)
- Branch: `aspect/p0-runtime-checkpoint-envelope-20261124`
- Exact head: `b52bec76dc98e09430ed37b8a9d387e5bb636109`
- PR base at verification: `workpass70-source` @ `29ab13c98b3a603bc1667a99fffb8ee33dc9560d`
- PR state: Open / Draft; GitHub reported mergeable and clean at the time of verification.
- PR exact-head checks: **76/76 completed SUCCESS**, zero failed, cancelled, or pending.

### Focused runtime proof

The exact-head run [NK1 Cognitive Core Consolidation #647](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45770053994) completed successfully. Its steps explicitly show:
- Runtime checkpoint generation and mixed-sidecar recovery — completed successfully.
- Runtime checkpoint projection failure matrix and invalid-envelope quarantine — completed successfully.
- Pinned TypeScript 5.8.3 / Node typings installation — completed successfully.
- Runtime typecheck — completed successfully.

The exact-head [Module Dependency Audit #1558](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45770054037) also completed its “Typecheck runtime” step successfully. The broader [Core regression validation #8591](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45770053761) completed runtime typecheck, app typecheck and app build successfully.

### Current-source relationship and integration status

The live canonical source has advanced to `workpass70-source` @ `7e601680c765d6dc94e51e4c8f5e729b48a6f56e`. Compared with PR #1170's base, the current source is six commits ahead and has no commits behind that base. Therefore the PR's clean mergeability signal is not a substitute for synchronizing it against the current source and re-running exact-head CI before integration.

### Remaining acceptance gates

- Independent code review of PR #1170.
- Reconcile/synchronize with the current `workpass70-source` head and rerun all required checks on the resulting exact head.
- Real Android/Termux measurement: checkpoint payload and compressed bytes, p50/p95 save latency, peak heap, cold restart, and storage/power-loss recovery.
- Keep PR #1170 Draft until these gates are addressed. No merge, canonical-source change, or Release publication is claimed by this addendum.
