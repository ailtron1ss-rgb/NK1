# NK1 Perception Pass — canonical world-model boundary (2026-10-24)

## Why this change exists

The organism already exposes a compact `CanonicalWorldSnap` and tracks prediction error, latent confidence, entity counts, conflicts and evidence coverage. Those summary values are useful for dashboards, but they are not themselves a safe evidence-ingestion boundary. Perception must preserve the difference between a raw observation, a supported claim, an unresolved contradiction and a stale signal.

## Implemented in this pass

- `app/src/organism/perception.ts` defines a typed, modality-aware observation envelope.
- Validation rejects malformed IDs, timestamps, scalar values and duplicate/invalid parent lineage rather than silently laundering provenance.
- Confidence is clamped to [0, 1]; future-clock anomalies fail closed; old observations are marked stale.
- Freshness decays exponentially using a configurable half-life. Stale and invalid observations are excluded from the current working world model.
- Claim fusion is deterministic and idempotent for repeated event IDs. Contradictory values remain visible as conflicts; the system does not average incompatible claims into a false consensus.
- Claims retain supporting and conflicting observation IDs so downstream memory, planning, metacognition and observability can trace decisions to evidence.
- `app/scripts/perception.test.mjs` covers normalization, lineage rejection, staleness, duplicate delivery, contradiction reporting and predicate separation.

## Canonical data flow

```text
raw sensor / text / tool / memory event
    -> normalize + validate provenance and time
    -> freshness-weighted observation
    -> group by (subject, predicate)
    -> supported / uncertain / conflicted world claim
    -> downstream appraisal, prediction, planning and memory
```

The module intentionally does not call an LLM, access hardware, or write beliefs/memories itself. It is a pure deterministic boundary that can be integrated into the canonical cycle without creating a second cognition loop.

## Integration contract

1. Adapters must assign stable event IDs and truthful source/modality metadata.
2. Observation time and receipt time must remain distinct; adapters must not backdate evidence to make it look fresh.
3. A claim marked `conflicted` must raise uncertainty and may trigger `verify`; it must not be promoted as a verified fact.
4. `supported` means internally corroborated under the current policy, not metaphysical certainty or external truth.
5. The caller owns persistence, access control, privacy filtering and the decision to ask for additional observations.
6. Any future visual/audio sensor adapter must preserve source lineage and explicit units; numeric values with different units are not fused together.

## Known boundary / not yet completed

- The pure perception module is added on `feature/perception`; it is not yet wired into the runtime's canonical Perceive → Appraise → Plan cycle.
- No real camera, microphone, browser, filesystem or ambient-sensor adapter is added by this change.
- Confidence calibration and sensor reliability are currently policy-level inputs, not learned estimates.
- No CI or local test run was available through the GitHub file-edit operation. The regression file is committed but must be run on the branch before merge.
- The existing `CanonicalWorldSnap` and reality-evidence ledger remain their existing owners; this pass does not create a parallel persisted ledger.

## Acceptance gates for the next integration pass

- Unit tests pass under the repository's Node/TypeScript toolchain.
- Runtime adapters produce stable event IDs and correct observed/received timestamps.
- Contradiction raises uncertainty and routes to verification rather than silent overwrite.
- Evidence lineage survives persistence/restore and is queryable from a decision trace.
- Replay tests show stale evidence cannot dominate newer observations.
- An end-to-end test proves the canonical cycle uses these claims and records which observations affected the selected action.
