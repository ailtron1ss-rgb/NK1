# NK1 WorkPass428 — семантическая целостность HMX apply receipt

**Дата:** 2026-10-26  
**Ветка:** fix/outcome-projection-index-restore-2026-10-26  
**База:** current consolidated PR #236 branch; updated through WorkPass428 commits  
**Статус:** код и регрессии опубликованы; exact-head GitHub Actions завершились с `failure`, но job steps/log blobs недоступны (`BlobNotFound`), поэтому точная причина пока не подтверждена. Найденный дефект test-fixture исправлен в `4a159dfd32c8c24c67a5e4ba97c9c6df062848b1`; повторный HMX/Core/Metrics запуск на этом head ещё требует диагностируемого результата.

## Почему потребовался отдельный проход

Текущая consolidation-линия уже содержит независимый `lifecycleDigest` для статуса и счётчика попыток HMX. Нельзя было переносить старую реализацию валидатора целиком, потому что это затёрло бы более новую lifecycle-seal защиту. Поэтому изменения добавлены только в текущий `HexisStageIntegrity` export/type declaration, projector, тест, CI trigger и журнал.

## Изменения в коде

- Сохранён lifecycle-seal контракт WorkPass427; `isSafeJsonTree` экспортируется как повторно используемый безопасный валидатор и добавлен в `.d.mts`.
- `isValidHmxApplyReceipt` самостоятельно проверяет stage digest/lifecycle, статус `applied`, стратегию `port + additive`, canonical HMX identity и безопасное JSON-дерево квитанции.
- Receipt attempt обязан точно совпадать с `applicationAttempts` при наличии счётчика.
- Счётчики candidate/unique/imported/deduplicated и ID-массивы согласованы; пустые/whitespace IDs, duplicate IDs и `createdMemoryIds`, не входящие в `memoryIds`, отклоняются.
- Deferred section summary сравнивается с фактическими staged sections; нулевые, отсутствующие и придуманные секции не проходят. Relationship counters покрывают всю staged relationship array.
- Словарь deferred sections имеет null prototype; ключи вроде `__proto__` сохраняются как собственные поля и проходят проверку.
- Canonical HMX workflow включает текущую integration base branch в фильтр pull request.

## Регрессии

- Повтор одного `semanticEdgeId` в квитанции отклоняется даже при согласованных `projectedRelationships` и staged relationship count.

- Rehashed but semantically impossible receipt variants.
- Attempt counter mismatch и invalid lifecycle attempts (существующий WorkPass426 тест сохранён).
- Direct exported validator с getter-backed stage/receipt: getters должны оставаться неисполненными.
- Согласованная deferred relationship квитанция, плюс phantom/zero/missing deferred counters.
- Полный projector apply пустого memory batch с будущим ключом `__proto__` и успешная последующая validation receipt.

## Проверка и границы

- Успешные тесты не заявлены до запуска Actions на конечном head. Workflow должен выполнить pinned runtime/UI typecheck, canonical HMX tests и существующие проверки UI wiring.
- `main` и опубликованный WorkPass70 Release ZIP не менялись.
- Полная готовность продукта по-прежнему зависит от остальных интеграционных PR, browser/Live2D/Android E2E, soak, clean-install и license/provenance gates.
