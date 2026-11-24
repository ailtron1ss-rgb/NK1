# WorkPass 26 — temporal MemoryOS2 inspector closure

**Дата:** 13 октября 2026 г.  
**База:** `Neuro_Kurisu_SUPER_WILL_LUMINA_HEXIS_LETTA_CONSCIO_INTEGRATED_WORKPASS25_2026-10-11.zip`  
**Версия:** root `26.0.0-super-final13` · runtime `35.49.0` · schema `224`  
**Статус:** implementation workpass; не release-ready.

## Выбранная ветка

Один вертикальный срез Memory 2.0: `MemoryOS2 → MemoryFabric → OrganismCore → HTTP API → Runtime Atlas`. Другой владелец памяти не добавлялся. Цель этой итерации — сделать временную историю достоверно доступной через read-only inspector, а не заявлять необоснованный прирост recall.

## Что реально улучшено

1. **Исправлена temporal-архивация.** `temporalMode=all` теперь не отбрасывает ревизии, у которых `validUntilAt` в прошлом; обычный current/point-in-time recall по-прежнему подавляет неактуальные записи.
2. **Исправлен выбор времени.** Отсутствующий или пустой `asOfAt` не преобразуется в `0`; explicit `asOfAt=0` при этом остаётся валидным историческим timestamp. Сервер ограничивает `q` 512 символами и безопасно нормализует `limit` до 1–32.
3. **Реально восстановлен API route.** Первый HTTP-smoke обнаружил структурный дефект: `memory-inspector`, `autobiographical-contextual-outcomes` и `experience-continuum` были вложены после безусловного `return` внутри обработчика `autobiographical-action-outcomes`, следовательно никогда не вызывались. Все три теперь самостоятельные sibling handlers.
4. **Inspector действительно read-only.** `MemoryOS2.previewRetrieve` берёт snapshot, восстанавливает изолированный экземпляр и ищет на нём; `MemoryFabric.previewRetrieve` не меняет счётчики, hot IDs, outcome ledger или live adaptive policy. `OrganismCore.memoryRetrieveTemporal` и `memoryInspectorSearch` переключены на этот путь.
5. **Функция доступна в UI.** Runtime Atlas показывает query-поле, режим Current / As of time / All revisions, datetime picker и лимит 1–32. Для temporal modes запрос обязателен; пустой current query остаётся снимком недавних записей. API-клиент кодирует параметры и валидирует лимит.
6. **Добавлено покрытие регрессий.** `tests/memory-temporal-inspector-closure.mjs` проверяет current, historical, archive, null-as-of и отсутствие изменений live snapshot/политики/учёта. HTTP server smoke проверяет отсутствие `asOfAt`, явный timestamp `0` и неправильный limit на реальном сервере.

## Результаты прогонов

- Runtime `npm run typecheck` — PASS.
- `npm run test:memory-temporal-inspector-closure` — PASS (`archiveContainsBoth=true`, `previewReadOnly=true`).
- `npm run test:r15:memory` — PASS; локальный fixture сообщает `holdoutRecallAt3=1`. Это не независимая проектная holdout выборка.
- `npm run test:r16:memory` — PASS (`candidates=96`, `results=8`).
- `npm run test:memory-retrieval-benchmark` — PASS как regression; результат **promotion=not-promoted**, recall delta `0.125`, bootstrap CI `[-0.25, 0.5]`, то есть прирост не подтверждён с достаточной уверенностью.
- `node --experimental-strip-types tests/server-smoke.mjs` — PASS, включая новый реальный HTTP тест inspector.
- Root `npm run audit:workpass26` — PASS: metadata contract, 6 release-metadata contract tests, app script suite, 51 browser-smoke-verdict tests, 4 atomic-report tests, runtime memory suite, server imports, UI/API linkage (`124` client routes / `48` Runtime Atlas surfaces), asset audit и повторная metadata verification.
- TypeScript `transpileModule` для изменённых `RuntimeAtlas.tsx` и `api.ts` — PASS по синтаксису/JSX. Полноценный TypeScript/Vite build не выполнялся.

## Честные границы

- React/Vite production build и реальный browser/Live2D E2E остаются непроверенными: frontend dependencies в этой среде отсутствуют. Syntax transpile и static linkage не равны браузерному E2E.
- Независимый labelled temporal holdout и BM25 baseline остаются P0 открытыми; MemoryOS2 candidate **не продвигается**. Current memory benchmark не подтверждает надёжный uplift.
- Реальный pretrained NLI inference, live external provider, clean-room restore/rollback, soak, финальные SBOM/provenance и release sign-off остаются открытыми.

## Контрольная точка

WorkPass26 закрыл одну normalized задачу G78. Inventory: **78** задач — **57 DONE, 11 PARTIAL, 10 TODO**. Weighted roadmap: **72.15%** (+0.15 п.п. к предыдущей контрольной точке). Оценка roadmap не означает качество интеллекта и не является release-readiness verdict.
