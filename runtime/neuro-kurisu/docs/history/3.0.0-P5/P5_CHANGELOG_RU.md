# P5 ChangeLog — 2026-08-25

## Архитектура

- Версия повышена до `3.0.0`.
- Organism Core повышен до `6.0.0-research`.
- State schema повышена до `7`.
- P4 documentation moved to `docs/history/2.0.0-P4/`.
- Release audit разделён на быстрый `release:audit` и тяжёлый `research:all`.
- Добавлен локальный Node type-shim; runtime dependency tree остаётся пустым.

## P5

- собственные проекты;
- agency deliberation;
- bounded value evolution;
- identity trajectory;
- autobiographical narrative;
- matched-lesion lab;
- restart-safe persistence of P5 state;
- migration 6 -> 7.

## Исправления

- устранён конфликт legacy P3 value-plasticity с canonical P5 value evolution;
- исправлено сохранение linked goal для self-project;
- evidence project теперь учитывает релевантное действие, а не только совпадение `goalId`;
- identity trajectory хранит anchors для restart continuity;
- исправлен lifecycle P5 test runtime (`stop()` после restart smoke);
- тяжёлые research labs исключены из обязательного release gate.
