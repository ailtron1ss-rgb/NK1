# Финальная перепроверка Neuro/Kurisu 35.17.0 / P2805

Дата: 2026-09-20

## Релиз

- application: 35.17.0
- release: P2805
- organismCore: 100.8.0-stability-plasticity-p2805
- stateSchema: 208
- phase: Stage-99/Stability-Plasticity-Weight-Consolidation/P2805

## Реальный production upgrade

Добавлен `src/organism/cognition/P2805StabilityPlasticityArbiter.ts` и встроен в `NeuralExperienceBranch`.

Связи:

`world model/context → stability/plasticity state → sparse/protected gate → neural update → slow weight reference → selective reset → replay compatibility`

### Новые механизмы

- context-aware stability/plasticity arbitration;
- neuron importance/activity/availability tracking;
- sparse/protected learning gate;
- slow action-readout reference;
- slow edge-weight reference;
- bounded teacher pull;
- selective reset of dormant/low-utility weights;
- resource-aware reset budget;
- replay compatibility guard;
- persistence and restart;
- clean ablation switch `setStabilityPlasticityEnabled`.

## P2805 evidence

`P2805_STABILITY_PLASTICITY=PASS`

- direct learningEvents: 6240
- consolidatedWeights: 933
- sparseUpdates: 6134
- protectedUpdates: 106
- resetPressure: 0.3463
- stressResetPressure: 0.5309
- branch learningEvents: 156
- branch trajectoryDiff: 0.0120
- restart: PASS

`P2805_FACTORIAL=PASS`

Control/gate/teacher/full variants produced distinct mechanical evidence; no universal superiority claim is made.

## Critical regression evidence

- `TYPECHECK=PASS`
- `P2774_MODEL_TIME_REPLAY=PASS`
- `P2760_CONTINUUM_MEMORY=PASS`
- `P2750_UNIFIED_CAUSAL_WORLD_LOOP=PASS`
- `P2750_INTERFERENCE_MATRIX=PASS`
- `P2750_PLANNER_FALLBACK=PASS`
- `P2742_CAUSAL_PREDICTIVE_INTERVENTION=PASS`
- `P2734_SELF_OPTIMIZING_CONTINUAL=PASS`
- `P2726_CONTEXT_MODEL_REPLAY=PASS`
- `P2720_ADAPTIVE_LIFELONG=PASS`
- `P2716_DEEP_INTEGRATION=PASS`
- `P2716_CONTINUAL_BATTERY=PASS`
- `P2716_PROMOTION_GATE=PASS`
- `P2708_DEEP_LEARNING_COUPLING=PASS`
- `P2708_CONTINUAL_FACTORIAL=PASS`
- `P2708_LONG_HORIZON_CLOSURE=PASS`
- `P2724_MOBILE_ENDURANCE=PASS`
- `CLEAN_ORGANISM_SMOKE=PASS`
- `SERVER_SMOKE=PASS`
- P2702 persistent personality: PASS
- P2703 global workspace: PASS
- P2705 neural homeostasis: PASS

## Mobile evidence

P2724 endurance:

- 1500 cycles
- 750 outcomes
- max heap growth: 32.0 MB
- end heap growth: 33.5 MB
- replay resident: 96
- replay used: 500
- restart: PASS

Этот результат не является доказательством реального Android-device RSS/thermal performance; физический device gate остаётся отдельным обязательным этапом.

## Static/source/archive audits

- `audit:full`: PASS, 3547 files, 514 canonical, errors=0, warnings=0
- `audit:architecture`: PASS, sourceFiles=1601, canonicalFiles=514, missing=0, cycles=0, legacyLeakage=0
- `audit:integrity`: PASS, release=35.17.0, core=100.8.0-stability-plasticity-p2805, schema=208
- `audit:forensics`: PASS, activeFiles=3532, empty=0, duplicateContent=0, duplicateNames=0, pathMarkers=0, staleMarkers=0
- `audit:hygiene`: PASS, errors=0, warnings=0
- `audit:syntax`: PASS, js=1109, sh=6, json=240
- `audit:contract`: PASS
- `verify:release-source`: PASS
- `audit:archive`: PASS, manifestFiles=3793, missing=0, hashMismatches=0, extra=0

Во время финального audit был найден и исправлен один archive-hygiene дефект: одинаковое имя `CURRENT_RESEARCH_AND_INTEGRATION_RU.md` существовало одновременно в root и в `RESEARCH/2026-09-20/`. Research-копия переименована в `CURRENT_RESEARCH_AND_INTEGRATION_2026-09-20_RU.md`, после чего forensics снова PASS.

## Research saved

`RESEARCH/2026-09-20/P2805_STABILITY_PLASTICITY_WEIGHT_CONSOLIDATION_RU.md`

В `RESEARCH/2026-09-20/SOURCES.json` добавлены источники по weight-space consolidation, selective reinitialization, sleeping weights, replay risk и FOREVER model-time replay.

## Незасчитанная проверка

Общая последовательная legacy release-chain несколько раз упиралась в resource/time pressure на тяжёлых Node runtime tests. Это не считается PASS. Все критические runtime-компоненты были повторно запущены отдельными чистыми процессами; их индивидуальные результаты приведены выше.

## Вывод

P2805 является реально интегрированным research-release. Production code, тесты и source/archive audits завершены. Универсальное улучшение continual learning или наличие сознания не заявляется: результаты synthetic и task-dependent.
