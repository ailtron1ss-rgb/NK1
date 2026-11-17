# Implementation plan — Cognitive-to-Neural Bridge

Spec: `docs/superpowers/specs/2026-11-17-cognitive-to-neural-bridge-design.md`
Base: current `workpass70-source` HEAD at implementation start.
Branch: `aspect/cognitive-to-neural-bridge-20261117`

## Task 1 — deterministic bounded projector

- Add `src/organism/cognition/CognitiveToNeuralBridge.ts`.
- Export the action/mode types, 43-feature B365-aware projection, versioned profile, provider request adapter and explicit emergency-bypass helper.
- Normalize organism inputs; accept only complete B365 snapshots with positive integer state version/tick and all 23 normalized signals; reject partial, future and stale (>8 tick) snapshots as a whole.
- Expose feature keys and exact B365 version/tick provenance, use an explicit neutral unavailable-state encoding, bound steering intent to 0.15, and scale temperature/token budgets using mode, reserve and allostatic preservation.
- Validate one-hot/action/mode consistency, adapter hint mapping, snapshot version/age/freshness arithmetic and all provider control bounds again at the llama.cpp hand-off.
- Test B365 diagnostics projection, exact 43-channel order, freshness rejection, immutability, malformed input, caps and request pass-through.

Expected focused command:
`node --experimental-strip-types tests/cognitive-to-neural-bridge.mjs`

## Task 2 — LanguageRequest contract

- Add optional typed `cognitiveControl` to `LanguageRequest` and a typed provider-delivery receipt on `LanguageResponse`.
- Keep the control contract type-only to avoid runtime import cycles.
- Typecheck the runtime and test request adaptation preserves system/user/signal/context fields while configuring bounded sampling parameters.

## Task 3 — OrganismRuntime wiring

- Add the default-enabled `RuntimeConfig.cognitiveToNeuralBridge.enabled` switch.
- Create one bridge instance per runtime and derive input from the existing cycle state, selected goal/action and existing cognitive-budget snapshot.
- Apply the same helper before both cognitive-proposal and regular/autonomous `LanguageInvoker` calls.
- Publish telemetry that explicitly marks adapter selection, activation steering and residual execution as not applied.
- Reuse the existing per-cycle B365 diagnostics snapshot (no second neural run), apply the bridge to both cognitive-proposal and response/autonomous call paths, expose runtime counters, and verify the real LanguageInvoker boundary for enabled/bypassed modes.
- Publish an authenticated read-only HTTP diagnostics endpoint; test authorization, 43-channel visibility, snapshot provenance, successful llama.cpp kwargs hand-off and explicit unverified template consumption.

## Task 4 — exact-head verification and handover

- Run the B365 snapshot, 43-channel projector, real OrganismRuntime/LanguageInvoker integration, local llama.cpp template opt-in and fake-server HTTP end-to-end tests plus runtime typecheck under Node 24.
- Review the final branch diff and preserve the base/release boundary.
- Open/update a Draft PR into `workpass70-source`; do not merge or claim a Release ZIP update.
- Record exact branch/commit/PR/Actions status and clearly list deferred direct-steering work.
