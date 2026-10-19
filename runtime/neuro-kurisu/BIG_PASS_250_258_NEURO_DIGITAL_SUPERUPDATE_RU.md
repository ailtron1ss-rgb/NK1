# Neuro-Kurisu 35.6.1 — BIG SUPER UPDATE B250–B258

## Реально внедрено

B250 SparsePredictiveGraph — разреженный predictive/event-driven граф с persistent topology, active-edge budget и prediction error.

B251 LocalNeuralCreditAssigner — локальное распределение credit по eligibility, reward, prediction error и stability.

B252 MetaMemoryController — meta-memory: retrieval precision, replay, semantic compression и forgetting risk.

B253 SandboxedSelfRewriteEngine — самоизменения только через expected gain + holdout gain + risk gate; без rollbackReady изменение блокируется/откатывается.

B254 SensorimotorCoSimulationEngine — внутренний action→body→outcome цикл и перенос качества через simulation gap.

B255 DevelopmentalPhaseScheduler — стабилизация, эксперимент, обучение, консолидация и расширение как взаимно исключающие developmental regimes.

B256 SubstratePortabilityEngine — оценка переносимости состояния между computational substrates и оценка fidelity/drift.

B257 LongitudinalOrganismBenchmarkEngine — longitudinal stability, transfer, identity retention, drift и holdout.

B258 HybridCausalPlasticityCompiler — финальный gate для plasticity commit: causal evidence + local credit + stability + holdout + developmental freeze.

## Интеграция

Все B250–B258 подключены к NeuroDigitalEvolutionEngine, его snapshot/restore и, через существующий OrganismCore system snapshot, к persistence/restart организма.

Ключевой принцип слоя: neural subsystem может предлагать изменение, но meta-developmental/compiler слой должен разрешить его только при достаточном evidence и безопасном состоянии.

## Проверка

- typecheck: PASS
- B250–B258 standalone + engine regression: PASS
- B242–B249 regression: PASS
- OrganismCore restart persistence: PASS
- audit:function-liveness: PASS
- audit:function-parameterized-safe: PASS, 688 attempted / 673 passed / 0 failed
- audit:semantic-coverage: PASS
- audit:full: PASS, errors=0, warnings=0
- architecture: PASS
- integrity: PASS
- forensics: PASS
- hygiene: PASS
- syntax: PASS
- release contract: PASS
- lockfile: PASS
- release source: PASS
- organism smoke: PASS

## Честное ограничение

Semantic coverage всего проекта остаётся исследовательским показателем, а не доказательством готового биологического или сознательного мозга: VERIFIED=38, INTEGRATION_ONLY=730, UNSAFE_TO_AUTO_RUN=244, UNVERIFIED=1963.
