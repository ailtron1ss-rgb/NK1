# NOMEGA 1.34.0-dev — Pass18 validation

## Implemented

Pass18 makes the canonical V13 neural program synthesizer a real, untrusted candidate source in `ExecutableSpineV2`, removes the legacy `NeuralInventTrainer` from the canonical expert path, adds checkpoint/state-digest lineage, and persists execution-cycle evidence in the hash-chained causal evidence ledger.

Neural training targets are now execution-gated: template/augmentation candidates are checked through the existing TinyVM/HVM evaluator before they can become supervised targets. Baseline and post-training measurements are matched across an explicit multi-seed grid. These measurements are descriptive evidence only; they do not imply causal uplift or promotion.

## Verification

- `compileall core tests tools`: PASS
- governance check: PASS, 0 failures; historical legacy warnings remain non-blocking
- doctor: PASS
- pytest collection: 468 tests collected, 0 collection errors
- Pass18/neural/canonical regression set: 21 tests passed
- broader architecture/execution/neural regression set: 42 tests passed
- canonical neural training API smoke: PASS
- checkpoint round-trip/state digest: PASS
- neural candidate enters executable portfolio: PASS
- hash-chained execution evidence integrity: PASS

## Measured limitation

The matched multi-seed neural probe on `sum3/xor3/mul2` produced zero holdout/OOD/verified uplift under the tested training budget. The current V13 neural decoder therefore remains a research-only proposer. Deterministic template execution continues to provide verified results. This negative result is recorded rather than converted into a success claim.

## Architecture snapshot

- canonical package modules: 308
- registry modules scanned: 307
- canonical modules in registry: 42
- research modules: 24
- legacy/versioned registry modules: 160
- consolidation candidates: 119
- import cycles: 0
- config fields: 132
- statically unreferenced config estimate: 58

## Governance

Promotion remains `accept_only_on_explicit_evidence`. The neural bridge does not self-authorize correctness; all runtime candidates remain subject to independent execution and verification.
