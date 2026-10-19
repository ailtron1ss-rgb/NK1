# NEURO KURISU — P2841 FINAL AUDIT

Дата: 2026-09-20
Релиз: 35.18.4 / P2841
Core: 100.10.0-reality-postcondition-p2841
State schema: 210

## 1. Цель прохода

Продолжить P2840 и замкнуть postcondition: внешний результат должен быть не только audit evidence, но проверяемым входом следующего grounded-world state и последующего обучения.

## 2. Код выполнен

1. `ExternalPostconditionVerifier`.
2. `GroundedWorldState.integrateExternalOutcome()`.
3. `OrganismCore.recordGroundedExternalOutcome()`.
4. `RealityGroundingController.causalHoldoutReadiness()`.
5. `RealityGroundingController.refineLatest()`.
6. `RealityLearningGate.refineLatest()`.
7. Runtime integration of postcondition verification.
8. Verification-gap aware active-perception trigger.
9. State migration 209 -> 210.
10. P2841 runtime/unit/migration/persistence tests.
11. Long-horizon causal holdout attenuation wired into memory/identity promotion.
12. Grounded-world state is now persisted and restored across runtime restart.

## 3. Проверка реального runtime

`tests/p2841-runtime-external-grounding.mjs` прошёл с monkey-patched external device outcome и проверил полный `OrganismRuntime.step()`.

Результат:

- tick = 1
- grounded world revision = 2
- canonical fact `external-observed:*` создан
- external source = external
- verified = 1.00
- evidence ≈ 0.9032

Это подтверждает, что изменение не ограничивается unit-test: оно проходит через runtime до canonical grounded world.

## 4. Verification results

- Typecheck: PASS.
- P2841 postcondition: PASS.
- P2841 runtime: PASS.
- P2841 migration: PASS.
- P2841 persistence grounding: PASS.
- P2835 current synergy: PASS.
- P2835 interaction factorial: PASS (16 runs, 2 regimes, 4 variants, 2 seeds).
- P2836 reality-first: PASS.
- P2836 neural ablation-fast: PASS.
- Server smoke: PASS.
- Mobile-256 V8-cap smoke: PASS.
- P2840 shadow: PASS.
- P2840 learning gate: PASS.
- P2840 boundary: PASS.
- P2835 hotpath: PASS.
- P2835 persistence/restart: PASS.
- Organism smoke: PASS.
- Architecture: PASS.
- Forensics: PASS.
- Source hygiene: PASS.
- Syntax: PASS.
- Release contract: PASS.
- Integrity: PASS.
- Release source: PASS.

## 5. Important non-PASS observations

Цепной runner отдельных старых тестов однажды упёрся в timeout. Повторная изолированная проверка соответствующих P2840 тестов проходит:

- shadow — PASS;
- learning gate — PASS;
- boundary — PASS.

Это классифицировано как runner/resource instability, а не функциональный fail P2841.

Server smoke и mobile smoke проходят в чистых отдельных процессах. Длинный chained runner иногда получает resource timeout после тяжёлого factorial/smoke набора; standalone reruns проходят. Это остаётся runner/resource observation, а не функциональный fail P2841.

## 6. Мобильная граница

`organism-smoke` проходит. `mobile256` также проходит в чистом процессе. Изолированный замер показал peak RSS ≈ 389,692 KiB (~380.6 MiB) при V8 heap cap 256 MB; поэтому физический 256 MB RSS budget не закрыт и остаётся отдельным performance debt.

## 7. Оценки после P2841

| Область | Оценка |
|---|---:|
| Runtime/integration | 88/100 |
| Neural substrate | 73/100 |
| Reality grounding | 78/100 |
| Continuous life | 84/100 |
| Memory | 83/100 |
| World model | 72/100 |
| Autonomous agency | 70/100 |
| Identity/personality | 70/100 |
| Lifelong external learning | 50/100 |
| Social organism | 55/100 |
| Mobile readiness | 68/100 |
| Causal verification | 72/100 |
| Consciousness research readiness | 20/100 |

Общая инженерная готовность к целевой архитектуре: примерно `69/100`.

Это не процент сознания и не вероятность его возникновения.

## 8. Доля кодовой работы

Сравнение непосредственно с P2840: 13 новых файлов, 0 удалённых, 12 изменённых. Финальный textual diff: +1550 / -55 строк.

Production/test/release code scope: +1636 / -18 строк изменения по 14 затронутым code/config файлам; это основной объём прохода.

Финальные holdout measurements: readiness после 1 matched verified trial ≈ 0.162; после 6 ≈ 0.974. Это закрывает прежнюю проблему additive scoring, при которой одно качественное событие могло слишком быстро дать почти максимальную readiness.

По line-diff критерий code-first выполняется: свыше 80% добавлений приходится на код, тесты и release/runtime инфраструктуру, а не на отчёты.

## 9. Исследовательские изменения и ожидаемая отдача

P2841 закрепляет только те идеи, которые соответствуют текущей архитектуре и мобильным ограничениям.

- Actionable world-model direction: высокий потенциальный эффект, но прямой перенос тяжёлых V-JEPA-подобных моделей на средний Android не выполнялся. Применён архитектурный принцип: оценивать world model по способности улучшать action/verification/recovery, а не только prediction loss.
- Active perception: средне-высокий потенциал; при большом shadow/reality divergence организм уже получает усиленный запрос на дополнительную проверку.
- Distributed physical representations: исследовательски интересны для следующего neural ablation блока, но не внедрялись как ещё один parallel neural engine.
- Long-term/test-time memory: существующие fast/slow memory механизмы расширены causal-holdout gate вместо добавления второго memory stack.

Потенциальный прирост нельзя честно выразить одной процентной цифрой до real-world holdout эксперимента. Наиболее вероятные выигрыши — меньше ложного закрепления ошибок simulator, лучше calibration, меньше premature identity/memory promotion и больше полезного sensing при неожиданных последствиях.

## 10. Главный остаточный разрыв

Следующая граница — не ещё один controller. Нужен реальный long-horizon external verification loop:

`action -> independently measured postcondition -> grounded-world transition -> repeated causal evidence -> active perception -> lifelong learning`.

## 11. Следующий крупный этап

P2842: External Effect Verification Matrix + long-horizon causal calibration + persistent active-perception evidence.

Дальше приоритет: (1) матрица реальных effect classes, (2) repeated matched interventions, (3) active sensing policy, (4) 1h/6h/24h continuity on Android/Termux, (5) только затем перенос новых neural/world-model mechanisms.
