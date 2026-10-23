# WorkPass404 — детерминированный bootstrap-интервал для развития навыков

## Что изменено

Введён новый utility `PairedSeedConfidence.ts`, который считает percentile bootstrap confidence interval для среднего изменения качества на парных seed. Реализация локальная, без новой runtime-зависимости. Для воспроизводимости используется явный seed, детерминированный PRNG, заданный уровень доверия и ограниченное число resamples.

В `IndependentSkillCandidateEvaluator.ts` оценка разбивает результаты по split и каноническому семейству. Внутри семейства повторные trials усредняются в пределах пары task/seed; затем score кандидата и baseline сопоставляются по одним и тем же seed. Для каждого seed считается family-wide delta с одинаковым весом каждой задачи, а bootstrap выполняется по этим парным deltas.

## Условие продвижения

- **Validation:** нижняя граница bootstrap-интервала для каждого достаточно обеспеченного семейства должна быть строго положительной. Одного положительного среднего недостаточно, если разброс показывает возможность отсутствия улучшения.
- **Holdout:** нижняя граница не должна пересекать отрицательный предел `maximumHoldoutFamilyRegression01`; исходные holdout-примеры и названия семейств не раскрываются оптимизатору.
- **Coverage:** интервал считается только когда есть установленное production-правилом количество общих paired seed у каждой задачи семейства. Missing/insufficient family evidence уже блокируется WorkPass400–403.
- **Reproducibility:** seed bootstrap зависит от стабильной идентичности плана, split и family, чтобы один и тот же evaluation давал одинаковый интервал.
- **Fail-closed:** пустые/нечисловые score, уровень доверия вне диапазона и некорректное число resamples/seed приводят к ошибке; параметры не нормализуются молча.

## Регрессионные проверки

- `workpass404-paired-seed-confidence.mjs` проверяет детерминированность, положительный интервал на одинаково позитивных deltas, шумный положительный mean с нижней границей ниже нуля, полностью отрицательный набор и некорректные входы.
- `workpass225-matched-independent-evaluation.mjs` проверяет интеграцию gate: семейство с тремя seed и устойчивым приростом проходит confidence-проверку; noisy family с положительным общим mean, но одним сильным adverse seed, отклоняется на validation и holdout confidence bounds.
- P26 Learning Validation имеет path-фильтры для новой реализации и unit-теста, отдельный шаг на Node.js 24 и уже включает WorkPass225 интеграционный тест.

## Исследовательская мотивация

[RLiable](https://github.com/google-research/rliable) рекомендует interval estimates, stratified bootstrap confidence intervals, IQM, performance profiles и вероятность улучшения вместо одних point estimates при небольшом числе запусков. [SkillLearnBench](https://arxiv.org/abs/2604.20087) подчёркивает, что результаты continual skill learning неоднородны между задачами и методами. [Hermes Agent Self-Evolution](https://github.com/NousResearch/hermes-agent-self-evolution) отделяет генерацию кандидата от проверок и продвижения.

Это адаптация принципов, а не импорт Python-пакета RLiable и не копирование Hermes runtime.

## Ограничения

- Percentile bootstrap при трёх seed — индикатор риска, а не окончательная оценка статистической значимости; нужно расширять число seed и task families.
- Требуется будущая оценка stratified-bootstrap корректности при разном числе задач/seed в семьях, а также IQM/probability-of-improvement и анализ стоимости вычислений.
- Код и тесты внесены в `feature/learning`, но я не заявляю об успешном выполнении: Actions jobs по-прежнему завершаются `failure` без списка шагов и доступных логов. Runtime/typecheck остаётся непроверенным.
- `main` и GitHub Release ZIP не менялись.