# P25 — Scientific Development & External Evaluation

## Цель

P25 переводит организм от «обучение измеряется внутренними метриками» к проверяемому циклу:

`experience → learning → holdout → ablation → controlled evidence → longitudinal/device evidence`.

## Что реально добавлено

- `P25ScientificDevelopmentEngine` — единый реестр экспериментальных свидетельств.
- Runtime outcome aggregates — наблюдаемая статистика результатов по типам действий.
- Controlled experiments — сохраняют независимые control/treatment условия и измеренный эффект.
- External evaluation ledger — отдельные holdout/device/longitudinal/regression записи.
- Ablation studies — сравнение baseline и condition без выбранного механизма.
- Capability claims — уровень утверждения связан с уровнем фактических свидетельств.
- Research campaigns — долговременные кампании с привязанными evidence IDs.
- Server API — отдельные endpoint'ы для научных данных.

## Правила честности

1. Внутренний self-report не повышает уровень доказательности.
2. `observed` не является `controlled`.
3. `controlled` не является `longitudinal`.
4. `device-verified` разрешается только при реальном device-side тесте.
5. Отсутствие внешнего результата не заменяется предположением.

## Телефон

На POCO научные оценки не должны запускаться непрерывно. Используются holdout batches и offline consolidation, а результаты сохраняются пакетно.
