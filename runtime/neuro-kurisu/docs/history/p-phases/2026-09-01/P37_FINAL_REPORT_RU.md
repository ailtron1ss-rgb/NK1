# P37 Final Report — Semantic Sensorium & Embodied World

## Практический эффект
P37 сделал perception не одноразовым событием, а bounded временной системой: объекты и события сохраняются как tracks, сенсоры имеют reliability/freshness/conflict, есть spatial self, body/world coherence и active-perception queue. Результат используется в action ranking и сохраняется.

## Что добавлено
- persistent entity tracks;
- bounded event tracks;
- cross-modal conflict;
- sensor-health model;
- object permanence;
- spatial self-state;
- body/world coherence;
- active perception requests;
- information-gain/cost prioritisation;
- semantic-memory budget;
- action affordances.

## Собственные улучшения
1. Горячий путь не считает полный cryptographic state hash на каждый сенсорный кадр — digest делается на checkpoint boundary.
2. Runtime использует лёгкие deterministic IDs для ephemeral perception records; release persistence/integrity по-прежнему защищается проектным checkpoint layer.
3. Sensorium обновляет decision affordances, поэтому не является dashboard-only модулем.
4. P35 сохраняется как предыдущий semantic scaffold; P37 ведёт отдельную временную историю и не маскируется под human-level perception.

## Ограничения
Vision/audio по-прежнему зависят от upstream structured features/events. Это не semantic vision/audio model и не доказательство субъективного восприятия.

## Test status
P37 unit, migration, integration и performance tests должны быть PASS перед release.


## Прогресс проекта
P21–P37 завершены как исследовательские этапы. Следующие крупные этапы: P38 Autonomous Causal Research, P39 Continuous Artificial Life, P40 Real Semantic Perception / Model Ecology. Доказательства, которые нельзя симулировать в коде: реальный POCO 24/72/168 часов и 30 дней, независимые multimodal benchmarks, долгосрочная identity transfer и subjective experience.

## Дополнительные идеи для следующих версий
- Active-perception learner: учить не только «что вижу», но и «какой канал выгоднее опросить следующим».
- Learned re-identification: связывать один объект между кадрами/сеансами через uncertainty-aware identity evidence.
- Sensor sleep/wake policy: отключать дорогой канал, когда его информационная ценность ниже стоимости.
- Body-world prediction: предсказывать, как телесное состояние изменится от плана на несколько шагов.
