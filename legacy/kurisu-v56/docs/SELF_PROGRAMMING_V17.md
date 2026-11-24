# Self-programming roadmap

## Principle

Курису может помогать проекту развиваться, но «самопрограммирование» должно быть многоступенчатым.

### Stage A — introspection

Она измеряет:

- latency;
- template ratio;
- memory retrieval success;
- prediction error;
- calibration;
- goal completion;
- crashes;
- model load failures;
- RAM/energy hints.

### Stage B — hypothesis

Она формулирует:

> проблема → гипотеза → ожидаемый эффект → тест.

### Stage C — sandbox

Изменение запускается отдельно от production.

### Stage D — benchmark

Сравниваются старая и новая версии:

```text
quality
latency
RAM
battery
stability
memory consistency
```

### Stage E — approval

Для конфигурации пользователь может разрешить автоматическое принятие только заранее выбранных классов изменений.

### Stage F — rollback

Каждое принятое изменение имеет snapshot и обратный переход.

## Never do

- не выполнять непроверенный код из интернета;
- не скачивать исполняемые файлы и запускать их только по решению LLM;
- не переписывать ядро во время активного диалога;
- не удалять автобиографическую память без версии/резерва;
- не считать изменение prompt равным изменению модели weights.
