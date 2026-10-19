# NeuroCore V121 — Foundations

V121 — инженерный проход по качеству current-trunk, а не добавление коллекции новых модулей.

## Реально изменено

- Исправлен adaptive compute: дорогая deep-ветка теперь выполняется только для выбранных строк batch, а fraction-policy действительно ограничивает deep fraction.
- Исправлено хранение routing key в event-bank: explicit `credit_key` теперь является фактически сохраняемым/обновляемым ключом слота.
- `state_activation_mode` подключён к реальному forward-path; `mamba3_heavy_tail` остаётся candidate и не меняет default.
- Добавлен `token_decay` как изолированный candidate input-dependent channel-wise decay; он не включён в default.
- Добавлены V121 foundation tests, включая execution-level проверку sparse adaptive branch.

## Что не было promoted

`token_decay` не показал net gain на matched probe: удержание и учебная динамика не улучшились относительно baseline. Поэтому механизм оставлен candidate-only до более сильной long-horizon/continual-learning проверки.

## Quality policy

Candidate не становится частью default только из-за новизны или похожести на upstream. Требуются matched baseline, ablation, multi-seed, stress/interference и resource evidence.
