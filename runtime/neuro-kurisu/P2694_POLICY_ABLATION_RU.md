# P2694 — независимый policy ablation / holdout

P2694 не добавляет ещё один слой памяти. Он проверяет, даёт ли контекстная адаптация и отложенный causal-credit измеримый прирост относительно фиксированных retrieval-политик.

## Контрольные группы

- fixed-semantic
- fixed-hybrid
- fixed-causal
- fixed-temporal
- fixed-balanced
- adaptive
- adaptive+causal-credit

## Метод

Пять детерминированных seeds, отдельный train/eval контур, 160 шагов обучения и 160 holdout-шагов. Оцениваются reward, quality, retention, transfer, interference, compute, delayed outcome и selection accuracy. Для adaptive+causal-credit дополнительно измеряется causal-credit.

Это инженерный holdout, а не доказательство универсального превосходства метода. Результаты показывают поведение именно этого синтетического стенда.

## Дополнительное исправление

P2693 имел скрытую проблему persistence: `MemoryFabric.restore()` не восстанавливал `policyOutcomeLedger`. P2694 исправляет это. В `MemoryPolicyOutcomeLedger.resolve()` добавлен точный `decisionId` режим; старый memoryId fallback сохранён для совместимости.

## Проверка

`npm run audit:p2694:policy-ablation` включает typecheck, P2694 ablation, P2693 delayed-credit, P2692 holdout и P2688 long-horizon replay.
