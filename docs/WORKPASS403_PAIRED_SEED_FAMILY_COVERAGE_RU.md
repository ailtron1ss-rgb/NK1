# WorkPass403 — воспроизводимость по парным seed внутри семейств навыков

## Зачем нужен ещё один уровень gate

WorkPass402 требует, чтобы validation и holdout содержали как минимум одно каноническое семейство с двумя разными задачами. Это защищает от completely unlabeled eval, но само по себе не даёт свидетельств воспроизводимости: каждая из двух задач может быть выполнена только при одном seed. Для promotion, меняющего постоянную версию навыка, это слишком слабая основа.

## Реализация

В `IndependentSkillCandidateEvaluator.ts` добавлен отдельный `IndependentEvaluationFamilySeedCoverageOptions`, который отделён от обычной эвристической оценки отчётов. Он принимает:

- `minimumValidationFamilySeeds`
- `minimumHoldoutFamilySeeds`

Comparator уже связывает отчёты с проверенными execution bindings, проверяет совпадение baseline/candidate по task, trial, seed, split, environment и plan. На этой доверенной границе seed coverage рассчитывается по candidate reports так:

1. Семейство берётся из evaluation report; не выводится из имени задачи.
2. Несколько повторов одной задачи собираются в множество seed.
3. Для каждого семейства берутся только семьи с необходимым числом различных задач.
4. Засчитываются только seed, присутствующие у каждой задачи данного семейства (пересечение sets), поэтому разные единичные seed у разных задач не создают ложного впечатления общего повторения.
5. Если в строгом режиме нет ни одного пригодного семейства, проверка также закрывается отказом.
6. Invalid/non-integer minima и значения выше верхней границы отвергаются.

Comparator сообщает число проверенных семейств, семейств с достаточным seed coverage и число проблем покрытия по обоим split. Имена семейств и исходные holdout-примеры не передаются optimizer feedback.

## Политика production promotion

`P23LearningEngine.approveIndependentlyEvaluatedSkillCandidate` теперь требует не только строгий family/task gate WorkPass402, но и **минимум три общих paired seed для каждого оцениваемого семейства на каждом split**. Порог фиксирован внутри promotion authority: генерируемый навык не может ослабить его собственными настройками.

Три seed — не доказательство статистической мощности и не универсальная нейронаучная константа. Это защитный минимум, чтобы activation не происходила по одиночному выполнению. До production-grade доказательств всё ещё необходимы большее число paired seeds, фиксированный canonical manifest, доверительные интервалы/оценка дисперсии и тесты на нескольких наборах задач.

## Регрессии

- `workpass225-matched-independent-evaluation.mjs`: в двух-сидовом сценарии validation и holdout показывают прирост и корректное семейное покрытие, но требование трёх общих seed блокирует оба split; сценарий с тремя общими seed проходит coverage gate.
- `workpass402-production-promotion-family-gate.mjs`: фактический P23 promotion entry point отвергает двух-сидовый candidate даже когда диагностический общий score допустим; счётчик вызовов store approval остаётся нулём.
- P26 path filter и Node.js 24 workflow уже включают эти тестовые файлы.

## Исследовательская основа

[SkillLearnBench](https://arxiv.org/abs/2604.20087) подчёркивает многоосевую оценку и неоднородность выигрышей между задачами/поддоменами; [CleanRL](https://docs.cleanrl.dev/) вдохновляет воспроизводимые сравнения на фиксированных условиях и нескольких seed; [Hermes Agent Self-Evolution](https://github.com/NousResearch/hermes-agent-self-evolution) поддерживает отделение генерации кандидата от независимой проверки и продвижения. NK1 адаптирует эти принципы к уже существующему P23 evidence pipeline без нового runtime dependency.

## Статус проверки

Код, регрессии, P26 wiring и документация находятся в `feature/learning`. Я не утверждаю, что скрипты прошли выполнение: доступные GitHub Actions runs завершаются `failure`, а jobs не предоставляют шагов/логов. До получения действительных execution logs статус остаётся **runtime-unverified**. `main` и Release ZIP не менялись.
