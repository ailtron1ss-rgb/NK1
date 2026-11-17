# Implementation plan — Cognitive-to-Neural Bridge

Spec: `docs/superpowers/specs/2026-11-17-cognitive-to-neural-bridge-design.md`
Base: current `workpass70-source` HEAD at implementation start.
Branch: `aspect/cognitive-to-neural-bridge-20261117`

## Task 1 — deterministic bounded projector

- Add `src/organism/cognition/CognitiveToNeuralBridge.ts`.
- Export the action/mode types, the 19-feature input projection, versioned profile, and request-application helper.
- Normalize missing/non-finite values, validate tick, bound steering intent to 0.15, and map modes to fixed temperature/token budgets and adapter hints.
- Test real projection output, exact vector ordering, immutability, malformed input, caps and request pass-through.

Expected focused command:
`node --experimental-strip-types tests/cognitive-to-neural-bridge.mjs`

## Task 2 — LanguageRequest contract

- Add optional typed `cognitiveControl` to `LanguageRequest`.
- Keep the control contract type-only to avoid runtime import cycles.
- Typecheck the runtime and test request adaptation preserves system/user/signal/context fields while applying bounded sampling parameters.

## Task 3 — OrganismRuntime wiring

- Add the default-enabled `RuntimeConfig.cognitiveToNeuralBridge.enabled` switch.
- Create one bridge instance per runtime and derive input from the existing cycle state, selected goal/action and existing cognitive-budget snapshot.
- Apply the same helper before both cognitive-proposal and regular/autonomous `LanguageInvoker` calls.
- Publish telemetry that explicitly marks adapter selection, activation steering and residual execution as not applied.
- Add a wiring regression for both call paths and the emergency bypass.

## Task 4 — exact-head verification and handover

- Run focused tests and runtime typecheck under Node 24.
- Review the final branch diff and preserve the base/release boundary.
- Open/update a Draft PR into `workpass70-source`; do not merge or claim a Release ZIP update.
- Record exact branch/commit/PR/Actions status and clearly list deferred direct-steering work.
