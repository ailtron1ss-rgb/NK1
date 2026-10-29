# NK1 — World Perception Integration Pass (2026-10-29)

## Scope

This change hardens the perception boundary and event detector on `workpass70-source` without replacing the existing cognitive architecture. It creates `aspect02-world-perception-integration-2026-10-29` from the current source head and ports relevant sensor-integrity and world-context normalization work from the diverged `feature/perception` branch.

## Implemented in this pass

- A world-context normalizer treats missing/malformed numbers as unknown/default rather than coercing `null`/empty strings into zero, and is wired into the live `OrganismRuntime → core.observe()` ingress.
- Facts and events are accepted only as strings, NFKC-normalized, trimmed and bounded; malformed objects do not become `"[object Object]"`.
- Boolean observations require real booleans; strings such as `"false"` are not truthy facts. Separate `valueKnown`, `visibilityKnown`, and `collectionKnown` flags preserve the difference between a negative observation and no observation.
- Evidence kinds are allow-listed, source IDs bounded, numeric confidence populated only when numeric, and objects/facts/events size-bounded.
- The runtime owns and invokes `PerceptionEngine` each cycle; salient perception events are emitted to `RuntimeEvidenceBus` and surfaced as bounded `sensor`/`world` multimodal inputs before `core.observe()`.
- Sensor observations are gated by freshness, reported staleness and sampled-at clock plausibility. Invalid or stale readings do not replace the last known sensor baseline.
- The first fresh sensor sample initializes the baseline and is not falsely reported as a physical change. Sensor availability transitions are separate from movement/proximity/light changes.
- Simultaneous sensor changes are delivered over successive perception cycles, updating only the field associated with the emitted event.
- Sustained battery/thermal pressure is edge-triggered: emit on pressure onset and clearance rather than repeat the same alarm each tick.
- World-change detection compares semantic content (facts, objects, events and contextual metrics), not only list lengths. A fact replacement with unchanged cardinality is detectable; reordering an unordered fact set does not create artificial novelty.
- Added regression tests for same-cardinality world changes, known/unknown observation flags, stale/future telemetry, recurring pressure alarms and canonical runtime ingress wiring.

## Invariants

1. Missing is not zero; unknown is not false; model inference is not direct observation.
2. No stale or implausibly future-dated sensor sample replaces a fresh baseline.
3. One perception call emits at most one event; pending simultaneous sensor changes remain detectable in following cycles.
4. World changes are content-sensitive while fact-set ordering is not treated as novelty.
5. Resource pressure is reported on state transitions instead of at every cycle.
6. Perception remains a signal producer; it does not become a second world-state owner, memory store, planner or action executor.
7. Only salient perception events are injected into the multimodal workspace; quiet-cycle events do not add repetitive workspace noise.

## Run locally

From `runtime/neuro-kurisu` on Node `>=22.12.0`:

```bash
npm run test:world-perception
npm run typecheck
```

The four focused tests are `test:world-context-normalizer-integrity`, `test:perception-engine-signal-integrity`, `test:world-perception-delta-integrity`, and `test:world-perception-runtime-wiring`.

## Validation status

This document records the scope of changes, not a claim that device, camera, browser E2E or a refreshed Release ZIP was validated. Those remain separate release gates and must be tied to the exact tested commit.
