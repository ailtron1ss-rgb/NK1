# Neuro-Kurisu R14 — Memory Transfer / Hybrid Retrieval / Continuity

## Результат

R14 завершает второй крупный слой переноса идей `memo-0.3.0` и современных memory systems в существующий canonical `MemoryOS2`.
Второй memory database/runtime не создан.

### Перенос Memo — ~82% выбранной полезной поверхности

- Content-addressed identity: 100%
- canonicalization + exact/semantic dedup: 100%
- reconciliation / compatibility import: 100%
- runtime context: 100%
- persistent integration: 100%
- hybrid retrieval: 100% адаптирован
- entity-aware graph recall: 100% адаптирован
- contradiction/revision layer: 100% базовый механизм
- decay/forgetting lifecycle: существующий механизм усилен, адаптация продолжается
- MCP memory API: 0%
- human-readable vault projection: 0%

Процент относится к отобранной полезной поверхности Memo, а не к проекту в целом.

## Что добавлено

1. BM25 + dense semantic + entity + temporal/causal fusion.
2. RRF-inspired rank blending без внешней зависимости.
3. identifier-aware lexical bias для точных кодов/ID/версий.
4. bounded one-hop traversal по существующим semantic/causal links вместо отдельной graph DB.
5. contradiction links для высокосходных записей с общими сущностями и противоположной negation polarity.
6. lazy vector materialization для cold-memory candidates.
7. корректный document-frequency accounting при restore/eviction/maintenance.
8. публичный `OrganismCore.snapshot()` теперь синхронизирует live `neuralExperienceBranch` и B269 перед projection, устраняя restart divergence из обычного snapshot.

## Исследовательская адаптация

Mem0 в актуальной документации описывает объединение semantic, BM25 и entity signals и entity-based graph recall; Microsoft GraphRAG использует entities/relationships как retrieval structure. В R14 эти идеи встроены в существующие bounded maps/links проекта, без внешнего graph runtime.

Источники:
- https://github.com/mem0ai/mem0/blob/main/docs/platform/features/graph-memory.mdx
- https://github.com/mem0ai/mem0/blob/main/docs/migration/oss-v2-to-v3.mdx
- https://microsoft.github.io/graphrag/index/methods/

## Проверка

- typecheck: PASS
- architecture: PASS, cycles=0, missing=0
- ownership: PASS, directConstructors=5
- hygiene: PASS
- syntax: PASS
- forensics: PASS, empty=0, duplicateContent=0, duplicateNames=0
- integrity: PASS
- release contract: PASS
- release source: PASS
- archive manifest: PASS, 3971/3971
- R5 memory authority: PASS
- R13 Memo integration: PASS
- R14 hybrid memory: PASS
- P2841/P2842 migrations: PASS
- P2854 restart: PASS
- P2855 contextual/integration: PASS
- P290 reality/world hotpath: PASS
- upstream replay/P30/neuromod: PASS
- restart persistence: PASS
- mobile 256MB benchmark: PASS

## Memory benchmark

1600 memories, 100 retrievals:
- p50: 1.32 ms
- p95: 5.91 ms
- max candidate set: 175/192
- total results: 800

Mobile benchmark:
- 30 cycles
- elapsed: 14.20 s
- p50: 458.9 ms
- p95: 574.4 ms
- max cycle: 837.4 ms
- max V8 heap: 139.3 MB
- max RSS: 320.7 MB

## Текущая оценка проекта

- Core architecture: 85/100
- Memory: 82/100
- Persistence/continuity: 86/100
- Continual learning: 63/100
- World model: 60/100
- Neural substrate: 49/100
- Autonomy: 63/100
- Self/identity: 66/100
- Behavioral evidence: 18/100
- Overall engineering maturity: ~61/100
- Readiness for target autonomous artificial personality: ~46/100

Semantic evidence remains the key bottleneck and is intentionally not inflated by this pass.
