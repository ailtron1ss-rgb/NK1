# Neuro-Kurisu 34.5.0 — BIG PASS 37

## Главная тема
Evidence / Prediction Spine + Autonomous Project Grounding.

## Изменения

- Добавлен `ExternalEvidenceTrust` с source class, independence, corroboration, contradictions и lifecycle.
- Добавлен `SelfPredictionBenchmark`.
- Исправлена calibration semantics `SelfModelV2`.
- Добавлен lightweight `ModelOlympics` и runtime integration.
- Self-projects получили milestones, validated evidence и skill-gain signal.
- Новые состояния встроены в `OrganismCore`, restore/save и `CognitiveSubsystemFacade`.
- Simulated environment явно отделён от external evidence.
- Release/source/manifests синхронизированы до 34.5.0.

## Проверено

- Typecheck PASS
- BIG PASS 37 spine PASS
- BIG PASS 37 runtime integration PASS
- P67 project evidence PASS
- P64/P65 PASS
- P80–P82 runtime E2E PASS
- restart persistence PASS
- full static audit PASS
- architecture PASS
- hygiene PASS
- release source/contract PASS
- operational hardening PASS
- operational-250 PASS: warmedMedianRatio 1.671, heapGrowth 0.530

## Незакрыто

- 24h/72h/7d/30d real device runs
- native Android lifecycle
- real vision backend
- Shadow Organism
- learned Model Olympics
- full OrganismCore decomposition
- expanded social cognition
- independent consciousness evaluation

Существующий legacy `test:autonomy` снова не завершился внутри общего 120s test window; это оставлено как отдельный operational/test-duration риск.
