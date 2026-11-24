# WorkPass 28 — список дел (13.10.2026)

## Выполнено в этом проходе

- [x] Исправить потерю самостоятельных однозначных чисел в токенизации канонической MemoryOS2.
- [x] Согласовать токенизацию BM25-baseline с runtime policy.
- [x] Версионировать retrieval algorithm/tokenizer в конфигурационном fingerprint.
- [x] Добавить англо- и русскоязычные regression queries для числовых значений.
- [x] Убедиться, что числовое совпадение не возвращает expired memory в current mode.
- [x] Прогнать candidate coverage, BM25 benchmark и multi-seed experiment.
- [x] Обновить canonical backlog, release metadata и scorecard без искусственного повышения готовности.

## Осталось открытым

- [ ] Создать независимый размеченный temporal holdout на длинных диалогах; не обучать или настраивать по holdout.
- [ ] Сравнить на нём MemoryOS2 и Okapi BM25 по Recall@k, MRR, p95 latency и false recall.
- [ ] Реально собрать React/Vite production UI и провести browser/Live2D E2E.
- [ ] Закрыть clean-room recovery/rollback, soak, SBOM/provenance и release sign-off.

**Статус:** исправлена реальная retrieval blind spot; superiority/promotion не доказаны.
