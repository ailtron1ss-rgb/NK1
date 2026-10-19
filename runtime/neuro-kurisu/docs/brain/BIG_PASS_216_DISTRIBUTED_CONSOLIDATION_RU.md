# BIG PASS 216 — DISTRIBUTED MEMORY CONSOLIDATION

Дата: 2026-09-11

## Цель
Замкнуть восстановление памяти как распределённый процесс организма: эпизодическая память должна получать приоритет от неопределённости/ошибки/значимости, а procedural replay не должен искусственно проходить только через hippocampus.

## Реализация
- `MemoryConsolidationController` ранжирует кандидаты по salience, novelty, prediction error, uncertainty, outcome и recency.
- Маршруты: `hippocampal`, `cortical`, `procedural`, `defer`.
- `procedural` имеет отдельный путь, отражающий распределённую архитектуру replay.
- Состояние controller сохраняется и восстанавливается вместе с MemorySubsystemRuntime.
- Организм использует adaptive batch size и resource pressure при выборе replay/consolidation work.
- Atlas обновлён новой связью `basal_ganglia.selection -> sleep.replay`.

## Причинное доказательство
B216: high-uncertainty candidate priority = `0.851662`, low-information candidate = `0.126456`; procedural candidate получает route=`procedural`.

Это не доказывает биологическую эквивалентность. Доказывается полезная вычислительная функция: information-rich memories получают больше consolidation budget, а procedural memories не привязываются жёстко к hippocampal path.

## Регрессии
B215 PASS: DG ablation separation `0.661954 -> 0.080385`; CA3 ablation completion `0.813453 -> 0.447399`; replay persistence `12`.
B214 PASS: thalamocortical closure/persistence.

## Научная рамка
Свежие данные Nature Neuroscience 2026 показывают, что hippocampal ripples координируются с cortical representations under predicted uncertainty, но отдельная работа 2026 года показывает hippocampus-independent procedural replay in dorsal striatum. Поэтому architecture намеренно распределённая, а не «hippocampus = весь replay».

Для continual learning используются также идеи uncertainty-aware plasticity и adaptive replay/consolidation, но проектные метрики остаются собственными и проходят causal/holdout/persistence проверки.
