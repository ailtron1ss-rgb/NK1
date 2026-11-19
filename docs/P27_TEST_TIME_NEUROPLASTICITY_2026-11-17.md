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

The Core passes the canonical `TemporalContinuity.currentSessionId` into `NeuralExperienceBranch.beforeDecision`. Host adapters can also provide a stable conversation/thread identifier through `OrganismRuntime.step(text, { conversationId })`. Runtime normalizes this identifier (NFKC + trim, 1–256 chars) and hashes it with SHA-256 before passing it into Core; the raw ID does not enter `OrganismObservation` or the neural branch. The branch never uses a raw host identifier as an adapter key: it maps the combined runtime-session + hashed conversation scope to a random opaque scope held only in an in-memory LRU map (8 session/chat scopes maximum). The final context key is:

`session:<opaque-scope>:world:<activeWorldContext>:slow:<slowContextId>`

This separates runtime sessions even when the causal-world and slow-memory clusters are identical. The raw host session ID is not copied into `NeuralExperienceToken`, `lastExperience`, replay entries or the P27 adapter snapshot. The existing Core `TemporalContinuity` ledger remains the owner of its normal host-session metadata. The ephemeral adapter key is held in a private pending field only until its matching outcome is consumed.

`OrganismRuntime.stop()` calls `OrganismCore.endTemporalSession()` inside the existing serialized final flush. That ends the canonical runtime session and clears all P27 session/chat contexts without introducing an extra checkpoint. Core initialization also clears all P27 overlays before opening a new process session. Restore drops all ephemeral scopes. The branch exposes `resetTestTimeAdaptation(sessionId?)` for one session or all sessions.

When a host supplies `conversationId`, separate conversations inside one long-lived runtime session receive separate opaque scopes even when world and slow-memory contexts match. When omitted, the documented runtime-session scope is used as a compatibility fallback. The host must consistently pass the same conversation ID for turns in one chat and a different ID for each independent chat; the runtime does not infer it from message text.

The same private opaque context key is held in a branch-private pending field from `beforeDecision` to `afterOutcome` without being stored in the durable experience token. Outcomes are accepted by the fast layer only when the pending decision matches the same context, tick and explicitly committed action. Both the spine-only `NeuralExperienceBranch.commitAction()` path and the full `OrganismCore` outcome path bind the selected action before credit assignment. A missing action binding disables fast adaptation; an action mismatch fails before this branch's other outcome learners run. Duplicate, out-of-order, stale and orphan outcomes are rejected from fast adaptation and counted.

## Safety and resource bounds

- Admission: a fast update is accepted only when `verified01 >= 0.80`; lower-confidence outcomes are counted as rejected.
- Per-context update budget: 64 accepted updates.
- Context capacity: 8 active contexts, with least-recently-used eviction.
- Expiry: 30 minutes wall-clock time or more than 256 runtime ticks without activity.
- Per-component residual bound: `[-0.025, 0.025]`.
- Total overlay L2 norm: at most `0.08`.
- Stability gate: a four-step backtracking search (`1.0 / 0.5 / 0.25 / 0.125`) evaluates candidate offsets against the same pre-update one-step latent prediction; an update is accepted only when finite prediction error strictly decreases. A failed search restores the exact prior offsets and increments a no-gain rejection counter.
- Reversible drift: accepted offsets relax toward the durable baseline by `0.992^tickDelta` and an additional 10-minute wall-clock half-life. The original 30-minute/256-tick idle expiry remains a hard upper bound.
- Input boundary: decision/outcome ticks, actions, scalar metrics, complete action-utility records and 1–64 element feature vectors are validated before pending-outcome consumption or state mutation. Sparse, accessor-backed and non-finite feature arrays fail closed.
- Action provenance: an outcome must match an explicitly committed action for the same context and tick. Missing action bindings block the fast overlay; a different action is rejected before branch-level outcome learning. Outcomes never inherit the last globally active adapter context.
- Reset and restore: explicit reset clears one session or every overlay; Core process start, restore and runtime stop clear ephemeral contexts.
- Snapshot boundary: `snapshot()` contains only durable bridge/neural state; opaque session scopes, pending outcome keys and temporary residuals are never serialized.
- Candidate export: `exportTestTimeAdaptationCandidate()` returns an isolated copy marked `requires-independent-validation`. There is no automatic promotion or consolidation path.

The current persistent world model still follows its pre-existing training behavior. P27 specifically prevents the new fast residual layer from mutating the durable `residualAdapter`; it does not silently rewrite or remove other established learning policies.

## Diagnostics

`EmbodiedCausalWorldBridge.metrics()` reports context count, active overlay norm, accepted/rejected updates, expirations, LRU evictions, decay events, backtracked updates, no-gain rejections, unmatched/action-mismatch outcomes and before/after prediction-error values for the most recent fast-adaptation attempt. `NeuralExperienceBranch.diagnostics()` exposes these as `testTimeNeuroplasticity` together with the number of opaque session scopes, without exposing raw IDs or scope keys. These are runtime counters, not a claim of improved task performance.

## Verification record

The test-first regression was run against base commit `1e83a011fc677ff20f2348570322bd562181d9ff` before the source fix. It failed as expected: one outcome wrote a persistent residual mass of `0.011310623787825652` into the durable snapshot.

Historical verification note: an earlier revision passed the following local checks under Node `v24.20.0` in an isolated clone. These results predate the newer predictive-gain, committed-action and host-conversation integration changes below; they are not evidence for current PR HEAD:

- `tests/p27-test-time-neuroplasticity.mjs` — historical snapshot separation, session isolation, verified-only admission, duplicate/orphan/out-of-order outcome rejection, candidate-copy isolation, TTL, reset, restore, 8-context LRU cap, 64-update cap, legacy residual compatibility and matched-snapshot decision evaluation.
- `tests/p27-neuroplasticity-session-lifecycle.mjs` — at that earlier revision, real `OrganismRuntime` session start/stop and ephemeral scope cleanup. Current host conversation-ID isolation assertions were added afterward and require current-head CI.
- `tests/big-pass-2599-2612-online-adaptation.mjs` — existing online world adaptation regression.
- `tests/p28-plasticity.mjs` — existing plasticity substrate regression.
- `tests/big-pass-2522-neural-experience-branch.mjs` — 600-cycle branch regression and snapshot restore.

The latest exact-head Actions run is the authoritative gate for the committed-action and conversation-scope changes; it must complete successfully before these changes are called verified. Earlier source-head run #14 completed its typecheck and all P27 workflow steps, but was canceled by PR concurrency after a newer branch update and is not a green exact-head result. Independent paired-seed/holdout uplift remains unproven. No source merge or release publication is part of PR #924.

## Next integration steps

1. Wire the host chat/voice ingress to provide a stable `conversationId` on every `OrganismRuntime.step()` call; calls that omit it use runtime-session fallback.
2. Run independent holdout/paired-seed experiments to measure whether fast adaptation improves decisions beyond the persistent baseline.
3. Only if holdout evidence shows repeatable gain, create a separately reviewed promotion path. Never promote an overlay from its own training context or diagnostics.