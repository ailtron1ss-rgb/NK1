# WorkPass34 — список выполненных и следующих задач — 13.10.2026

## Выполнено в коде

- [x] Подключить локальный semantic retrieval к рабочему `OrganismCore.observe` через единый `MemoryFabric` без второго владельца памяти.
- [x] Сохранить немедленный BM25/fuzzy fallback при отключённом provider, timeout, перегрузке или исключении.
- [x] Ограничить foreground wait настройкой `NK_EMBEDDINGS_RUNTIME_BUDGET_MS` (по умолчанию 220 мс, допустимый диапазон 50–1000 мс).
- [x] Ограничить прогрев derived index до 12 записей на проход и не плодить параллельные embedding-задачи.
- [x] Ограничить общим deadline всю batch-операцию провайдера, включая подпакеты.
- [x] Подключить и исполнить focused runtime и корневой `audit:workpass34`.
- [x] Согласовать root/runtime package versions, lockfile, `SUPER_VERSION.json`, CHANGELOG, README, current status, scorecard и backlog.

## Следующая реализация — WorkPass35

- [ ] Объединять семантический top-K и лексических кандидатов, сохраняя exact entity, temporal validity и фактическую политику памяти; не заменять качественные лексические результаты семантическим списком вслепую.
- [ ] Добавить bounded query-embedding cache с ключом `modelId + modelRevision + normalizedQuery`, отдельный от document-vector cache.
- [ ] Отменять или игнорировать устаревший embedding-ответ после смены пользовательского хода/запроса; не касаться канонического состояния в отменённом запросе.
- [ ] Сохранять текущий single-flight guard и bounded background index warming, но сделать lifecycle provider/revision явным в runtime diagnostics.
- [ ] Выполнить настоящий Ollama/llama.cpp inference на целевом компьютере и измерить cold/warm latency, RAM и время индексации.
- [ ] Проверить полезность на независимой temporal holdout против BM25/fuzzy; не включать по умолчанию и не объявлять uplift до результата.

## Вне рамок этого прохода, всё ещё открыто

- [ ] Production Vite build и браузерный Live2D E2E на целевом окружении.
- [ ] Clean-room persistence/restore/rollback, soak и итоговый release sign-off.

**Ограничение:** fixture-backed provider доказывает проводку и fallback-политику, не качество настоящей модели. Вес retrieval по результатам не повышен; readiness score остался без изменений.
