# P29 — Mega Pack: Learning Governance, Continual Development и защитная экономика обучения

## Зачем этот этап

После P23–P28 у организма уже появились четыре разных источника изменения поведения: табличный/replay-контур P23, параметрическое обучение P26, learned world model P27 и быстрая локальная пластичность P28. Главный риск теперь — не отсутствие learning, а конфликт learning-систем между собой.

P29 вводит управляющий слой над learned-family. Он не делает вид, что управляет всей когницией: heuristic-механизмы остаются отдельными. Арбитраж применяется к P26/P27/P28 и связанным информационным сигналам.

## Что добавлено

### 1. Learning Governance Engine

Каждый learned source сообщает:
- bias;
- confidence;
- trust;
- estimated cost;
- type.

Арбитр вычисляет взвешенный вклад, conflict score и dominant source. При сильном конфликте и отсутствии достаточно надёжного источника обновление может быть отклонено.

### 2. Trust adaptation

У каждого source есть отдельный trust score. Он меняется по наблюдаемому reward/delta, а не по декларации модуля.

### 3. Learning budget

Стоимость обучения теперь реально участвует в arbitration. Используется остаток learning budget вместе с текущим body resource budget. Бюджет медленно восстанавливается между циклами.

### 4. Learning provenance

Каждый arbitration event может оставить provenance-запись:
- источник;
- action;
- причина;
- evidence IDs;
- trust;
- cost;
- принято/отклонено.

### 5. Continual-learning ledger

По каждой задаче сохраняются:
- число samples;
- best score;
- last score.

Из них вычисляются:
- forgetting;
- retention.

Это создаёт техническую основу для будущего catastrophic-forgetting benchmark.

### 6. Learning rollback

Последние два checkpoint-а learned family отслеживаются in-process. При проблеме можно откатить P26/P27/P28 к предыдущему подтверждённому состоянию.

Важно: rollback bundle намеренно не дублируется в persistent JSON, поэтому он **process-local**. Persistent snapshot хранит только доступность и поколение rollback. Защита от нового отравления learning остаётся persistent через P28 quarantine.

### 7. Новая архитектурная граница

P29 не владеет всей когнитивной системой. Он владеет только learned arbitration boundary:

`P26 policy + P27 world + P28 plasticity -> P29 arbiter -> action utility`

Это уменьшает риск того, что один «супер-модуль» станет центральной точкой всей архитектуры.

## Что сознательно не заявляется

P29 не доказывает AGI, сознание или универсальное continual learning. Он создаёт проверяемый механизм arbitration/rollback и основу для экспериментов.

## Проверяемые критерии

1. При согласованных источниках arbitration принимает решение.
2. При сильном конфликте низкодоверительные обновления могут быть отклонены.
3. Resource budget меняет силу learned bias.
4. Provenance записывает происхождение изменения.
5. Reload сохраняет P29 state.
6. Rollback восстанавливает предыдущий in-process checkpoint.
7. Continual ledger показывает forgetting/retention на искусственной последовательности задач.
