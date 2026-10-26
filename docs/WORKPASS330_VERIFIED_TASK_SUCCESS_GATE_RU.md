# WorkPass330 — жёсткий порог проверенного успеха задачи

**Дата:** 2026-10-26  
**Ветка:** `fix/cognitive-interrupt-severity-normalization-2026-10-25`  
**Коммиты:** `c180e9afbfb54c4ee5ec5566d74e54b990b78cf6`, `a7e0c0f9d16b52065c1c1d57f6a90a9d8f9b0aee`

## Дефект

В `SkillLearnBenchAdapter.evaluateSkillLearnBenchCandidate` доля независимо подтверждённых успешных задач ниже 0.80 выдавала feedback, но не меняла `eligible`. При этом совокупный балл складывается из task success (50%), trajectory quality (30%) и skill quality (20%). Поэтому кандидат мог компенсировать провал задач высокими структурными оценками и всё же получить `eligible=true`.

Это опасная рекомендация для продвижения навыков: качество траектории и покрытие возможностей полезны для диагностики, но не заменяют успешное выполнение проверяемой задачи.

## Изменения в коде

- Добавлена опция `minimumValidationTaskSuccess01`, default `0.80`.
- Порог валидируется как конечное число в диапазоне [0, 1].
- Если macro-average independently verified validation task success ниже порога, добавляется hard-gate причина `validation-task-success-below-threshold`; кандидат становится не eligible независимо от совокупного прироста.
- Существующее сообщение feedback теперь явно указывает на promotion threshold.
- Обязательная регрессия в `tests/p29-hermes-reflective-candidate-gate.mjs` проверяет случай: кандидат с 50% успехом задач, но хорошими траекторией/skill quality, всё же получает отказ при стандартном пороге 80%.
- Проверяется и контролируемая настройка порога 50%, а также отказ при значении > 1.

## Границы и сохранённые инварианты

Это gate рекомендации, а не механизм активации: он не обходит signed evidence, независимого evaluator, untouched holdout, safety scanner, аутентифицированное approval или compare-and-swap в хранилище кандидатов.

Порог 80% — явная инженерная политика по умолчанию, согласованная с ранее отображавшимся порогом feedback; при необходимости deployment может установить другой измеримый target. Изменение не означает, что реальное обучение улучшилось — оно исправляет правило допуска по уже собранным оценкам.

## Валидация

**Состояние в этом проходе: IMPLEMENTED, CI NOT YET VERIFIED.** Исходник и тест сохранены в GitHub. Доступный инструмент проверки commit status и workflow runs не вернул записей для нового HEAD, а локальный runtime проекта в этом процессе не запускался. Поэтому нельзя заявлять PASS.

Необходимая команда в репозитории:

```sh
npm ci --prefix app --ignore-scripts --no-audit --no-fund
npm ci --prefix runtime/neuro-kurisu
npm --prefix runtime/neuro-kurisu run typecheck
npm --prefix runtime/neuro-kurisu run test:p29:hermes-reflective-candidate-gate
```

Workflows должны выполнять тест на точном PR HEAD с назначенным runner и реальными шагами. Job без шагов не подтверждает тест.

## Следующий этап

Нужен не ещё один синтетический score, а независимый task-family holdout: paired seeds для memory, tool-use и transfer, task-level pass/fail, safety violations, regression/forgetting и отдельные доверительные интервалы. Текущие нулевые приросты tool-use и transfer остаются ограничением; не повышать learning score до появления убедительных независимых результатов.

Production UI/Live2D/TTS, Android audio, длительный soak, license review и воспроизводимый release ZIP также остаются открытыми.
