## [NK1][WorkPass490] Harden endogenous experiment inputs and identity (2026-10-27)

- Clamp uncertainty, prediction-error, novelty and dream-confidence inputs to finite unit values before scoring, so NaN/Infinity cannot create a bogus autonomous experiment or corrupt its information-gain metric.
- Sample creation time once per experiment and allow an injected clock/ID suffix for deterministic replay and collision regressions; preserve the default runtime behavior when no dependencies are injected.
- Normalize dream source identifiers and keep dream-derived associations explicitly unverified, candidate-only hypotheses requiring independent verification.
- Added `tests/workpass490-intrinsic-experiment-boundaries.mjs` for non-finite signals, stable identity/time, and the dream verification boundary.
- Validation status: source/test committed; execution has not yet been run in this environment. Do not treat this as CI-verified or as evidence of autonomous behavior quality.

## [NK1][WorkPass489] Align cycle-order assertion with the runtime-owned snapshot API (2026-10-27)

- The broad source regression moved past the embodiment-order check and exposed another stale WorkPass319 symbol: the test expected `setUnifiedCognitiveCycle`, while the current runtime persists the completed snapshot through `setRuntimeUnifiedCognitiveCycle`.
- Assert the actual runtime-owned Core API inside the cycle-closing block. The assertion still requires the snapshot of the just-evaluated unified cycle to be persisted before completeness evidence is emitted; no cycle gate or production code is bypassed.
