# Neuro-Kurisu 35.6.1 — Реальный прогресс и следующий roadmap

## Состояние сейчас

Проект находится в фазе **verification + integration**, а не feature accumulation.

### Пессимистичная карта зрелости

- engineering platform: **~70%**
- cognitive architecture: **~60%**
- persistent autonomous organism: **~35–40%**
- human-like general mind: **~20–25%**
- consciousness: **исследовательская гипотеза, не percentage KPI**

## Главный сдвиг BIG PASS 160–161

Теперь наличие функции не является доказательством её реализации.

Статусы:

`VERIFIED` → полный behavioural evidence

`INTEGRATION_ONLY` → работает в интеграции, но полного proof не хватает

`UNSAFE_TO_AUTO_RUN` → потенциально destructive/external side effect

`UNVERIFIED` → недостаточно доказательств

## Следующая иерархия работ

### Проход A — Function Verification

Semantic contracts → argument generation → postconditions → state diff → persistence → replay → adversarial.

### Проход B — Cognitive Integration

CognitiveEventFabric → Unified Cognitive Cycle → causal graph → replay.

### Проход C — Cognitive Quality

Memory economy → emotion episodes → self-model causality → world-model calibration → intrinsic motivation.

### Проход D — Autonomous Life

Life projects → resource allocation → self-generated curriculum → long-horizon goals → social life.

### Проход E — Reality

Android sensors → external tools → verified postconditions → independent evidence.

### Проход F — Longitudinal Science

1/7/30/90-day experiments → multiple seeds → baselines → ablations → statistics.

### Проход G — Consciousness Research

Theory-specific predictions → perturbations → lesion → recurrence/attention/HOT/GWT analyses.

## Stop conditions

Система не получает статус «готово», если:

- тест проверяет только наличие объекта;
- snapshot показывает красивое число без causal evidence;
- simulation выдаётся за reality;
- integration test не имеет postcondition;
- persistence не проверена restart-сценарием;
- функция с внешним side effect запускается автоматически без safety gate.

## Цель конечного состояния

`Experience → internal change → decision → action → consequence → memory → learning → self-change → future behavior`

должно быть наблюдаемым, воспроизводимым и проверяемым в течение длительного времени.
