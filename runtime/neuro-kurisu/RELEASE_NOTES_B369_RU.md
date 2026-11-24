# Release B369 — Neural Episodic Replay / Consolidation

## Summary
B369 extends B365 from online-only plasticity into verified experience replay and neural consolidation.

## Implementation
- Persistent B365 replay buffer for learned outcomes.
- Priority scoring from advantage, novelty, verification and forecast error.
- Replay updates to action and forecast readouts.
- Bounded deterministic replay of active eligible synapses.
- Forecast confidence/utility consolidation from replayed episodes.
- Replay metrics persisted in B365 state.
- Runtime sleep/periodic consolidation now explicitly invokes B365 replay and flushes the state to the persistence boundary.

## Evidence
- B369 neural replay consolidation: PASS.
- Replay experiences: 32.
- Replay updates: 2529 in isolated causal battery.
- Replay impact: 0.275399.
- Later-policy L1 vs no-replay control: 0.010794.
- Runtime replay persistence after restart: PASS.
- B365/B366/B367/B368 regression: PASS.
- Static source and release audits: PASS.

## Performance
Existing B368 host mobile-profile benchmark remains PASS:
p50 594.52 ms, p95 628.181 ms, peak heap 111.65 MiB.
B369 uses a bounded synapse replay budget to keep consolidation from scaling over every synapse for every replayed episode.

## Limitations
Physical Android/Termux remains unverified in this environment.
Phenomenal consciousness remains UNKNOWN.

## Release principle
B365 remains the canonical neural substrate. B369 does not create a parallel decorative neural module.
