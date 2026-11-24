# BIG PASS 39 — постоянный master checklist

Дата: 2026-09-05
Релиз: 34.9.0
State schema: 87

## A. Новые реальные изменения этого прохода

- [x] Cognitive spine использует budget/resource context.
- [x] P53/P55 тяжёлые developmental операции переведены на spine-gating.
- [x] Prospective self-prediction остаётся cross-cycle, а не same-cycle.
- [x] Model Olympics оценивает P10/P26/P27/shadow.
- [x] Model Olympics теперь реально калибрует будущие прогнозы.
- [x] Reality boundary больше не считает simulator external truth.
- [x] Project milestones получили evidence classes: internal/external/replicated.
- [x] Replicated evidence имеет отдельный счётчик.
- [x] Project tool bridge получил явный projectAllowed allowlist.
- [x] Destructive project tools блокируются bounded executor.
- [x] Active project API добавлен.
- [x] Project-tool execution event добавлен в event sourcing.
- [x] API duplicate route устранён.
- [x] release:audit дополнен alias-ом audit:release.
- [x] release manifest синхронизирован до 34.9.0/schema 87.
- [x] current documentation source-truth синхронизирован.
- [x] первый audit baseline сохранён в отдельном документе.

## B. Сохранённые и перепроверенные пункты из предыдущих BIG PASS

- [x] P40 health/circuit breaker.
- [x] P40 legacy-safe restore.
- [x] adaptive sensor schedule реально подключён к runtime.
- [x] Runtime Evidence Bus.
- [x] process CPU telemetry.
- [x] telemetry stale age.
- [x] screen override.
- [x] P41 coarse spectral/spatial analysis.
- [x] Termux API install dependency.
- [x] Prediction Ledger improvement metric.
- [x] P65 prediction semantics.
- [x] P65 belief lifecycle.
- [x] Evidence lineage.
- [x] Evidence persistence.
- [x] shared cognitive budget execution.
- [x] CognitiveSubsystemFacade.
- [x] balanced directory fsync.
- [x] ExternalEvidenceTrust.
- [x] SelfPredictionBenchmark.
- [x] project milestones/evidence wiring.
- [x] PredictionDebt.
- [x] CognitiveQuorum.
- [x] ShadowOrganism.
- [x] IdentityCausalityGraph.
- [x] LongHorizonPrediction 1/4/12.
- [x] AutonomousProjectExecutor.
- [x] project→skill promotion bridge.

## C. Первичный аудит — обязательная обратная сверка

- [x] Runtime stabilization: core code paths.
- [~] OrganismCore decomposition.
- [x] Evidence Bus.
- [x] Prediction Ledger.
- [~] General true-learning substrate.
- [~] Full autonomous goal ecology.
- [~] Real external project execution.
- [~] Full external scientific loop.
- [x] Simulator/external boundary.
- [x] Mobile resource budget.
- [x] Model ecology health/failure loop.
- [ ] Native Android host/lifecycle.
- [~] Real semantic perception backend.
- [~] Social cognition.
- [~] Predictive self-model.
- [~] Full autobiographical identity grounding.
- [~] Independent shadow organism.
- [x] Model competition loop.
- [~] Development/self-modification.
- [~] Empirical consciousness evaluation.

Legend: `[x]` substantially implemented, `[~]` partial, `[ ]` not implemented.

## D. Regression evidence for BIG PASS 39

- [x] typecheck
- [x] BIG_PASS_39_SPINE_UNITS
- [x] BIG_PASS_39_REALITY_BOUNDARY
- [x] BIG_PASS_39_PROJECT_TOOL_BRIDGE
- [x] P67_PROJECT_EVIDENCE
- [x] P40 model ecology
- [x] P41 truthfulness
- [x] P42–P44 suite
- [x] P54
- [x] P57
- [x] P74–P77 integration
- [x] P80–P82 runtime E2E
- [x] restart persistence
- [x] replay
- [x] concurrency
- [x] memory dedup
- [x] portable subject
- [x] API security
- [x] server smoke
- [x] server security smoke
- [x] checkpoint hot path
- [x] source truth
- [x] architecture
- [x] forensics
- [x] hygiene
- [x] integrity
- [x] release contract
- [x] API routes
- [x] lockfile
- [x] machine progress audit 45/45

## E. Open high-value work

- [ ] Long-horizon 500/1000/10000-cycle stable gate.
- [ ] 24h/72h/7d/30d Android runs.
- [ ] Native Android lifecycle host.
- [ ] SoC thermal telemetry.
- [ ] Real vision backend.
- [ ] ASR/TTS benchmark.
- [ ] Social prediction benchmark.
- [ ] Independent external corroboration pipeline.
- [ ] True multi-model learned world competition.
- [ ] Stronger independent Shadow Organism.
- [ ] Procedural skill longitudinal benchmark.
- [ ] Stable subsystem APIs replacing direct Core coupling.
- [ ] Further OrganismCore decomposition.
- [ ] Autonomous multi-step external projects.
- [ ] Independent consciousness evaluation protocol.

## F. Permanent interpretation rules

- Internal scores are not proof of consciousness.
- Confidence is not correctness.
- Simulation is not external evidence.
- Project completion is not independent validation.
- A benchmark PASS is only PASS for its measured criterion.
- Optimization must not remove cognitive capability merely to improve a metric.

## G. Final correction pass before release

- [x] Legacy migration tests no longer hard-code current schema 83 as an expected output.
- [x] Current schema expectation is sourced from `ORGANISM_STATE_SCHEMA` / `RELEASE_CONTRACT`.
- [x] BIG PASS 39 functional suite rerun on release 34.9.0.
- [x] Concurrency/memory/portable-subject rerun independently after composite timeout.
- [x] API/server/operational hardening rerun independently.
- [x] Archive manifest regenerated after all final edits.
- [x] Archive manifest verification has zero missing/hash/extra entries.
