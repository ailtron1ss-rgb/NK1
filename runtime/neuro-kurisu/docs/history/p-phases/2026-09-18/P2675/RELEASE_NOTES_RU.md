# P2675 — Active Information + Closed-Loop Evidence

## Release
- application: 35.6.76
- organismCore: 87.0.0-active-information-closed-loop-p2675
- stateSchema: 185
- phase: Stage-60/Active-Information-Closed-Loop/P2675

## Реализация
1. ActiveInformationGainController — конкурирующие гипотезы, оценка uncertainty, information gain, expected utility, risk/device gating, online update.
2. ClosedLoopEvidenceLedger — эпизодическая запись prediction→action→observation→verification→causal credit.
3. NeuralExperienceBranch — оба механизма встроены в decision/outcome/persistence/diagnostics.
4. Новый тест — 1800 standalone decisions + 400 evidence episodes + 900 integrated organism cycles.
5. Regression: P2627–P2640 self-optimizing autobiographical memory повторно проходит после интеграции.

## Результаты P2675
- standalone decisions: 1800
- active experiments: 22
- informationGain01: 0.18218
- epistemicValue01: 0.21692
- calibration01: 0.99369
- action coverage: 0.42857
- evidence ledger episodes: 400
- ledger closedLoopQuality01: 0.66986
- integrated cycles: 900
- integrated experiments: 3
- integrated informationGain01: 0.12936
- integrated evidence writes: 900
- integrated evidence quality: 0.52110
- integrated arbiter fusion: 0.88844

## Регрессии
P2627–P2640 повторно: retention01 0.584285, retrievalQuality01 0.744135, identityWeightedRecall01 0.957915, holdout01 0.942857, persistence PASS.

## Не пройдено / не заявляется
- физическая Android sensorimotor проверка на пользовательском телефоне не выполнена в этом окружении;
- полный Bayesian Model Reduction не реализован;
- полноценный TMoW routing между обученными world-model экспертами ещё не реализован;
- сознание не заявляется.
