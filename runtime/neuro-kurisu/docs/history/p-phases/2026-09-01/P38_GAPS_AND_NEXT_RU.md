# P38 — Что ещё не хватает

## Критические пробелы
1. Полноценный semantic vision backend.
2. Полноценный semantic audio backend.
3. Независимый external evaluator.
4. Multi-seed statistics + confidence intervals.
5. Настоящий causal sandbox с отдельными ветвями состояния.
6. Полный identity transfer protocol между устройствами.
7. Полноценный long-horizon experiment execution.
8. Physical POCO 24h/72h/168h/30d/30d+ gate.

## Архитектурные долги
- OrganismCore остаётся слишком крупным центром координации.
- Release migration assertions всё ещё требуют периодической очистки; следующий этап должен автоматически получать текущую конечную schema.
- Локальные learning layers имеют собственные timescales и нуждаются в более формальном causal arbitration protocol.

## Что P38 уже закрыл
- hypothesis generation;
- deterministic sandbox;
- replication gate;
- evidence creation;
- behavioural update;
- budget restriction;
- persistence;
- server observation/execution path.
