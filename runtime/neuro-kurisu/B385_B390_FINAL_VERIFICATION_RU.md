# Neuro-Kurisu 35.6.34 — B385–B390 Final Verification / 2026-09-16

## Release scope

B385–B390 introduces a single developmental fabric integrated after canonical B365 and before final candidate arbitration. It connects autobiographical retrieval, dynamic self-model, value/goal coupling, predictive adaptation and motivational/homeostatic signals without creating a second policy owner.

## Verified results

### B382 repair
- contextual causal knockout: **0.446227** before final later B384 field integration; current regression run remains PASS with the integrated stack;
- restart delta: 0;
- OFF context baseline divergence: <0.001.

### B383 regression
- contextual separation: **0.459529**;
- history knockout: **0.45999995**;
- restart delta: 0;
- unverified learning remains blocked;
- personality adaptations: 218 in the canonical fixture.

### B384 regression
- 280 verified episodes;
- 2240 value revisions;
- 272 goal-value revisions;
- context/value separation: **0.467844**;
- causal delta: **0.0161921**;
- autobiographical history knockout: **0.0161921**;
- restart exact;
- revision after later conflict sequence: **0.0473650**.

### B385–B390
- 24 verified developmental episodes in integration fixture;
- 312 retrieval operations;
- retrieval strength: **0.7431605**;
- 192 value revisions;
- 24 prediction updates;
- long-horizon developmental state: **0.5294296**;
- full multi-component knockout causal delta: **1.0**;
- retrieval knockout delta: **0.656697**;
- action-bias knockout delta: **0.786939**;
- restart persistence: PASS.

## Performance

B384 regression performance: 1400 cycles, p50 1.046 ms, p95 6.351 ms, p99 16.908 ms, max 298.482 ms, heap ≈23.68 MiB in the current verification environment.

The B385–B390 layer is state-light and stores at most 192 episodes plus 24 goals, intended to remain compatible with the medium-phone/Termux constraint.

## Architecture

B365 remains the canonical neural decision owner. B385–B390 is a developmental bridge, not a competing policy network.

The causal path is now:

`verified outcome → autobiographical retrieval → self update → value/goal adaptation → prediction correction → motivational field → action bias → existing constitutional arbitration → outcome → persistent developmental state`

## Limitations

These tests prove software-level causal influence, persistence, evidence gating and integrated developmental behavior. They do not prove phenomenal consciousness, biological equivalence to a human brain, or human-level personhood.

## Source-of-truth

Current release: **35.6.34 / B390 / schema 138**.
