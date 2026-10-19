# P23 Learning Engine — архитектура и правила

## Цель

Главное правило P23:

> Ничего не называть обучением только потому, что число внутри state изменилось.

Для каждого learning mechanism нужен observable input, measurable update и возможность проверить сохранение эффекта.

## Контур

```text
DecisionTrace
   │
   ├── stateBefore
   ├── chosen action
   ├── predicted utility/confidence
   │
   ▼
Outcome
   │
   ├── success
   ├── reward
   ├── surprise
   └── stateAfter
        │
        ▼
P23 experience
        │
        ├── online history
        ├── independent shadow comparison
        ├── decision prediction calibration
        ├── evidence debt
        └── adaptive-policy ablation
        │
        ▼
Sleep / manual consolidation
        │
        ▼
P23 replay
        │
        ▼
AdaptivePolicyEngine update
        │
        ▼
Future decision ranking
```

## 1. Experience record

Каждый outcome превращается в `LearningExperience`.

Обязательные поля:

- trace id;
- before context;
- next context;
- action;
- predicted utility;
- predicted confidence;
- success;
- reward;
- surprise.

## 2. Replay

Replay является отдельным update-pass и не должен повторяться дважды в рамках одного trace.

Используется:

`target = reward + discount × max(next-state action values)`

Затем выполняется небольшой TD update.

Повторный вызов для того же trace возвращает `0 updates`.

## 3. Shadow

Shadow не читает learned policy.

Правило baseline:

- низкая энергия / высокий load → rest;
- высокая неопределённость → verify;
- высокая novelty → explore;
- высокая social need → respond;
- высокий goal pressure → verify;
- иначе conservative reflect.

Это специально простой baseline. Цель — иметь независимую линию сравнения.

## 4. Skills

P23 skill — это не исполняемый bytecode.

Это подтверждённый context/action policy pattern.

Promotion только после temporal holdout:

`первые наблюдения = train`

`последние наблюдения = validation`

Если validation не выдерживает training signal — skill не становится promoted.

Promoted skill реально добавляет небольшой bias к будущему решению.

## 5. Evidence Debt

Каждый устойчивый mismatch между ожидаемым utility и outcome увеличивает priority проверки.

Verification pressure подмешивается только в action `verify` и ограничена небольшим коэффициентом.

## 6. Ablation

В P23 реализован первый контролируемый lesion-test:

`adaptive-policy on` vs `adaptive-policy removed`

Если ранжирование меняется — это observable contribution adaptive policy.

Далее расширяется на memory, world model и other modules.

## 7. Checksum

Digest строится из canonical JSON.

Незначимые runtime-детали, которые сериализуются JSON-движком иначе, не должны случайно давать ложный mismatch.

Проверка выполняется на restore.

Commit checkpoint всегда пересоздаёт checksum уже для состояния, которое будет сохранено.

## 8. Честные метрики

P23 различает:

- `predictionError01` — средняя absolute error текущего опыта;
- `recentPredictionError01` — та же error на последних 64 опытах;
- `learningDelta01` — относительное улучшение recent error против раннего блока, если ранний блок существует;
- `replayMeanAbsTdError01` — средний размер replay TD error;
- `shadowAgreement01` — совпадение с independent baseline;
- `decisionPredictionCalibration01` — calibration выбранного решения против его фактического outcome.
- `alternativePredictionCalibration01` и `counterfactualCalibration01` — deprecated compatibility aliases; они не означают физический контрфактический эксперимент.

Последняя метрика сознательно НЕ называется физической counterfactual accuracy.

## 8a. Resolution of evidence debt

P23 не оставляет evidence debt вечным списком. Успешная `verify`-трасса снижает priority соответствующего debt item; низкоприоритетные записи удаляются. Это делает verification queue частью замкнутого цикла, а не декоративной статистикой.
