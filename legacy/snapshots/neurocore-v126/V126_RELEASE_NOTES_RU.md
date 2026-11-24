# NeuroCore V126 — Consolidation Runtime + Decontamination

## Реальная работа

1. Добавлен настоящий opt-in fast→slow consolidation в canonical trainer (`interval_steps`).
2. Инертная комбинация consolidation без online fast-synapse запрещена конфигурацией.
3. Sparse-state write переписан на функциональный sparse-delta update без небезопасного in-place autograd-пути.
4. Production и qualification используют один canonical sparse `read_only()` путь; отдельная копия memory read logic удалена.
5. Добавлена runtime-liveness qualification automatic consolidation.
6. Версия проекта сведена к одному source of truth (`src/neurocore/version.py`); package, current frontier и checkpoint metadata синхронизированы.
7. Старый V97 consolidation benchmark перенесён в history и больше не является current API surface.
8. Anti-decoration audit дополнен проверками runtime state change, конфигурационной жизнеспособности и truthful registry.

## Qualification

- current tests: **95/95 PASS**
- compileall: **PASS**
- verify_current: **PASS**
- checkpoint: **108/108 tensors**
- executable AST stubs: **0**
- inert enabled-config checks: **PASS**
- registry truthfulness: **PASS**
- gradient probe: **61/61 tensors; 69 137/69 137 elements**
- wheel: **1.26.0 успешно собран**

## Runtime evidence

В 3-seed automatic consolidation probe opt-in режим дал **2 consolidation events на 10 optimizer steps**, с максимальным blend около **0.08** и сбросом fast-state после promotion. Это доказывает реальное исполнение механизма, но не его task-level superiority.

Sparse runtime V126 измерен на текущей среде; универсальный speedup не заявляется.

## Promotion

Fast/slow consolidation, unified sparse memory и key fingerprint остаются **candidate-only** до matched continual-learning advantage.

## Следующий фронт

**V127 — Collision-Resistant Memory + Segmented Sparse Runtime + Continual-Learning Gate.**
