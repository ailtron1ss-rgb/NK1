# AURORA Predictive Kernel — Design

**Date:** 2026-11-26  
**Project:** NeuroCore / NK1  
**Owner boundary:** `WorldSubsystemRuntime`

## Intent

Add a compact, explainable predictive executive kernel that turns the existing world-model ensemble forecast and canonical grounded-world evidence into a bounded recommendation: act, observe, ask, wait, or abstain. Its purpose is to reduce decisions made on stale, conflicting, weakly grounded, or over-budget information, while preserving the current world, memory, prediction, and action owners.

## Existing architecture

`WorldSubsystemRuntime` already owns `P27NeuralWorldFoundation`, `WorldModelEnsembleController`, `UnifiedLatentWorldState`, `GroundedWorldState`, and the integrated prediction path. The existing owners remain authoritative. AURORA consumes their read-only projections and exposes a decision receipt; it does not maintain a second world database, latent model, memory store, neural-weight store, or action executor.

## Goals

- Use evidence class, freshness, grounding confidence, conflict, unresolved state, ensemble disagreement, and prediction error to estimate epistemic pressure.
- Apply a bounded risk penalty and a bounded verification bias to an existing forecast.
- Select a supplied observation/question candidate only when its information value fits attention, energy, cost, privacy, latency, and interruption budgets.
- Recommend a short or long planning horizon according to uncertainty.
- Fail closed on malformed forecasts and sanitize persisted telemetry.
- Integrate with `WorldSubsystemRuntime.predictForDecision`, snapshot, and restore.

## Non-goals and anti-goals

- No training of a new large neural network or claim that model weights were trained.
- No new canonical world, memory, goal, or action owner.
- No direct sensor call, user message, tool invocation, external side effect, or action dispatch from AURORA.
- No upgrade of model outputs or simulation into observed facts.
- No autonomous weight promotion or mutation of the running model.
- No changes to `main` or published Release artifacts in this change.

## Approaches considered

1. **Standalone new neural model:** rejected for this pass; it would duplicate existing P27 and world-model machinery, require training data and independent holdouts, and add mobile resource cost.
2. **AURORA as an executive kernel over existing model outputs:** selected. It provides immediate cross-system value with a small pure TypeScript boundary, measurable policy behavior, and no competing state owner.
3. **Only a documentation/adapter facade:** rejected because it would not change the decision-time forecast or expose a measurable recommendation.

## Runtime contract

- Input: one forecast (`action`, utility, confidence, uncertainty), one canonical world evidence projection, optional observation candidates, and resource/privacy budgets.
- Output: directive, reason, attention focus, world revision, epistemic pressure, effective confidence, bounded risk/verification adjustments, adjusted utility, recommended horizon, and selected observation ID.
- Persistence: bounded aggregate counters and recent directive history only, nested under `advanced.auroraKernel` in the existing runtime checkpoint.
- Execution: downstream owners decide whether/how to honor a directive. AURORA never executes the directive itself.

## Evidence policy

Observed evidence contributes to grounded confidence only when it is already represented in the canonical grounded-world snapshot with observed modality provenance and a source identity. Model-output/derived evidence remains inferred. Conflict and unresolved rows raise epistemic pressure. Empty or stale world state is unknown, not reassuring.

## Acceptance

- Unit tests cover budgeted sensing, clarification, wait/abstain, grounded action, bounded adjustment, invalid inputs, and restore sanitization.
- Runtime integration tests prove canonical prediction annotation and persistence round-trip.
- The focused tests and runtime syntax validation pass on the exact pull-request head. Semantic `tsc` validation remains unavailable in the current CI image because the TypeScript compiler is not installed.
- No execution authority is added; all external side effects remain behind the existing canonical action gateway.
