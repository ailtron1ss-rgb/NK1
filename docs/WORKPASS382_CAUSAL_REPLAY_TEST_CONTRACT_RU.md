# WorkPass382 — исправление проверки wiring causal replay

**Дата:** 2026-10-26  
**Ветка:** workpass375-hexis-canonical-ingress-latest  
**Предыдущий exact HEAD:** 67e535a14d111a6d16f266d090a878b6dbb8a32b  
**Статус:** контракт теста исправлен; требуется новый точный CI-запуск.

## Наблюдение

WorkPass71 runtime/rebuild дошёл до `tests/causal-replay-runtime-wiring.mjs` после того, как в P26 learning chain прошли `p26-sequential-learning-benchmark.mjs`, `p26-replay-policy-sweep.mjs` и `p26-interleaved-contract.mjs`. Дальше проверка упала с `AssertionError: causal sampler candidates must be grounded in state/outcome features` на строке 15.

## Анализ действующего пути

В `P23LearningEngine.replayPending()` есть реальная последовательность:

1. `ranked.map(...)` строит `causalCandidates` и прикрепляет `policyFeatures01` из `trace.stateBefore.needs`, prediction/attention/autonomy/self-prediction signals и `trace.outcome` (`success`, `reward`, `surprise`).
2. `selectCausalReplayBatch(causalCandidates, ...)` выполняет bounded diversity prefilter.
3. `selectReplayBatch(causalCandidatesSelected, options)` остаётся финальным adaptive multi-signal selector.

Сбой оказался в статическом контракте теста: он искал строку `policyFeatures01:[` начиная с позиции вызова sampler, хотя feature vector по корректной архитектуре создаётся до самого вызова.

## Исправление

- Начинать поиск feature vector от входа `replayPending`, а не от sampler call.
- Требовать vector между началом production method и `selectCausalReplayBatch`.
- Дополнительно проверять, что вектор строится в `causalCandidates=ranked.map(...)`.
- Сохранить проверки полей `needs.energy`, `needs.goalPressure`, `trace.outcome?.success`, закрытия массива и `maxBatchSize`-ограничения.
- Runtime sampler и replay ranking не изменялись.

## Acceptance

Новый exact-head WorkPass71 должен пройти этот тест и остальные rebuild regressions; Repository Wiring Audit и P26 suite нужно оценивать по текущему, а не предыдущему SHA. Это исправление статического test-contract mismatch, не новая заявка на эффективность обучения.

`main` и опубликованный GitHub Release ZIP остаются без изменений.

