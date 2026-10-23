# WorkPass451 — идемпотентный журнал свидетельств реальности

**Ветка:** `feature/perception`  
**Источник идеи:** [QuixiAI/Hexis — Memory Architecture](https://github.com/QuixiAI/Hexis/blob/main/docs/concepts/memory-architecture.md), MIT; адаптация в существующий NK1 reality gate.  
**Статус:** source/test/script wiring внесены; запуск теста не подтверждён.

## Изменение

`RealityEvidenceLedger` теперь валидирует входящий record до записи: tick, время, класс реальности, confidence, claim, independence key и parent IDs. Записи с getters/cycles/непростыми объектами отклоняются через имеющийся `PlainDataSnapshot`.

ID построен на SHA-256 от канонизированного содержимого свидетельства. Полный повтор того же свидетельства возвращает прежнюю запись и не увеличивает total — повторная доставка больше не выглядит как новое независимое подтверждение. Restore восстанавливает только известные поля, карантинит невалидные записи и не принимает бесконечные счётчики.

## Важное разграничение

Классы `external-observation`, `device-observation`, `user-reported`, `simulator`, `derived` и `model-generated` остаются раздельными. Внутренняя симуляция сама по себе не превращается в независимое наблюдение. Детерминированная идентичность не утверждает истинность данных: она только обеспечивает воспроизводимость и защиту от повторов.

## Регрессии

Добавлен `workpass451-reality-evidence-ledger.mjs`, который покрывает идемпотентный replay, разделение external/simulator, некорректные поля, getters и санитаризацию restore. Он включён в существующий `test:p2841`.

## Следующий проход

Добавить единый cross-subsystem evidence ID в цепочке «сенсор → reality ledger → epistemic claim → outcome reflection», чтобы одна фактическая телеметрия подтверждала событие во всех контурах, но не считалась несколькими независимыми источниками.