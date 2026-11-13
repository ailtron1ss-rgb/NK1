# HMX → NK1 canonical memory bridge (13 ноября 2026)

## Назначение

Узкий адаптер Hexis Memory Exchange 1.x, который переносит только переносимые записи `sections.memories` в существующую каноническую память NK1:

`HexisAdaptationFabric stage → HexisHmxCanonicalMemoryBridge → MemoryFabric.encode → MemoryOS2`.

Второго хранилища памяти не создаётся. `MemoryOS2` остаётся единственным долговременным владельцем записей.

## Поведение

1. Входной объект отсоединяется через `snapshotPlainData`: getters/accessors не должны исполняться.
2. Проверяются версия HMX 1.x, export ID, источник, intent, структура sections, объём документа (2 MiB), максимум 64 записи на секцию и bounded ref/type/content.
3. Секции identity, worldview, drives, emotional_triggers, narrative и goals блокируются целиком. Неизвестные секции отклоняются.
4. Секции episodes, relationships, clusters, in_flight_work, audit_records, raw_units и config сохраняются в staging-артефакте, но не применяются; отчёт возвращает `section-deferred`.
5. Только после явного `commit(stagingId)` stage принимается и portable memories проходят через `MemoryFabric.encode`.
6. Идентификатор памяти детерминирован от export ID + foreign ref. Lifecycle command ID детерминирован для безопасного повтора через существующий receipt ledger.
7. Импортированная запись всегда получает `epistemicStatus=hypothesis`, `provenanceClass=external`, низкий source authority/confidence. Donor trust scores, donor embeddings, permissions, skills, goals и executable work не импортируются.
8. При частичном сбое возвращается `partial-commit-retryable`; повтор использует те же command IDs и не должен повторно выполнять уже подтверждённые mutations.

## Программный контракт

Runtime entrypoint: `MemorySubsystemRuntime.hexisHmxCanonicalMemoryBridge`.

- `stage({ document })` → `HmxBridgeStageResult`, не меняет каноническую память.
- `commit(stagingId)` → `HmxBridgeCommitResult`, применяет только memory section после accept.
- `HexisAdaptationFabric` владеет persisted stage и его status.
- `MemoryFabric.getCanonicalMemory(id)` — read-only lookup для точной классификации replay.

## Ограничения, не маскируемые как завершённая интеграция

- Это не полная реализация всех HMX 1.7 JSON Schema constraints и не полная паритетная копия Hexis importer.
- Для episodes/relationships/clusters пока нет canonical projection/ref-map rewrite.
- Protected-section Replacement Protocol не реализован этим bridge; он требует отдельного human review и собственного workflow.
- `analysis` intent запрещён для canonical mutation.
- HMX intent `port`/ `duplicate`/ `telepathy` не повышает доверие к содержимому.
- Не проверено на полном реальном экспортном corpus и реальном browser/phone runtime.
- Внешний источник может быть неверным или вредоносным по смыслу: записи остаются hypotheses и должны проходить NK1's own evidence/forget/revision mechanisms.

## Проверки

Тест: `npm run test:hexis:hmx-canonical-memory-bridge`.

Отдельный workflow: `.github/workflows/nk1-hexis-hmx-canonical-memory-bridge.yml` выполняет `npm ci`, runtime typecheck, bridge regression и существующий Hexis adaptation regression.

## Прогресс

- Код и composition wiring: IMPLEMENTED на ветке `aspect/hexis-hmx-canonical-memory-bridge-20261113`.
- Behavioral test: добавлен; exact-head CI ещё должен подтвердить выполнение.
- Полный HMX 1.7 coverage: PARTIAL.
- Canonical application: ограничено memories section.
- Release: NOT RELEASED; PR #869 Draft.
