# Нейро Курису — текущий статус WorkPass 27

**Дата:** 13 октября 2026 г.  
**Root:** `27.0.0-super-final14` · **Runtime:** `35.50.0` · **Schema:** `224`  
**Статус:** implementation-workpass — **не готов к выпуску**.

## Что улучшено в канонической MemoryOS2

- Удалён порядок-зависимый предел 96 IDs на posting list токена; индекс сохраняет все вхождения в существующем 1600-item corpus bound. Per-query candidate cap остаётся 192.
- Candidate priority использует IDF, ширину совпадения запроса, точную фразу, temporal validity, revision sequence, recency/salience и стабильные tie-breaks.
- Hashed-vector cosine больше не выдаёт ортогональным векторам бесплатную similarity 0.5.
- Benchmark сравнивает кандидат с настоящим corpus-scoped Okapi BM25 (`k1=1.2`, `b=0.75`); отчёт сохраняет baseline configuration и fingerprint.
- Добавлен `tests/memory-retrieval-candidate-coverage.mjs` для записи за прежним cutoff и независимости top-k от порядка snapshot.

## Что доказано и что нет

Runtime typecheck, temporal inspector, R16 memory behavior, BM25 benchmark, multi-seed experiment и real server smoke пройдены. Новый benchmark показывает **Recall@5 delta -0.25** для текущего MemoryOS2 относительно BM25 на маленьком 8-query synthetic holdout; paired-bootstrap interval `[-0.75, 0.25]`. Это отрицательный сигнал для имеющейся реализации, но не production estimate. Candidate не продвигается.

78 normalized deliverables остаются: 57 DONE / 11 PARTIAL / 10 TODO. Weighted implementation roadmap **72.30%**. Это не оценка интеллектa и не release readiness. Независимый temporal holdout, дальнейшее improvement retrieval, frontend production build/browser/Live2D E2E и durability/release gates остаются открытыми.
