# WorkPass34 — live semantic retrieval in the cognitive cycle

**Дата:** 13 октября 2026 года  
**Основа:** `Neuro_Kurisu_WORKPASS33_2026-10-13.zip`  
**Версия:** root `34.0.0-super-final20`, runtime `35.57.0`, schema `224`  
**Статус:** implementation workpass; не означает release readiness.

## Что изменено в рабочем коде

- Подключён опциональный локальный semantic retrieval к обычному `OrganismCore.observe` через канонический `MemoryFabric`. В отличие от WorkPass33, embeddings больше не доступны только инспектору: при явном opt-in выбранные результаты участвуют в памяти, доступной когнитивному циклу.
- Текущий BM25/fuzzy retrieval остаётся немедленным базовым результатом. Семантический путь не активен по умолчанию; включение: `NK_EMBEDDINGS_RUNTIME_ENABLED=1`.
- Время ожидания foreground ограничено по умолчанию 220 мс (`NK_EMBEDDINGS_RUNTIME_BUDGET_MS`, границы 50–1000 мс). Если провайдер медленнее или падает, ход использует лексический результат.
- Для одного `MemoryFabric` допускается только один in-flight семантический запрос/прогрев индекса. Последующие ходы не создают очередь долгих HTTP-вызовов.
- Прогрев индекса ограничен 12 memory rows на проход. Таймаут пакетного запроса теперь общий для всей партии и всех подпакетов, а не сбрасывается на каждом чанке.
- Каноническое владение остаётся в `MemoryOS2`; embedding-векторы — производный bounded index, не второй источник истины.

## Принятая приёмка

- `npm run audit:workpass34` в `runtime/neuro-kurisu`: PASS — typecheck, semantic live-cycle scenario, WorkPass33 provider tests, fuzzy/numeric retrieval, WorkPass31 lifecycle replay и HTTP server smoke.
- Корневой `npm run audit:workpass34`: завершился с кодом 0. В состав входят release metadata/contract, application scripts, browser-smoke verdicts, atomic report publication, runtime audit, retrieval benchmark, server imports, UI/API linkage и assets.
- Проверка release metadata: 34/34; release contract: 6/6; UI/API linkage: 124 маршрута и 48 поверхностей; browser smoke verdict suite: 51/51; atomic report suite: 4/4.
- Интеграционный сценарий с локальным fixture-provider подтверждает: быстрый семантический результат влияет на cognition; медленный провайдер возвращает baseline примерно за 62 мс при заданном бюджете 60 мс; ошибки приводят к fallback; максимальная конкурентность embedding-пути — 1.

## Ограничения, которые остаются открытыми

- В этой среде не запускалась реальная модель Ollama/llama.cpp, поэтому качество и RAM/latency настоящего inference не подтверждены.
- Независимая размеченная temporal holdout не показала uplift; никаких заявлений о росте Recall/качестве не делается.
- Production Vite build, интерактивный browser/Live2D E2E на целевом окружении, clean-room recovery/rollback, soak и финальный release sign-off остаются открыты.

## Следующий кодовый этап

WorkPass35 должен добавить реальный слой контроля полезности retrieval в production context: объединять семантические top-K и лексических кандидатов вместо безусловной замены списка; сохранять стабильный exact-entity/temporal приоритет; кэшировать query-векторы отдельно от document index с ключом модели и текста; включить отмену устаревшего запроса при смене хода. Quality promotion — только после реального backend run и независимого holdout.
