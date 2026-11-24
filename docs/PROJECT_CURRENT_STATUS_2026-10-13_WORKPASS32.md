# Neuro-Kurisu — текущий статус WorkPass 32

**Дата:** 13 октября 2026 г.  
**Root:** `32.0.0-super-final18` · **Runtime:** `35.55.0` · **Schema:** `224`  
**Основа:** полный `Neuro_Kurisu_WORKPASS31_2026-10-13.zip`.  
**Статус:** implementation-workpass — **не готов к выпуску**.

## Реальное кодовое изменение

WorkPass32 усиливает существующий гибридный retrieval MemoryOS2 без создания второго хранилища.

- Добавлен bounded inverted index символьных триграмм токенов. Он сохраняется согласованным при encode, forget, eviction и восстановлении snapshot; общий корпус ограничен 1600 воспоминаниями, кандидаты — 192.
- Опечатки и распространённые словоформы могут добавить кандидатов через индекс общих триграмм, даже если точный токен отсутствует. Это локальный fuzzy lexical retrieval, не семантическая модель.
- RRF теперь объединяет BM25, покрытие токенов запроса, fuzzy совпадения, entity overlap и графово-временную поддержку; нулевые сигналы не получают искусственный rank по ID.
- Старый 48-мерный hash-token projection исключён из финального ранжирования. Его нельзя считать embedding; `retrievalDiagnostics()` явно сообщает `semanticEmbeddingProvider: none` и `semanticVectorUsedForRanking: false`. Вес отсутствующего embedding-канала перераспределён на фактические признаки retrieval.
- Существующие `MemoryFabric.applyLifecycleCommand`, provenance lineage и единственный writable owner MemoryOS2 сохранены.

## Приёмка изменённого поведения

- Runtime TypeScript — PASS.
- English spelling-variant и Russian inflection/spelling retrieval — PASS.
- Candidate coverage и независимость результата от порядка snapshot — PASS.
- Числовой retrieval и фильтр временной актуальности — PASS.
- Memory retrieval experiment: три seeds, детерминированность — PASS; продвижение — `not-promoted`.
- WorkPass31 lifecycle idempotency и WorkPass30 provenance lineage — PASS.
- HTTP server smoke — PASS.
- Adaptive memory policy test — PASS.
- Controlled fusion fixture: 7/7 для текущего hybrid profile против 6/7 для legacy lexical-only alias; это маленькая регрессия, не доказательство production-uplift.

## Открыто

Настоящий embedding provider и независимый temporal holdout ещё не подключены/не проведены; поэтому improvement в semantic recall не заявляется. Production Vite build, browser/Live2D E2E, clean-room restore/rollback, soak, live NLI/provider run и release sign-off остаются открытыми. Runtime schema остаётся 224, потому что формат сохранённой памяти не менялся; новый индекс полностью восстанавливается из canonical items.

Normalized inventory: 60 DONE / 11 PARTIAL / 10 TODO. Weighted roadmap — **72.9% без изменения**: улучшение локального retrieval не закрывает независимую оценку качества.
