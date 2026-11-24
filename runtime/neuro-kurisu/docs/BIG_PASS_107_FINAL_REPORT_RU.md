# BIG PASS 107 — Cognitive Research Battery / Reproducible Longitudinal Evidence

Версия: 34.81.0
State schema: 116

## Цель
Перевести longitudinal-экспериментирование из набора отдельных validation rows в воспроизводимую исследовательскую батарею без создания второго планировщика и без превращения внутренних метрик в «доказательство сознания».

## Реализовано

- preregistration capsule с детерминированным hash;
- protocol freeze через duplicate-proof идентификатор;
- seed/evaluator/release/state-schema capture;
- controlled delays, contexts, matched replay-on/off pairs;
- independent verification + holdout gates;
- negative-control phase/condition support;
- deterministic bootstrap 95% CI без внешней статистической зависимости;
- effect size, median difference и data-quality score;
- claim ladder: insufficient → exploratory → confirmatory-eligible → replicated/contradicted;
- повторяемость проверяется по независимым protocol IDs;
- нарушение evaluator/baseline provenance отклоняется;
- bounded persistent state и migration 115→116;
- Core API и release/audit tests.

## Что сознательно НЕ добавлено

Не добавлялся второй planner, скрытая самокоррекция результатов, автоматическая генерация task-score из внутренних метаданных, изменение canonical MemoryOS или автоматическое объявление сознания. Эти механизмы создали бы риск circular validation и самообмана.

## Научная граница
Встроенный synthetic test только проверяет механику батареи. Он не является эмпирическим доказательством того, что Neuro-Kurisu лучше запоминает, переносит знания или обладает сознанием. Для этого нужны реальные независимые task outcomes.

## Честный статус composite audit

Все целевые проверки Pass 107 завершены отдельно и имеют PASS. Полный `audit:pass107` как единый процесс превысил wall-clock budget на длинном operational этапе, поэтому aggregate result **не классифицируется как PASS**.
