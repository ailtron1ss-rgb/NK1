# PASS 11 — research-to-code notes

Дата: 2026-09-29

## 1. Efficient recurrent substrate

Актуальная ветка state-space research уже дошла до Mamba-3. Официальный `state-spaces/mamba` README одновременно показывает Mamba, Mamba-2/SSD и Mamba-3. Для Neuro-Kurisu сейчас не добавляется тяжёлая Python/CUDA dependency: текущий проект сознательно остаётся zero-dependency TypeScript/Node и рассчитан на Termux.

Что переносим как принцип: компактное persistent recurrent state, hardware-aware execution и разделение persistent state от expensive transient work.

Source: https://github.com/state-spaces/mamba

## 2. Long-term memory

Mem0 (April 2026 open-source release notes) усиливает multi-signal retrieval через semantic + BM25 + entity linking + temporal reasoning. A-MEM использует динамическую организацию и связывание memories. Neuro-Kurisu уже имеет multi-signal retrieval, temporal validity, revision chains и causal links, поэтому копирование ещё одного retrieval layer сейчас было бы дубликатом. Следующий полезный перенос — forgetting/obsolescence evaluation, а не новый storage layer.

Sources:
- https://github.com/mem0ai/mem0
- https://github.com/agiresearch/A-mem
- https://arxiv.org/abs/2604.20006

## 3. Offline consolidation

Sleep-time Compute (2025) показывает, что часть рассуждения выгодно амортизировать offline до следующего запроса. Это подтверждает направление существующего OfflineConsolidation, но требует query-predictability/utility gating, чтобы не превращать consolidation в бессмысленное фоновое расходование батареи.

Source: https://arxiv.org/abs/2504.13171

## 4. Кодовая интеграция PASS 11

В этом проходе исследование не использовано для декоративного добавления нового слоя. Оно привело к двум архитектурным решениям:

1. Host performance pressure отделён от cognitive semantics.
2. Mobile measurement разделён на retention и serialization stress.

Это сохраняет zero-dependency/mobile design и уменьшает риск ложных PASS.
