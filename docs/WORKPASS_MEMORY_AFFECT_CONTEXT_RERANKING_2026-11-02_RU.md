# NK1 — Эмоционально-контекстное ранжирование семантической памяти

**Дата:** 2026-11-02  
**Ветка:** `aspect/memory-affect-context-reranking-20261102`  
**PR:** #672  
**Базовая линия:** `workpass70-source` — `608435493b4af3b4a222d385f1b77d978d18583b`

## Найденный разрыв

В `MemoryOS2.previewRetrieveWithEmbeddings()` исходная семантическая оценка учитывала embedding similarity, lexical rank, token coverage, entity overlap, temporal hint и небольшой salience-сигнал. При этом эмоциональная значимость, личностная релевантность, связь с текущими целями, социальная значимость, prediction error и confidence не участвовали в финальном семантическом ранжировании.

Следствие: семантически похожее воспоминание могло вытеснить более значимый для текущей личности или цели опыт, даже когда оба находились рядом по смысловой релевантности.

## Реализация

Добавлен чистый модуль `MemorySemanticReranker.ts`:

1. **Semantic preselection.** Сначала кандидаты сортируются по уже существующей семантической оценке. Для выдачи размера N рассматривается ограниченный пул до min(64, 4×N), но не меньше N.
2. **Contextual reranking.** Только внутри пула применяется bounded metadata score:
   - salience — 20%;
   - emotionalWeight — 22%;
   - identityRelevance — 18%, усиление текущим identity demand;
   - goalRelevance — 18%, усиление текущим goal demand;
   - socialRelevance — 8%;
   - predictionError — 7%;
   - confidence — 7%.
3. **Semantic dominance.** Итоговая оценка: 88% исходного semantic score + 12% metadata score.
4. **Context gating.** Identity и goal relevance имеют небольшой baseline; активный запрос к соответствующему измерению увеличивает только его вклад.
5. **Safety/determinism.** Нечисловые, бесконечные и выходящие за диапазон сигналы нормализуются; порядок стабилен при одинаковом наборе кандидатов.

Это не новая память и не второй retrieval engine: модуль только меняет порядок уже найденных MemoryOS2 кандидатов.

## Проверки

Новый тест `tests/memory-semantic-affect-reranking.mjs` покрывает:

- эмоциональная значимость переупорядочивает близкие по семантике воспоминания;
- identity demand усиливает autobiographical/identity evidence;
- goal demand усиливает воспоминания, связанные с активными целями;
- эмоционально насыщенный, но нерелевантный кандидат не вытесняет сильное семантическое совпадение;
- дальние кандидаты не проходят semantic preselection только из-за высокого metadata score;
- malformed values не создают NaN/Infinity в итоговом ранге;
- одинаковые входы дают одинаковый порядок.

Тест включён в `test:rebuild-recovered` и `nk1-unified-organism-runtime.yml`, рядом с существующей semantic retrieval regression.

## Исследовательское основание

- [PsychoAgent: An Affect-Sensitive Cognitive Architecture for Conflict-Aware Memory in LLM Agents](https://arxiv.org/html/2608.07438v2) описывает семантический preselection affective memories с последующим salience reranking. В NK1 используется только эта узкая идея; отдельные memory stores и psychoanalytic controller не копируются.
- [Selective Memory for Artificial Intelligence: Write-Time Gating with ...](https://arxiv.org/html/2603.15994v1) рассматривает novelty, emotional salience и goal relevance при отборе для консолидации. Это поддерживает разделение write-time consolidation и read-time contextual reranking.
- [Synapse: Empowering LLM Agents with Episodic-Semantic Memory via Spreading Activation](https://arxiv.org/html/2601.02744v3) мотивирует ограниченное распространение релевантности по связям, но graph spreading в этом PR не внедряется, чтобы не дублировать существующий SemanticMemoryGraph.

Публикации — исследовательские источники, не доказательство улучшения NK1. Фактическое улучшение должно быть подтверждено отдельным RU/EN holdout, парными запросами и независимыми seed.

## Ограничения

- Не изменяются schema, persisted snapshots, embeddings provider, MemoryFabric owner или storage adapter.
- Не добавляется новый эмоциональный store.
- Изменение пока проверяется CI; реальный memory uplift не заявляется.
- Release ZIP, `main`, мобильная сборка и production DB не изменялись.
