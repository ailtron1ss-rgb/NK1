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

The current `NeuralExperienceBranch` API does not expose a unique conversation/session identifier. Until the host lifecycle provides one, the runtime derives a bounded context key from the active causal-world context and the existing slow-memory context:

`world:<activeWorldContext>:slow:<slowContextId>`

The same key is carried in `NeuralExperienceToken` from `beforeDecision` into `afterOutcome`. This is context isolation, not a claim of strict per-conversation isolation. Hosts can call `resetTestTimeAdaptation(contextId)` for a context, or omit the ID to clear every ephemeral overlay at a session/privacy boundary. Automatic host-session teardown wiring remains a follow-up when the runtime exposes a canonical session boundary.

## Safety and resource bounds

- Admission: a fast update is accepted only when `verified01 >= 0.80`; lower-confidence outcomes are counted as rejected.
- Per-context update budget: 64 accepted updates.
- Context capacity: 8 active contexts, with least-recently-used eviction.
- Expiry: 30 minutes wall-clock time or more than 256 runtime ticks without activity.
- Per-component residual bound: `[-0.025, 0.025]`.
- Total overlay L2 norm: at most `0.08`.
- Reset and restore: explicit reset clears overlays; restoring a durable snapshot starts with no fast overlay.
- Snapshot boundary: `snapshot()` contains only the durable bridge state; the context map and temporary residuals are never serialized.
- Candidate export: `exportTestTimeAdaptationCandidate()` returns an isolated copy marked `requires-independent-validation`. There is no automatic promotion or consolidation path.

The current persistent world model still follows its pre-existing training behavior. P27 specifically prevents the new fast residual layer from mutating the durable `residualAdapter`; it does not silently rewrite or remove other established learning policies.

## Diagnostics

`EmbodiedCausalWorldBridge.metrics()` reports context count, active overlay norm, accepted/rejected updates, expirations and LRU evictions. `NeuralExperienceBranch.diagnostics()` exposes these as `testTimeNeuroplasticity`. These are runtime counters, not a claim of improved task performance.

## Verification record

The test-first regression was run against base commit `1e83a011fc677ff20f2348570322bd562181d9ff` before the source fix. It failed as expected: one outcome wrote a persistent residual mass of `0.011310623787825652` into the durable snapshot.

After the implementation, the following local tests passed under Node `v24.20.0` in the isolated ProductOS repository clone:

- `tests/p27-test-time-neuroplasticity.mjs` — snapshot separation, context isolation, verified-only admission, candidate-copy isolation, TTL, reset, restore, 8-context LRU cap, 64-update cap, `NeuralExperienceBranch` wiring and a matched-snapshot check that the temporary overlay changes the next action evaluation.
- `tests/big-pass-2599-2612-online-adaptation.mjs` — existing online world adaptation regression.
- `tests/p28-plasticity.mjs` — existing plasticity substrate regression.
- `tests/big-pass-2522-neural-experience-branch.mjs` — 600-cycle branch regression and snapshot restore.

Typecheck and exact-head GitHub Actions remain separate gates; do not mark this candidate fully verified until they finish. No source merge or release publication is part of PR #924.

## Next integration steps

1. Complete runtime typecheck and the dedicated exact-head Actions workflow.
2. Review the context semantics and decide where the canonical host session-end event should call `resetTestTimeAdaptation()`.
3. Only if independent holdout experiments show a repeatable gain, create a separately reviewed promotion path. Never promote an overlay from its own training context or its own diagnostics.