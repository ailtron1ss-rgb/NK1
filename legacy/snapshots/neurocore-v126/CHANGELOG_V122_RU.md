# NeuroCore V122 — Changelog

## Реальная работа

- Добавлен `UnifiedSparseAssociativeMemory` внутрь единственного canonical recurrent owner.
- Состояние памяти является явным runtime state; скрытый Python-cache не используется.
- Product-key routing даёт 32×32 = 1024 физические слоты при 4 routed candidates на чтение/запись.
- Write rule разделяет erase/write каналы и использует bounded delta update.
- Полный проход decay по всему банку заменён на lazy aging по реально затронутым слотам.
- Добавлена совместимость: V121 dense runtime state принимается и расширяется нулевым sparse-state при явном включении кандидата.
- Запрещено одновременное включение старого standalone product-key owner и V122 unified sparse owner.
- Добавлен набор delayed-recall, amplitude-aware, isolation, checkpoint и lazy-sweep тестов.
- Добавлен reproducible `scripts/bench_v122_memory.py`.

## Важные отрицательные результаты

- Collision-aware admission с текущей эвристикой ухудшает direct recall на задержках 128–2048 относительно базовой sparse write policy. Поэтому он остаётся candidate-only.
- Увеличение capacity улучшает long-horizon retention, но после насыщения банка всё ещё проявляются collision/interference и decay.
- Lazy aging убирает глобальный decay sweep, но текущий Tensor-state API всё ещё требует full-bank state materialization/copy. Поэтому кандидат пока не считается mobile-efficient.

## Qualification

- Current suite: **64/64 PASS**.
- `verify_current`: PASS.
- Compileall: PASS.
- Candidate parameter count: **3112**.
- Candidate integrated runtime state: **10305 floats** (dense 64 + sparse 10241).
- Candidate checkpoint strict load: 0 missing / 0 unexpected.
