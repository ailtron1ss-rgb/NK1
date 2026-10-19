# P10 ChangeLog

## Версия

Application: 4.4.0
Organism Core: 10.0.0-p10-world-model
State Schema: 12

## Добавлено

- World Model 2.0 latent state.
- State-conditioned probabilistic transition hypotheses.
- Transition delta/variance estimates.
- Causal evidence accumulation.
- Prediction tickets and outcome calibration.
- Confidence recalibration by historical calibration buckets.
- Multi-step future rollout integration.
- Planner coupling to learned world predictions.
- P10 contract, migration, planner integration and research tests.
- Research result: `research/results/p10-world-model-lab.json`.
- MemoryStateStore/BoundedOperationalJournal injection for fast deterministic CI/research.

## Исправлено

- P9 legacy `WorldModel2.observe()` no longer pollutes the learning model during decision formation.
- P9 states now normalize all missing P10 transition fields during migration.
- Planner receives concrete world context for world-model prediction.
- Calibration now measures actual prediction-vs-outcome accuracy instead of surprise proxy.
- Research/runtime persistence are separated by injectable storage contracts.

## Проверки

- P0–P9 regression: PASS.
- P10 contract/migration/world-model/planner: PASS.
- UI/server/operational/architecture/integrity/hygiene: PASS.
- P10 research lab: PASS.
