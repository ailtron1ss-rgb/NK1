# WorkPass335 — полный preflight перед записью learning outcomes

Дата: 2026-10-26  
Ветка: `fix/mega-cognitive-progress-tracking-2026-10-26-r3`  
Область: P23 independent candidate evaluator → VerifiedOutcomeLedger

## Выявленный дефект

`recordIndependentEvaluationOutcomes` собирает все плановые outcome rows перед commit, но ранее часть полей `runBindings` проверялась лишь на truthiness. Например, число `42` в `runId` формально проходило условие `!binding.runId`, хотя `VerifiedOutcomeLedger.record` в конце отклонял evidence reference неправильного типа. Если такое значение встречалось в более поздней строке, отказ мог произойти после сохранения более ранней записи.

Это нарушало ожидаемую семантику функции: отклонение некорректного эксперимента не должно оставлять его частично сохранённым.

## Изменение

Перед поиском запланированного запуска и построением pending outcome list каждая binding теперь проверяется по runtime-схеме, независимо от статических TypeScript типов:

- `bindingVerified` должен быть строго `true`;
- `taskId` и `trialId` должны быть непустыми строками;
- `runId` и `plannedRunId` должны быть безопасными непустыми строковыми идентификаторами, с ограничением длины и запретом управляющих символов;
- `seed` и `safetyViolationCount` должны быть целыми безопасными неотрицательными числами;
- `split` обязан быть `validation` либо `holdout`.

Все bindings проходят проверку и сверку с планом до того, как начинается первая запись. Это не является транзакционным механизмом для произвольного persistence adapter, но убирает обнаруженный путь, где некорректный поздний `runId` вызывал частичную запись.

## Регрессия

В `tests/workpass203-independent-candidate-evaluator.mjs` добавлен adversarial case: второй binding имеет числовой `runId`, а общий fingerprint пересчитан так, как это может сделать вызывающий код. Commit должен отклонить binding с `independent-evaluation-ledger-unbound-run`, и `acceptedOutcomes` должен оставаться равен нулю до валидного commit.

Команда: `npm run test:workpass203:independent-candidate-evaluator` в `runtime/neuro-kurisu`. Также требуется exact-head WorkPass110 typecheck/regressions, WorkPass108 promotion-gate и unified integration CI.

## Границы

Обычный SHA-256 envelope digest сам по себе не является подписью и не удостоверяет автора отчёта. Здесь исправляется runtime-валидация формы/плановой привязки и целостность commit boundary, а не заменяется существующая trusted verifier / signed evidence архитектура. Изменение не доказывает рост task success, transfer или learning uplift.
