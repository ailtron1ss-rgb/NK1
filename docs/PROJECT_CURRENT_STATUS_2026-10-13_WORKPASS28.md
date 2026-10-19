# Нейро Курису — текущий статус WorkPass 28

**Дата:** 13 октября 2026 г.  
**Root:** `28.0.0-super-final14` · **Runtime:** `35.51.0` · **Schema:** `224`  
**Статус:** implementation-workpass — **не готов к выпуску**.

## Что улучшено в канонической MemoryOS2

- Удалён порядок-зависимый предел 96 IDs на posting list токена; индекс сохраняет все вхождения в существующем 1600-item corpus bound. Per-query candidate cap остаётся 192.
- Candidate priority использует IDF, ширину совпадения запроса, точную фразу, temporal validity, revision sequence, recency/salience и стабильные tie-breaks.
- Hashed-vector cosine больше не выдаёт ортогональным векторам бесплатную similarity 0.5.
- Benchmark сравнивает кандидат с настоящим corpus-scoped Okapi BM25 (`k1=1.2`, `b=0.75`); отчёт сохраняет baseline configuration и fingerprint.
- Добавлен `tests/memory-retrieval-candidate-coverage.mjs` для записи за прежним cutoff и независимости top-k от порядка snapshot.

- Токенизация сохраняет самостоятельные однозначные числа: `status 1`, задержки `0`, оценки/короткие числовые значения. Та же политика используется внутренним индексом, vectorize и BM25 benchmark; алгоритм явно версионирован в retrieval fingerprint.
- Добавлен regression для англо- и русскоязычных numeric queries; он также гарантирует, что совпадение числа не обходит temporal expiry.

## Что доказано и что нет

Runtime typecheck, temporal inspector, R16 memory behavior, candidate coverage, English/Russian numeric retrieval, BM25 benchmark, multi-seed experiment и real server smoke пройдены. После исправления tokenizer defect текущий 8-query synthetic fixture показывает Recall@5 `1.00` для MemoryOS2 и `1.00` для BM25, delta `0.00`, paired **Recall** interval `[0.00, 0.00]`. WorkPass27 отрицательный результат оказался конфундирован loss of standalone one-digit terms в обеих сторонах benchmark; его нельзя считать production estimate. Retrieval candidate остаётся not-promoted, так как преимущества не показано и независимой temporal holdout нет.

78 normalized deliverables остаются: 57 DONE / 11 PARTIAL / 10 TODO. Weighted implementation roadmap **72.30%** (без изменения; retrieval-проблема исправлена частично, отдельный release-gate не закрыт). Это не оценка интеллектa и не release readiness. Независимый temporal holdout, дальнейшее improvement retrieval, frontend production build/browser/Live2D E2E и durability/release gates остаются открытыми.


## Следующая реальная задача

Сохранить улучшения numeric matching и перейти к независимому размеченному temporal holdout на реальных длинных диалогах; не подгонять веса по holdout. Сравнивать Recall@k, MRR, latency и false recall против BM25, не продвигать изменение по одной синтетической выборке.
