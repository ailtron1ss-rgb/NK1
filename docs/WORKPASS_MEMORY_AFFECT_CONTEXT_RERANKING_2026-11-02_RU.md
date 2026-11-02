# NK1 — Эмоционально-контекстное ранжирование семантической памяти

**Дата:** 2026-11-02  
**Ветка:** `aspect/memory-affect-context-reranking-20261102`  
**PR:** #672 (Draft)  
**Базовая линия:** `workpass70-source` — `608435493b4af3b4a222d385f1b77d978d18583b`  
**Последний коммит:** `8cbf045a4498060d68d28d62e1afbdf77de3e1b7`

## Найденный разрыв

В `MemoryOS2.previewRetrieveWithEmbeddings()` исходная семантическая оценка учитывала embedding similarity, lexical rank, token coverage, entity overlap, temporal hint и небольшой salience-сигнал. Эмоциональная значимость, личностная релевантность, связь с текущими целями, социальная значимость и prediction error не участвовали в финальном семантическом ранжировании.

## Реализация

Добавлен чистый модуль `MemorySemanticReranker.ts` и подключён непосредственно к существующему `MemoryOS2` retrieval path. Новая память, schema, embedding provider или параллельный retrieval owner не создаются.

1. **Semantic preselection.** Сначала сортировка по исходному semantic/lexical score. Для выдачи N рассматривается ограниченный пул до `min(64, 4×N)`, но не меньше N.
2. **Contextual reranking.** Внутри пула используются salience (22%), emotionalWeight (26%), identityRelevance (18%), goalRelevance (18%), socialRelevance (8%) и predictionError (8%).
3. **Confidence semantics.** Confidence больше не является самостоятельным бонусом релевантности. Он работает как reliability gate для контекстных сигналов: низкая уверенность уменьшает влияние metadata, высокая не продвигает память сама по себе.
4. **Context gating.** Identity и goal relevance усиливаются только при соответствующем demand из текущего запроса; без него сохраняется ограниченный baseline.
5. **Semantic dominance.** Финальная оценка сохраняет 88% базовой semantic relevance и допускает не более 12% контекстного rerank.
6. **Input normalization.** Семантические оценки и similarity ограничиваются `[0,1]`; отрицательные/нечисловые lexical rank приводятся к детерминированному худшему рангу; пустые и чрезмерно длинные ID исключаются; повторяющиеся ID схлопываются с сохранением сильнейшего semantic кандидата.
7. **Determinism.** Стабильные tie-breakers по base score, similarity, lexical rank и ID.

## Проверки

Новый тест `tests/memory-semantic-affect-reranking.mjs` покрывает affective rerank, identity/goal demand, semantic preselection, защиту сильного semantic match, malformed values, confidence-only input, duplicate IDs, invalid lexical rank, score clamping и повторяемость порядка.

- **Локальный точечный прогон:** PASS на Node `v22.16.0`, `node --experimental-strip-types --test .../memory-semantic-affect-reranking.mjs` — 1 suite passed, 0 failed.
- **GitHub exact-head checks:** пока не возвращены для `8cbf045a4498060d68d28d62e1afbdf77de3e1b7`; CI остаётся PENDING / NOT VERIFIED.
- **Полный runtime typecheck и MemoryFabric semantic retrieval integration:** ожидают exact-head CI; локально в этом проходе не выполнялись.
- **Recall uplift / precision regression / 10k latency:** не измерялись; улучшение качества пока не заявляется.

## Исследовательское основание

- [PsychoAgent: An Affect-Sensitive Cognitive Architecture for Conflict-Aware Memory in LLM Agents](https://arxiv.org/html/2608.07438v2) — узкая идея semantic preselection с последующим affective salience reranking.
- [Selective Memory for Artificial Intelligence](https://arxiv.org/html/2603.15994v1) — novelty, emotional salience и goal relevance для отбора/консолидации.
- [Synapse: Empowering LLM Agents with Episodic-Semantic Memory via Spreading Activation](https://arxiv.org/html/2601.02744v3) — источник идей о распространении релевантности; graph spreading здесь не внедряется, чтобы не дублировать существующий SemanticMemoryGraph.

Публикации — исследовательские основания, не доказательство улучшения NK1. Фактический uplift должен подтверждаться RU/EN holdout, парными запросами и независимыми seed.

## Остаточные ограничения и следующие ворота

1. Получить зелёный exact-head CI: focused reranker, MemoryFabric semantic retrieval и runtime typecheck.
2. Проверить реальный путь provenance: EmotionAppraisal → memory encoding/MemoryFabric → MemoryOS2 persistence → contextual retrieval. Текущий PR использует уже сохранённые канонические поля и не заявляет закрытие всего appraisal-ingress пути.
3. Выполнить paired-seed RU/EN holdout и показать `recallDelta > 0` без ухудшения precision.
4. Измерить p50/p95 latency и ограничение top-K на корпусе 10k.
5. Только после независимых проверок рассматривать merge.

`main`, `workpass70-source`, production DB и опубликованный Release ZIP не изменялись.