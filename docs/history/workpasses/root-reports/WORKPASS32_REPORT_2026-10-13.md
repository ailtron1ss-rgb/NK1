# WorkPass32 — гибридный retrieval MemoryOS2 — 13.10.2026

## Изменения кода

1. `MemoryOS2.ts`: построен и поддерживается ограниченный inverted index символьных триграмм токенов. Fuzzy candidate discovery использует общие триграммы и строгий порог Dice similarity, топ-8 похожих токенов на query-term и существующий предел 192 кандидата.
2. Запросы с опечатками/словоформами могут попадать в кандидатный набор без полного сканирования корпуса. Перестроение индекса работает после encode, забывания, вытеснения и snapshot restore; `indexDiagnostics()` теперь проверяет и character-gram postings.
3. Retrieval объединяет пять независимых рангов: BM25, покрытие точных токенов, fuzzy similarity, сущности и graph/temporal relationship. Списки рангов исключают нулевые сигналы; это предотвращает скрытый порядок по ID у не совпавших каналов.
4. 48-мерный hash-token vector больше не участвует в финальном fusion как «семантическое» сходство. `MemorySignalFusion` перераспределяет недоступный embedding weight на lexical match quality. Diagnostics явно показывают `semanticEmbeddingProvider=none`.
5. Runtime package/lock согласованы на `35.55.0`; root version `32.0.0-super-final18`; persisted schema остаётся `224`, поскольку хранимый формат записи не менялся и новый индекс восстанавливается из канонической памяти.

## Результаты

- `npm run audit:workpass32` — PASS (runtime typecheck, fuzzy test, candidate coverage, numeric terms, multi-seed retrieval experiment, lifecycle replay, provenance lineage, HTTP smoke).
- `tests/p2691-adaptive-memory-policy.mjs` — PASS.
- `tests/p2690-memory-signal-fusion.mjs` — PASS: hybrid 7/7, legacy lexical-only alias 6/7 in a 7-case controlled fixture.
- Fuzzy regression: English misspellings and Russian inflection/spelling variants return target at rank 1; index remains coherent after delete and restore.
- Offline multi-seed experiment remains `not-promoted`; it uses tiny synthetic labelled fixtures and is not evidence of production quality uplift.

## Нет заявлений сверх результата

Настоящий embedding backend и independent temporal holdout не реализованы/не проведены в этом pass. Это лучшее локальное fuzzy/hybrid lexical retrieval, а не semantic vector search. Vite production build, browser/Live2D E2E, clean-room rollback/soak, live NLI inference/provider and release sign-off remain open.

## Финальная приёмка пакета (13.10.2026)

- Runtime `audit:workpass32`: PASS после финальных изменений.
- Root release metadata: 34/34; release-contract tests: 6/6.
- Server imports: PASS; Runtime Atlas UI/API linkage: 124 routes / 48 surfaces, no missing required seams; asset audit: 0 errors.
- App script tests: PASS; browser-smoke verdict: 51/51; atomic report publication: 4/4.
- Retrieval benchmark: PASS как эксперимент; recall delta = 0, confidence interval `[0, 0]`, promotion `not-promoted`. Текущая реализация не позиционируется как embedding-based semantic retrieval.
- Vite production build, browser/Live2D E2E, clean-room rollback/soak and independent temporal holdout remain open.
