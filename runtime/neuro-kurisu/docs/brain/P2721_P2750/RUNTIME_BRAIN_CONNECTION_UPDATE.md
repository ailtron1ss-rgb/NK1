# P2721-P2750 Runtime Brain Connection Update

## Goal

Connect brain-fusion structures with organism runtime without pretending that isolated modules already form a complete brain.

## Added

- BrainRuntimeBridge
- event normalization
- prediction-error based priority calculation
- future integration point for memory, identity and world model loops

## Verification rule

A feature is considered real only after:

1. runtime calls it;
2. state changes are observable;
3. tests verify behaviour;
4. regression checks pass.

## Next phase

- connect to OrganismCore lifecycle;
- add causal update signals;
- connect consolidation scheduling;
- run behavioural ablation tests.
