# NeuroCore V126 — Current Status

## Реальное состояние current

- Current release: **V126 / 1.26.0 / `v126-consolidation-runtime`**
- Current tests: **95/95 PASS**
- compileall: **PASS**
- verify_current: **PASS**
- checkpoint round-trip: **108/108 tensors; 0 missing; 0 mismatch; 0 unexpected**
- executable AST stubs: **0**
- inert enabled-config checks: **PASS**
- registry truthfulness: **PASS**
- canonical recurrent owners: **1**
- trainable parameters: **69 137**
- gradient probe: **61/61 trainable tensors and 69 137/69 137 trainable elements finite + non-zero**
- upstream research catalog: **53**
- wheel: `neurocore_frontier-1.26.0-py3-none-any.whl`

## V126 — что реально сделано

1. Fast→slow consolidation получил настоящий opt-in путь внутри canonical trainer через `interval_steps`.
2. Инертная конфигурация `consolidation.enabled=True` без `online_plasticity.enabled=True` теперь отклоняется.
3. Sparse-memory write переведён на функциональный additive sparse-delta update: без небезопасных in-place операций и без серии независимых clone/concat состояний.
4. Qualification больше не содержит отдельной копии sparse-memory read logic: benchmark использует production `read_only()`.
5. Автоматическая consolidation проверена runtime-инъекцией; в 3-seed probe — **2 события на 10 optimizer steps** при opt-in режиме.
6. Version metadata сведена к единому source of truth (`src/neurocore/version.py`); package/current/checkpoint/frontend metadata больше не расходятся по версиям.
7. Устаревший V97 consolidation benchmark вынесен в `history/legacy_benchmarks`, а current qualification использует canonical V126 benchmark.
8. Decontamination расширена runtime-liveness проверкой consolidation и проверкой отсутствия исполняемых заглушек.

## Что не считается доказанной победой

Fast→slow consolidation, unified sparse memory и key fingerprint остаются **candidate-only**. Сам факт изменения slow weights, памяти или состояния не считается доказательством полезности. Нужен matched continual-learning gain при контролируемой стоимости.

Functional sparse-delta write — реальное исправление пути исполнения, но это **не** доказанный universal speedup: текущий flat-state runtime всё ещё материализует значительный sparse-state tensor.

## Главные ограничения

- long-horizon end-to-end learning всё ещё слабее изолированного memory recall;
- sparse memory пока дороговата для маленьких CPU batch;
- collision/interference требует дальнейшей адресации и admission-работы;
- быстрый и медленный plasticity-контуры ещё не доказали превосходство на continual tasks;
- `target_confidence` остаётся внутренней error-derived метрикой, а не полноценной calibration guarantee.

## Anti-decoration verdict

Для current surface: **исполняемых stub-сигналов не найдено**.

Reference-only механизмы явно помечены как `research_reference`; registry не выдаёт их за локальные реализации.

Особенно проверяются: реальные state changes, gradient connectivity, configuration liveness, single-owner invariants и shared production/qualification read paths.

## Evidence

- `evidence/V126_TESTS.txt`
- `evidence/verify_current_V126.txt`
- `evidence/V126_CHECKPOINT.txt`
- `evidence/V126_DECONTAMINATION.json`
- `evidence/V126_CONSOLIDATION_RUNTIME.json`
- `evidence/V126_SPARSE_RUNTIME.json`
- `evidence/V126_GRADIENT_COVERAGE.json`
- `evidence/V126_SPARSE_GRADIENT_LIVENESS.json`
- `evidence/V125_COLLISION_PROBE.json`

## Следующий проход

**V127 — Collision-Resistant Memory + Segmented Sparse Runtime + Continual-Learning Gate**.

Приоритет: реальный end-to-end выигрыш памяти и plasticity при снижении CPU/memory overhead. Новые механизмы не продвигаются без ablation и matched controls.
