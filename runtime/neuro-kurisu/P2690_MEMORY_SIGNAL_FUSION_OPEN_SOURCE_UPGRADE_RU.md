# P2690 — Memory Signal Fusion / Open-Source Architecture Review

Дата: 2026-09-19

## Что принято

В canonical retrieval добавлен deterministic signal fusion без внешних runtime-зависимостей:

- semantic similarity;
- lexical/token overlap как lightweight BM25-like signal;
- entity overlap;
- temporal intent;
- causal-link support;
- recency;
- salience;
- identity relevance;
- goal relevance;
- prediction error;
- memory temperature.

Также retrieval audit теперь может фиксировать `touchedMemoryIds` в EventLog.

## Открытые исходники, которые реально повлияли на решение

1. Mem0 (`mem0ai/mem0`): актуальная OSS-документация описывает multi-signal hybrid retrieval с semantic + BM25/keyword + entity matching; temporal reasoning выделен как отдельный ranking signal. Мы перенесли сам принцип fusion, но оставили mobile-safe deterministic implementation без spaCy/vector-store dependency.

2. A-MEM (`agiresearch/A-mem`): динамическая организация памяти, linking и memory evolution подтвердили полезность graph-like связи между memory units. Мы уже имели semantic/temporal/causal links, поэтому не копировали внешний datastore, а расширили доказательность retrieval.

3. Neo4j Agent Memory (`neo4j-labs/agent-memory`): `:TOUCHED` audit edges, TraceOutcome, buffered writes, consolidation primitives и eval harness — полезный шаблон для разделения retrieval/causal evidence/consolidation. В проект перенесена идея явных touched IDs и bounded audit evidence без Neo4j.

4. Letta: stateful agent + persistent memory/identity остаются полезной архитектурной референсной точкой, но дополнительные runtime layers P2690 оттуда не копировались, чтобы не ухудшать mobile footprint.

## Что сознательно не внедрено

- полноценная BM25 database;
- внешний graph database;
- LLM-driven memory rewrite на каждом encode;
- дополнительный embedding model в mobile hot path;
- тяжёлый reranker.

Причина: проекту сейчас важнее доказуемая causal/temporal continuity и устойчивый Termux runtime, чем рост latency и RAM.

## Controlled result

P2690 synthetic holdout: 7 queries, multi-signal fusion top-1 = 7/7, semantic-only = 5/7. Улучшение +2 correct retrievals на этом тесте. Результат не следует трактовать как универсальный benchmark gain.

## Следующий научный этап

Нужно перейти от hand-tuned weights к online-but-bounded policy selection между несколькими retrieval policies, используя delayed causal credit из P2688 и independent holdout.

Источники:
- https://github.com/mem0ai/mem0
- https://github.com/agiresearch/A-mem
- https://github.com/neo4j-labs/agent-memory
- https://github.com/letta-ai/letta-code
