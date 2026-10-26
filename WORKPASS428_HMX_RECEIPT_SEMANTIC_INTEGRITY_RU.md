# NK1 WorkPass428 — семантическая целостность HMX apply receipt

**Дата:** 2026-10-26  
**Ветка:** fix/outcome-projection-index-restore-2026-10-26  
**База:** current consolidated PR #236 branch; updated through WorkPass428 commits  
**Статус:** код и регрессии опубликованы; подтверждённого PASS на последнем head нет. На предыдущем видимом head `51d47591fc5391885389621885005457a6172804` пять доступных WorkPass71/core regression workflow завершились `failure` (runs `40349232624`, `40349232786`, `40349232574`, `40349232670`, `40349232563`), но job steps пусты, а log requests возвращают `BlobNotFound`. Для новейшего head отдельный HMX run не виден в доступном списке; exact cause остаётся неподтверждённой. Ранее найденный test-fixture mismatch исправлен; после него добавлены semantic-edge uniqueness, bounded IDs/warnings, scalar deferred-section, deep-tree bypass и cross-store rollback/retry регрессии.

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

- Некорректные типы известных секций `memories` и `relationships` отклоняются до canonicalSnapshot/encode/revise/forget; будущие неизвестные непустые scalar-секции остаются явно deferred.
- Failure-injection после canonical write и semantic-node projection должен восстановить baseline трёх хранилищ, после чего retry создаёт ровно один объект на подсистему.

- Публичный `isSafeJsonTree()` сам владеет лимитами глубины и количества узлов; дополнительные JS-аргументы не позволяют обойти лимиты.

- Непустые скалярные будущие секции (`string`, ненулевое конечное число, `true`) учитываются как одна отложенная задача, а не теряются в `deferredSections`.
- Warning-текст проверяется на управляющие символы.
- Failure-injection: отказ temporal ledger после canonical write и semantic-node projection должен откатить memory, graph и temporal ledger к baseline; повторная попытка должна создать ровно по одному объекту без дублей.

- Повтор одного `semanticEdgeId` в квитанции отклоняется даже при согласованных `projectedRelationships` и staged relationship count.
- Ограничены длина receipt ID (512 символов) и warning-текстов (2048 символов); control characters и неканонические пробелы в stage identity отклоняются.

- Rehashed but semantically impossible receipt variants.
- Attempt counter mismatch и invalid lifecycle attempts (существующий WorkPass426 тест сохранён).
- Direct exported validator с getter-backed stage/receipt: getters должны оставаться неисполненными.
- Согласованная deferred relationship квитанция, плюс phantom/zero/missing deferred counters.
- Полный projector apply пустого memory batch с будущим ключом `__proto__` и успешная последующая validation receipt.

## Проверка и границы

- Failure injection after canonical write and graph projection confirms the expected rollback/retry contract in the regression source: MemoryFabric returns to baseline, semantic graph and temporal ledger restore, and retry creates exactly one memory/node/assertion/belief.

- Успешные тесты не заявлены до запуска Actions на конечном head. Workflow должен выполнить pinned runtime/UI typecheck, canonical HMX tests и существующие проверки UI wiring.
- `main` и опубликованный WorkPass70 Release ZIP не менялись.
- Полная готовность продукта по-прежнему зависит от остальных интеграционных PR, browser/Live2D/Android E2E, soak, clean-install и license/provenance gates.
