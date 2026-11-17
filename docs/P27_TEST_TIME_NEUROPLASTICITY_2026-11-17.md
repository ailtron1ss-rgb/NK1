# NK1 P27 — bounded-context Test-Time Neuroplasticity

**Date:** 2026-11-17  
**Status:** implementation candidate in Draft PR [#924](https://github.com/ailtron1ss-rgb/NK1/pull/924); not merged into `workpass70-source` and not included in a Release ZIP.  
**Base:** `workpass70-source` at `1e83a011fc677ff20f2348570322bd562181d9ff`.

## Source idea

Omestro idea 27 describes small, temporary adaptations during inference, confined to a running task/context. It explicitly warns against poisoning, drift and accidental memorization and requires expiry, isolation, reset, bounded updates and independent validation before permanent promotion.

## Runtime ownership

The implementation extends the existing `EmbodiedCausalWorldBridge` owned by `NeuralExperienceBranch`; it does not create a parallel plasticity subsystem. The existing persistent world-model/dynamics learner remains the owner of its long-timescale updates. P27 adds a separate process-local residual overlay used only by the embodied causal predictor.

The overlay changes a compact 16-dimensional latent transition prediction for the seven existing action kinds. It does **not** update LLM weights, base model parameters, prompts or canonical memories.

## Context identity and lifecycle

The Core passes the canonical `TemporalContinuity.currentSessionId` into `NeuralExperienceBranch.beforeDecision`. The branch never uses that raw identifier as an adapter key: it maps it to a random opaque scope held only in an in-memory LRU map (8 sessions maximum). The final context key is:

`session:<opaque-scope>:world:<activeWorldContext>:slow:<slowContextId>`

This separates runtime sessions even when the causal-world and slow-memory clusters are identical. The raw host session ID is not copied into `NeuralExperienceToken`, `lastExperience`, replay entries or the P27 adapter snapshot. The existing Core `TemporalContinuity` ledger remains the owner of its normal host-session metadata. The ephemeral adapter key is held in a private pending field only until its matching outcome is consumed.

`OrganismRuntime.stop()` calls `OrganismCore.endTemporalSession()` inside the existing serialized final flush. That ends the canonical session and clears its P27 contexts without introducing an extra checkpoint. Core initialization also clears all P27 overlays before opening a new process session. Restore drops all ephemeral scopes. The branch exposes `resetTestTimeAdaptation(sessionId?)` for one session or all sessions.

This is **runtime-session isolation**, not strict per-chat isolation: the current `OrganismObservation` contract does not include a canonical conversation ID. Multiple conversations inside one long-lived runtime session therefore share the runtime-session envelope and are further separated by world/slow-memory contexts. The host must supply a proper conversation ID before claiming per-chat separation.

The same private opaque context key is carried from `beforeDecision` to `afterOutcome` without being stored in the durable experience token. Outcomes are accepted by the fast layer only when they match a pending decision tick in the same context. Duplicate, out-of-order, stale and orphan outcomes are rejected from fast adaptation and counted; the existing slow world-model path remains unchanged.

## Safety and resource bounds

- Admission: a fast update is accepted only when `verified01 >= 0.80`; lower-confidence outcomes are counted as rejected.
- Per-context update budget: 64 accepted updates.
- Context capacity: 8 active contexts, with least-recently-used eviction.
- Expiry: 30 minutes wall-clock time or more than 256 runtime ticks without activity.
- Per-component residual bound: `[-0.025, 0.025]`.
- Total overlay L2 norm: at most `0.08`.
- Reset and restore: explicit reset clears one session or every overlay; Core process start, restore and runtime stop clear ephemeral contexts.
- Snapshot boundary: `snapshot()` contains only durable bridge/neural state; opaque session scopes, pending outcome keys and temporary residuals are never serialized.
- Candidate export: `exportTestTimeAdaptationCandidate()` returns an isolated copy marked `requires-independent-validation`. There is no automatic promotion or consolidation path.

The current persistent world model still follows its pre-existing training behavior. P27 specifically prevents the new fast residual layer from mutating the durable `residualAdapter`; it does not silently rewrite or remove other established learning policies.

## Diagnostics

`EmbodiedCausalWorldBridge.metrics()` reports context count, active overlay norm, accepted/rejected updates, expirations and LRU evictions. `NeuralExperienceBranch.diagnostics()` exposes these as `testTimeNeuroplasticity`, including unmatched outcomes. These are runtime counters, not a claim of improved task performance.

## Verification record

The test-first regression was run against base commit `1e83a011fc677ff20f2348570322bd562181d9ff` before the source fix. It failed as expected: one outcome wrote a persistent residual mass of `0.011310623787825652` into the durable snapshot.

After the implementation, the following local tests passed under Node `v24.20.0` in the isolated ProductOS repository clone:

- `tests/p27-test-time-neuroplasticity.mjs` — snapshot separation, session isolation, verified-only admission, duplicate/orphan/out-of-order outcome rejection, candidate-copy isolation, TTL, reset, restore, 8-context LRU cap, 64-update cap, legacy residual compatibility and a matched-snapshot check that the temporary overlay changes the next action evaluation.
- `tests/p27-neuroplasticity-session-lifecycle.mjs` — real `OrganismRuntime` session start/stop; proves the context exists during a live Core tick and is cleared by the single final stop flush.
- `tests/big-pass-2599-2612-online-adaptation.mjs` — existing online world adaptation regression.
- `tests/p28-plasticity.mjs` — existing plasticity substrate regression.
- `tests/big-pass-2522-neural-experience-branch.mjs` — 600-cycle branch regression and snapshot restore.

Typecheck and exact-head GitHub Actions are run by the dedicated workflow. Independent holdout uplift and semantic TypeScript checking (the repository runner uses Node strip-only mode) remain separate evidence gaps. No source merge or release publication is part of PR #924.

## Next integration steps

1. Add a canonical conversation ID to `OrganismObservation` and pass it from chat/voice ingress to the branch before claiming per-chat isolation.
2. Run independent holdout/paired-seed experiments to measure whether fast adaptation improves decisions beyond the persistent baseline.
3. Only if holdout evidence shows repeatable gain, create a separately reviewed promotion path. Never promote an overlay from its own training context or diagnostics.