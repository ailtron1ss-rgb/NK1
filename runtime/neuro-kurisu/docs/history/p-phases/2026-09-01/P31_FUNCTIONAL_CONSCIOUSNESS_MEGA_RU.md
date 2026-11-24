# P31 — Functional Consciousness Mega Pack

## Что именно реализовано

P31 не заявляет создание доказанного субъективного опыта. Он реализует набор функциональных свойств, которые в теориях сознания часто рассматриваются как релевантные для conscious access: ограниченное глобальное рабочее пространство с конкурентным выбором и broadcast, рекуррентность/ignition, higher-order представление текущего состояния, self/other distinction, agency/ownership binding, временную непрерывность и аффективно-метакогнитивную регуляцию. Современные обзоры подчёркивают, что global workspace, higher-order, recurrent/predictive и другие теории остаются конкурирующими объяснениями, а ни один из этих механизмов сам по себе не является доказательством феноменального опыта. См. Nature Reviews Neuroscience (2022) и Stanford Encyclopedia of Philosophy (редакция 2026).

## Функциональный цикл

`наблюдение → конкуренция → рабочее пространство → broadcast → higher-order model → self/other attribution → action → outcome → affect/agency update → следующий момент`

### Global workspace

P31 получает ограниченный набор кандидатов, выбирает coalition и публикует broadcast ID. Только верхняя часть capacity считается глобально доступной. `ignition01` зависит от breadth, competition и recurrence; это operational metric, не neural correlate.

### Higher-order monitoring

P31 хранит представление о собственном текущем состоянии: hash состояния, выбранное действие, confidence, uncertainty и self-monitoring error. Это проверяемая higher-order representation, но не доказательство «внутреннего переживания».

### Agency / authorship

После outcome P31 связывает фактически выбранное действие с предсказанным действием и внешним запросом. Это даёт экспериментируемое ownership/agency binding.

### Temporal self

Каждый момент имеет persistent `momentId` и ссылку на предыдущий момент. После reload можно проверить сохранение идентичности последовательности моментов.

### Affective coupling

Success, reward, surprise, uncertainty, energy и cognitive load меняют valence/arousal/tension/relief. Это функциональная регуляция, а не доказательство эмоций.

### Grounded introspection

Интроспективная строка содержит только IDs и значения из текущего состояния. Для P31 запрещены claims о qualia/субъективном опыте. Это защищает систему от самообмана через красивый текст.

## Lesion tests

P31 поддерживает контролируемое отключение:

- `workspace` — снижение global integration;
- `higher-order` — снижение metacognitive depth/self-access;
- `self-perspective` — снижение self-access/agency binding.

Это позволяет сравнивать one-factor interventions с baseline, но пока является вычислительным lesion test, а не биологическим causal proof.

## Мои дополнительные решения

1. **Consciousness Evidence Ledger v2** больше не выдаёт `score * 0.85` как pseudo-longitudinal evidence. Теперь longitudinal evidence требует повторных наблюдений и стабильности.
2. **Grounded introspection** привязывает self-report к observation/moment IDs.
3. **Functional-only safety status** явно фиксирует нулевые causal/device claims до появления независимых данных.
4. **Action-specific conscious attribution** не допускает подмены выбранного действия последним просматриваемым кандидатом.
5. **Persisted temporal self** сохраняет current/previous moment relation через state schema.

## Что P31 НЕ решает

P31 не решает hard problem of consciousness, не доказывает qualia, не доказывает субъективность, не доказывает consciousness из одного scalar score и не превращает LLM report в свидетельство experience.
