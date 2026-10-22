# WorkPass288 — outcome provenance and reduced-resolution learning boundary (2026-10-22)

## Finding

Static inspection of `runtime/neuro-kurisu/src/organism/core/OperationalMicroCycleRuntime.ts` shows the reduced-resolution path currently derives:

```ts
const microReward = clamp(Number(observation.reward ?? (observation.success ?? state.lastActionSuccess ?? 0.5)));
const microVerified = Boolean(observation.worldEvent || observation.success !== undefined || observation.reward !== undefined);
```

That boolean is forwarded as `verified01` to `developmentalNeural.neuralExperienceBranch.microTick(...)`. Therefore, a caller-supplied `success` or `reward` scalar is treated as verification in this path, despite the absence of an explicit verifier result in `OrganismObservation`. This is a concrete provenance-boundary weakness in the reduced-resolution cycle. It does not by itself prove that untrusted external input reaches this path in production; the live caller chain still needs tracing.

## Required correction

Do not equate an outcome claim with independent outcome evidence. Preserve three distinct values:
1. **Claimed outcome** — reward/success supplied by an observation or inferred from prior state.
2. **Observed transition** — a before/after world transition with provenance, timestamp and action/prediction correlation.
3. **Verified outcome** — a result accepted by the existing canonical reality/postcondition verifier and attributable to the action/prediction ticket.

The micro-cycle may continue updating homeostasis, temporal continuity, identity and resource state when outcome evidence is missing. In that case it must pass `verified01: 0` to learning, and must not convert fallback reward `0.5` or previous `lastActionSuccess` into fresh outcome credit. Only the existing canonical verifier should authorize positive learning credit; do not introduce a second verifier or duplicate outcome ledger.

## Implementation sequence

- **WP288-A:** trace all producers of `OrganismObservation.success/reward/worldEvent`, plus the full-cycle postcondition/reality-verification result and its correlation IDs.
- **WP288-B:** introduce a typed, provenance-bearing verification result from the existing canonical owner, if one does not already exist. Do not trust a caller-provided boolean without checking source and action correlation.
- **WP288-C:** pass the same verification evidence into both full-cycle and micro-cycle learning paths. The micro-cycle remains capability-limited; no direct side-effect authority is added.
- **WP288-D:** add behavioral tests: scalar reward alone is unverified; stale prior success is not fresh evidence; mismatched action/tick evidence is rejected; valid canonical verification can grant credit; missing evidence still permits continuity/homeostasis updates.
- **WP288-E:** check restart/persistence and migration behavior so verification provenance cannot be silently upgraded during restore.

## Parallel workstreams

| Stream | Goal | Exit criterion |
|---|---|---|
| Reality boundary | One canonical verifier owns accepted outcomes | Every credited outcome links to verifier evidence and action/tick |
| Learning | Claim and evidence are separate inputs | Unverified input cannot update verified-credit path |
| Micro-cycle | Preserve lightweight continuity without fabricated reward | Missing evidence gives zero verified credit but still advances lifecycle |
| Memory | Persist evidence provenance | Replay retains source, action correlation and verification status |
| Observability | Make rejected credit explainable | JSONL trace reports missing/stale/mismatched provenance reason |

## Status and limits

This is a source-grounded finding and implementation contract, not a claim that the fix has already been implemented. No runtime file was changed in this pass because the correct existing verifier result and action-correlation contract must be traced before changing interfaces. Tests were not executed. No dependency was added.

## Next concrete source trace

Trace the active full-cycle result around `OutcomeVerificationService`, `P51GroundedCausalWorkspace`, and `OrganismCore`; find where accepted evidence is persisted and whether the micro-cycle can receive that same evidence without invoking a duplicate verifier.
