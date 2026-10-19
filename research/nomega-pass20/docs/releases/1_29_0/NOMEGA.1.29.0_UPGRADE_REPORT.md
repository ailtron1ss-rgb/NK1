# NOMEGA 1.29.0-dev Upgrade Report

## Scope
NΩ 1.29 adds bounded open-ended capability evolution, gradual-drift evaluation, and elastic neural substrate control.

## Implemented Components
- `CapabilityEvolverV1`: primitive operator genomes, genome mutation, candidate lineage, novelty, safe baseline, TinyVM/HVM verification, archive persistence for verified candidates.
- `GradualDriftBenchmarkV1`: hidden multi-phase gradual oracle drift with separate current/future evidence and adaptation-lag metrics.
- `ElasticSubstratePolicyV1`: uncertainty/plasticity-aware grow/prune/defer hysteresis with transactional structural mutation and fresh-model restart equivalence.
- `OpenEndedCapabilityEvolutionLoopV1`: integration smoke loop and provenance ledger.
- `OpenEndedEvolutionBenchmarkV1`: 3-seed, 2 transition families, 5 hidden drift phases per transition, structural safety evidence.

## Evidence
Benchmark: `runtime/nomega_1_29_open_ended_multiseed.json`

Observed on 3 seeds:
- static mean hidden holdout score: `0.5733333333333334`
- evolved mean hidden holdout score: `0.58`
- mean final hidden holdout gain: `+0.03333333333333333`
- positive mean-gain gate: `true`
- structural commits: `0` in the conservative rejection benchmark
- structural rollbacks: `9`

A separate unit evidence path demonstrates a successful elastic growth commit with fresh-process-equivalent state verification. This is component evidence, not multi-seed promotion evidence.

## Promotion Status
`research-only`

Reason: the observed positive gain is encouraging but comes from a small controlled benchmark. Promotion requires larger held-out task families, independent evaluator separation, matched-budget multi-seed replication, and regression/OOD stability.

## Test Evidence
- 25/25 focused 1.25–1.29 neural/repair/continual/self-optimization tests passed.
- 7/7 new elastic/evolver tests passed.
- compile and release verification are recorded during packaging.

## Next Gate
NΩ 1.29.1/1.30 should expand gradual drift to multiple concept geometries, add stronger semantic novelty checks, and connect capability discovery to the main neural execution-learning benchmark before any N2/N3/N4 milestone change.
