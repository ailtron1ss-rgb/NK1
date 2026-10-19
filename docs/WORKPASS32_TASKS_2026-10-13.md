# WorkPass32 — список дел — 13.10.2026

## Сделано в коде
- [x] Добавить характерный n-gram index для typo/inflection candidate discovery в канонический MemoryOS2.
- [x] Вести postings при encode, forget/capacity eviction и восстановлении snapshot.
- [x] Заменить BM25 + hash-vector RRF независимым fusion: BM25, coverage, fuzzy, entities, graph/temporal.
- [x] Исключить hash-only vector из финального ранжирования и перераспределить вес отсутствующего embedding-канала.
- [x] Добавить English/Russian fuzzy retrieval regression и lifecycle индекса.
- [x] Согласовать version/lock, CHANGELOG, статус, scorecard и канонический backlog в архиве.

## Следующий крупный кодовый подход
- [ ] WorkPass33: подключить настоящий локальный embedding backend за bounded интерфейсом, включая model identity, размерность/нормализацию вектора, lazy batch embedding и fallback без блокировки чата. Не объявлять semantic retrieval активным при отсутствии модели.
- [ ] Перенести переподсчёт и адаптацию query embeddings на асинхронную границу, чтобы не делать сетевые/модельные вызовы синхронно внутри MemoryOS2.
- [ ] Улучшить локальное reranking над top-K через доступный cross-encoder только после реального model availability; сохранить BM25/fuzzy fallback.
- [ ] Независимая временная выборка остаётся обязательной для продвижения retrieval, но это приёмка результата кода, а не отдельный проход ради проверок.
- [ ] Production Vite/browser Live2D E2E, clean-room recovery/rollback и final release gates остаются отдельными незакрытыми релизными препятствиями.

Общий project readiness score не изменён: синтетическая typo/inflection коррекция полезна, но независимый retrieval uplift не доказан.
