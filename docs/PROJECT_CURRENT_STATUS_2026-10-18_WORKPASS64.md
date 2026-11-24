# Текущий статус Neuro Kurisu — WorkPass 64 (18 октября 2026)

**Каноническая рабочая версия:** runtime `35.84.0`, persisted schema `225`, исходная база `Neuro_Kurisu_WORKPASS63_2026-10-18.zip`. **Релиз не одобрен.** Этот проход исправляет жизненный цикл архивных квитанций и видимость неразрешённых исходов; он не доказывает работу живого провайдера.

## Что изменено в коде

1. `ActionGateway.makeLedgerRoom` больше не вытесняет из hot-ledger completed outcomes с неподтверждённым внешним постусловием. При заполнении только такими квитанциями новые side-effecting операции останавливаются с `idempotency-ledger-full`, не доходя до адаптера.
2. `FileActionExecutionLedgerArchive` сохраняет append-only историю, но теперь может добавлять ограниченную авторитетную ревизию для той же `requestHash` / `toolId` / `executionId`, только если предыдущая archived запись не разрешена, а новая имеет `reconciled=true`. Идентичность, переход и checksum проверяются как при записи, так и при загрузке после рестарта.
3. `ActionGateway.unresolvedExecutionCount` и `unresolvedExecutionSnapshot` объединяют hot-ledger и архивные unresolved rows. Текущая архивная ревизия имеет приоритет над устаревшим hot-shadow. Очередь остаётся read-only и не раскрывает key hash или request body.
4. Добавлен `workpass64-archived-receipt-reconciliation.mjs`: проверка насыщения ledger, устаревшей архивной неопределённой записи, авторизованной read-only сверки, новой append-only revision, повторной загрузки архива и безопасного replay.

## Проверки

- Runtime TypeScript typecheck: **PASS**.
- WorkPass64 archive/recovery regressions: **PASS** (3 scoped scenarios).
- Legacy action-ledger archive spill/replay: **PASS** (4 subtests).
- WorkPass63 uncertainty/skill firewall and filesystem side-effect recovery: **PASS**.
- WorkPass62 two-SIGKILL recovery and WorkPass61 authoritative receipt revision: **PASS**. Child-process fault-injection harnesses have a bounded deadline and process-group cleanup; WorkPass63/62 are run as a separate regression command.
- App production build / real browser / Live2D: **NOT RUN**. I retried the canonical installer in this pass; npm `ci` hit `EAI_AGAIN` fetching `ajv@^8.12.0` and timed out. `app/node_modules` remains absent.

## Граница результата

Взвешенная дорожная карта остаётся **80,1%**: измерения качества retrieval по-прежнему дают `recallDelta=0`, live provider/device ACK-gap не пройден, dependency-complete UI build и настоящие browser/Live2D-путешествия не подтверждены. Архивный тест доказывает локальную файловую персистентность и семантику revision/replay, но не удалённое принятие действия и не физическое устройство.

Финальный архивный контроль: **9 299 записей**, все **9 292** пути WorkPass63 сохранены; добавлено 7 файлов, изменено 18 существующих, удалений нет. Runtime archive manifest: **4 256** записей, без несовпадений. SHA-256 дан в соседнем `.zip.sha256` sidecar.

Нормализованный inventory: **96 задач — 78 DONE / 10 PARTIAL / 8 TODO**. WorkPass64: **4/4 scoped code deliverables (100%)**; это не означает закрытие release gates.

Детали: `docs/WORKPASS64_CODE_CHANGES_2026-10-18.md`, `docs/WORKPASS64_HANDOVER_2026-10-18.md`, `docs/ROADMAP_GAPS_TO_TARGET_WORKPASS64.md`.
