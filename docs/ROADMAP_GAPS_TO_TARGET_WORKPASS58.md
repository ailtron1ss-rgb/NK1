# Остаток дорожной карты после WorkPass58

Процент WorkPass58 и общий roadmap score разделяются: проход выполнен на 100% по собственным 8 deliverables; официальная взвешенная готовность остаётся 78.0%, потому что live/release критерии нельзя закрыть симулированными тестами.

## Следующая кодовая волна — приоритет

### P0 — end-to-end action lineage
1. Инвентаризировать каждый исполняемый caller: обычный cognitive loop, reusable skill, project step, autonomous planner, device/voice/browser/research adapters и direct server endpoints. Для каждого указать tool class, key requirement, approval, `decisionId`, `executionId`, receipt finalizer и postcondition observer.
2. Устранить любые маршруты, где planner или bridge может дойти до executor без канонического `ActionGateway` и durable receipt. Не оборачивать keyed path вторым finalizer.
3. Добавить durable pending checkpoint и restart/reconcile на уровне составного skill/project, сохраняя оригинальные correlation IDs; не выполнять автоматический повтор при unknown/ambiguous outcome.

### P1 — память и обучение на полном действии
1. Замкнуть `decisionId → executionId → receipt → external observation → outcome projection → learning assignment → MemoryFabric` на реальном adapter.
2. Сохранять source identity, independence key и exact observed/expected state при миграции/replay; source-only или model-inferred evidence не повышает competence.
3. Создать frozen labelled temporal retrieval holdout с BM25 baseline, hard negatives, contradiction/abstention и измерениями Recall@k/MRR/false-recall/p95. Нынешний `recallDelta=0` — никакого promotion.
4. Обновлять интересы и память только после идемпотентного causal receipt, не по дублям событий или молчанию пользователя.

### P1 — provider и restart robustness
1. Тестировать соединение, timeout-after-submit, partial/ambiguous ACK, process crash перед финализацией, restart, late external observation и reconcile against actual state.
2. Проверить capability-based key policy и запреты внешней подделки autonomous provenance во всех endpoint/bridge paths, а не только в двух project endpoints.

### P2 — embodiment/UI
1. Прогнать интерактивные approval/deny/expire/reconnect journeys в установленном browser/Vite приложении.
2. Привязать speech timeline, phoneme/viseme events, interrupt/cancel и motion intent к одному каноническому состоянию.

### P3 — выпуск/оптимизация
- Реальный inference на целевой GTX 1650 4 GB/целевом оборудовании с latency/VRAM/RAM/quality measurements.
- Fault-injected clean-room restore/rollback, полный review лицензий вложенных архивов, multi-hour soak и финальная сборка.
- Оптимизировать и удалять архивные дубли только после подтверждения source hash/provenance/restoration path.

## Условия закрытия общего roadmap

Release score пересматривается только после проверки production build/E2E, реальных внешних postconditions/reconnect, независимого memory benchmark, rollback, лицензий и soak. Наличие классов, зелёного юнит-теста или 100% выполнения одного прохода само по себе не увеличивает release readiness.
