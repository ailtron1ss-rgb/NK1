# Device Gate — Neuro-Kurisu Evolution 7.2.0 / P22

Цель: подтвердить, что canonical organism надёжно работает в реальном Android/Termux, а не только в контейнере. Device Gate не доказывает сознание; это эксплуатационный и embodied reliability gate.

## Предусловия
- Node.js >= 22.12
- npm >= 10.8
- Termux + Termux:API установлены из совместимого источника и разрешены, если нужны battery/sensors/TTS/STT/Wi-Fi
- KoboldCpp опционален; Gemini опционален
- свободное место в `$HOME`

## Запуск с нуля
```bash
pkg update
pkg install nodejs-lts npm unzip
# при необходимости Android bridges
pkg install termux-api

unzip Neuro_Kurisu_Evolution_Current Release.zip
cd Neuro-Kurisu-Evolution-v2
npm ci
npm run release:audit
npm run device:preflight
npm start
```

## Проверка

Health:

`curl http://127.0.0.1:3000/api/health`

Metrics:

`curl http://127.0.0.1:3000/api/metrics`

## Длительный gate

Рекомендуемая лестница:

`30 минут → 6 часов → 24 часа → 72 часа → 168 часов`.

Сохраняйте: restarts, state hash, integrity warnings, battery, thermal, RAM, CPU, autonomy, self-prediction, project continuity, value revisions, language backend failures.

## Важно

Первый запуск лучше сделать с `ActionGateway` в `dry-run`. Реальное выполнение внешних инструментов включайте только после отдельной проверки allowlist/capabilities.


## P22 phone baseline

Для первого запуска на POCO: `NEURO_PHONE_MODE=true`, `NEURO_RUNTIME_MODE=active`, `NEURO_INTERVAL_MS=30000`, `NEURO_SENSOR_INTERVAL_MS=60000`, `NEURO_CHECKPOINT_MIN_INTERVAL_MS=60000`, `NEURO_CHECKPOINT_MAX_DIRTY_CYCLES=3`, `NEURO_WORLD_CHECKPOINT_MIN_INTERVAL_MS=300000`, `NEURO_WORLD_CHECKPOINT_MAX_DIRTY_CYCLES=10`, `NEURO_BACKUP_EVERY_SAVES=4`.

Режимы:
- `eco` — длительная автономная жизнь, приоритет ресурсу.
- `active` — основной пользовательский режим.
- `research` — более частые циклы и записи, только для лабораторных прогонов.

Контролировать через `/api/metrics`: `body`, `persistence.store.core`, `persistence.store.world`, `persistence.worldDirtyCycles`, `tick`, prediction error, autonomy, memory size. Отдельно записывать battery %, temperature, RAM pressure, CPU и bytesWritten для core/world.

Критерий P22: не просто «процесс жив», а снижение лишних world-write операций, корректная адаптация cadence при thermal/battery pressure и сохранение state после reboot/kill. Чтобы перейти дальше, нужны подтверждённые 24h → 72h → 168h физические прогоны.
