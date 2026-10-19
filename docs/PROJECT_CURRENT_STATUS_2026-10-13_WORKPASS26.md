# Нейро Курису — текущий статус WorkPass 26

**Дата:** 13 октября 2026 г.  
**Корень:** `26.0.0-super-final13` · **Runtime:** `35.49.0` · **Schema:** `224`  
**Статус:** implementation workpass — **не готов к выпуску**.

## Сколько сделано

- **78 уникальных deliverables:** 57 DONE, 11 PARTIAL, 10 TODO. WorkPass26 закрыл G78 — согласованную temporal-архивацию и безопасный read-only путь инспекции канонической памяти.
- Основная ветка этой итерации — `MemoryOS2 → MemoryFabric → OrganismCore → API → Runtime Atlas`; отдельный второй memory owner не добавлялся.
- Runtime typecheck и целевые memory suites проходят; отдельный тест покрывает актуальное значение, point-in-time значение, архив superseded revisions, `asOfAt=null` и неизменность состояния при preview.

## Реальные изменения WorkPass 26

1. `temporalMode=all` теперь действительно показывает истёкшие/заменённые ревизии; фильтр просроченных записей применяется только к обычному текущему/историческому recall.
2. Отсутствующий или null `asOfAt` больше не превращается в `0` (Unix epoch). Без явной даты используется текущее время; неверный лимит не превращается в `NaN`, а query ограничен 512 символами.
3. Реальный HTTP-smoke выявил, что `/api/organism/memory-inspector` был недостижим: его `if` находился внутри `/autobiographical-action-outcomes` после безусловного `return`. Исправлен уровень dispatch; соседние `/autobiographical-contextual-outcomes` и `/experience-continuum` также возвращены в набор самостоятельных обработчиков.
4. Добавлены `MemoryOS2.previewRetrieve` и `MemoryFabric.previewRetrieve`: запрос выполняется на изолированном восстановленном snapshot и не обновляет живую memory, hot IDs, retrieval counters, outcome ledger или адаптивную retrieval policy. `OrganismCore` использует именно этот путь для инспектора.
5. Runtime Atlas получил UI управления инспекцией памяти: свободный запрос, Current / As of time / All revisions, дата-время и лимит 1–32. API-клиент передаёт параметры с валидацией границ.
6. Добавлен `tests/memory-temporal-inspector-closure.mjs` и script `test:memory-temporal-inspector-closure`; добавлены runtime/root aliases для WorkPass26.

## Выполнено и подтверждено

- `npm run typecheck` — PASS.
- `npm run test:memory-temporal-inspector-closure` — PASS; подтвердил current/historic/archive и read-only preview.
- `npm run test:r15:memory` — PASS (`holdoutRecallAt3: 1` в локальном fixture).
- `npm run test:r16:memory` — PASS (`candidates: 96`, `results: 8` в локальном benchmark fixture).
- `npm run test:memory-retrieval-benchmark` — PASS; это не заменяет независимый реальный holdout.
- `node --experimental-strip-types tests/server-smoke.mjs` — PASS: реальный HTTP inspector route, default timestamp, явный timestamp `0`, ограничение `limit` и остальные server smoke paths.
- TypeScript `transpileModule` для изменённых `RuntimeAtlas.tsx` и `api.ts` — PASS по синтаксису/JSX; это не полноценный Vite production build или UI typecheck.

## Границы — не объявляем завершённым без доказательств

- React/Vite production build и реальный browser/Live2D E2E здесь не подтверждены: frontend dependency set отсутствует. UI-код написан, а статическую UI/API связность нужно прогнать отдельно; без browser build нельзя заявлять, что весь экран проверен в браузере.
- MemoryOS2 benchmark остаётся `not-promoted`: независимый labelled temporal holdout, сравнение с BM25/простыми retrieval-базами и доказательство отсутствия регрессии всё ещё открыты.
- Настоящие pretrained NLI weights/inference, live external provider, clean-room restore/rollback, soak, финальные SBOM/provenance и release sign-off остаются открытыми.

**Взвешенная оценка roadmap:** 72.15% (рост на 0.15 п.п. относительно WorkPass25). Это оценка реализации по рабочей карте, не измерение интеллекта и не готовность релиза.
