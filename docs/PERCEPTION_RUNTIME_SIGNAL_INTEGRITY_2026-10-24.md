# Perception runtime integrity pass — 2026-10-24

**Scope:** canonical runtime perception boundary, not the UI shell.  
**Branch:** `feature/perception`  
**Status:** IMPLEMENTED; runtime tests and exact-head CI are NOT VERIFIED.

## Defects fixed

### 1. Simultaneous sensor signals were lost

`PerceptionEngine.perceive()` returns one event per cycle, but each sensor-change branch replaced the entire baseline. If motion, proximity, ambient light and network state changed in the same telemetry sample, the first branch updated the baseline for all fields and silently absorbed the other changes.

Each branch now advances only the field it handled. Remaining changes stay detectable on following perception cycles, retaining the existing single-event API and event ordering.

### 2. Stale telemetry could be presented as a current event

The sensor branch now requires a finite sensory-freshness score of at least 0.2 and telemetry staleness no greater than 120 seconds. Missing or stale freshness fails closed for device-telemetry perception. Text and world-context observations can still be handled independently.

### 3. Malformed world context could become false evidence

`normalizeWorldContext()` used JavaScript coercions that can change meaning: `Number(null)` becomes zero, and `Boolean("false")` becomes true. It now:
- uses numeric defaults for null, blank, boolean and non-finite numeric input;
- accepts object visibility/collection flags only when the values are literal booleans;
- normalizes non-empty strings, rejecting blank identity/location fields;
- filters facts/events to real strings, trims them and caps individual lengths;
- restricts evidence-kind labels to the declared set and discards malformed source IDs.

These rules preserve unknowns instead of silently inventing observed states.

## Code and regression coverage

- `src/organism/cognition/PerceptionEngine.ts`
- `src/organism/core/WorldContextNormalizer.ts`
- `tests/perception-engine-signal-integrity.mjs`
- `tests/world-context-normalizer-integrity.mjs`
- `package.json`: `test:perception-engine-integrity`, `test:world-context-integrity`

The regressions cover multi-sensor change preservation, stale telemetry rejection, null/default semantics, malformed truthy values, string-list filtering and valid-input preservation.

## Architecture correction

The existing runtime already owns perception through `PerceptionEngine`, `WorldContextNormalizer`, modality-specific perception modules and the canonical cognitive cycle. A parallel perception module under `app/src/organism` would violate the repository's one-owner rule. The earlier disconnected UI-shell prototype is therefore retired; this pass keeps the behavior change in the canonical runtime instead.

## Validation boundary

- **IMPLEMENTED:** code changes, regression tests and npm script registration are committed.
- **NOT VERIFIED:** tests, TypeScript typecheck, integration tests and exact-head GitHub Actions. The connected GitHub file-edit interface does not execute Node locally; a local checkout attempt failed because the environment could not resolve `github.com`.
- No real camera, microphone or environmental sensor integration is claimed by this pass.
- No production readiness or measured intelligence/grounding improvement is claimed.

## Next acceptance gates

1. Run `npm run test:perception-engine-integrity` and `npm run test:world-context-integrity` in `runtime/neuro-kurisu`.
2. Run runtime typecheck and existing active-perception / world-context tests on the exact branch head.
3. Verify that the canonical cycle consumes the normalized world context and that source evidence, freshness and conflicts survive its decision trace.
4. Keep real sensor adapters separate, with sample timestamps and source provenance retained end to end.
