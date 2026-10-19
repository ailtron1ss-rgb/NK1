# P2587–P2598 — результаты экспериментов

## TransferableEmbodiedSkillSystem

- 1 600 source transitions + 280 shifted holdout evaluations.
- Learned skills: 7.
- Holdout success: 280/280 in the current synthetic benchmark.
- Transfer01: ~0.0969 after holdout and recovery stress.
- Option coverage: ~1.000 in the standalone curriculum.
- Intervention probes: 1 600.
- Recovery triggers: 50.

Это синтетический benchmark архитектурного слоя, а не доказательство general intelligence.

## NeuralExperienceBranch integration

- 960 integrated cycles.
- 48 learned procedural skills under a highly varying synthetic stream.
- Transfer01: ~0.569.
- Option coverage: ~0.0487 (новый слабый участок: при сильно меняющемся контексте кластеризация навыков пока фрагментирует память).
- Intervention probes: 158.
- Recovery triggers: 25.
- Persistence round-trip passed.

## Multi-horizon world model

- H1/H2/H4/H8/H16 telemetry active.
- H8 samples: 160.
- H16 samples: 160.
- Final horizon errors: ~0.0325, 0.0346, 0.0365, 0.0399, 0.0468.
- Horizon confidence remained ~0.953–0.967 in the synthetic benchmark.

## B2521 exact-key bottleneck

The current 10-step runtime test improved its `modelCoverage01` from the prior ~0.0037 regime to ~0.419 after exact→prototype→global fallback. In the larger synthetic shifted-context benchmark it reached ~0.856. `prototypeCoverage01` reached 1.0 and `transitionsTransferred` reached 252.

The improvement is architectural: state similarity and action priors can now transfer learned dynamics instead of returning an empty model for every unseen key.

## Performance

Transferable skill layer benchmark: 12 000 cycles in ~188 ms in the current Node environment (~63.8k cycles/s). This is module-level performance, not a direct Android measurement.
