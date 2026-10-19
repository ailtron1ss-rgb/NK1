# Device Gate

Device Gate не является условием архитектурной целостности. Это условие доверия к реальному Android runtime.

Перед реальным использованием на телефоне выполнить:

```bash
npm ci
npm run release:audit
scripts/termux/start.sh
```

Затем проверить: 1) Termux:API permissions; 2) KoboldCpp/local GGUF; 3) 24h smoke; 4) screen off/on; 5) restart after process kill; 6) low battery/thermal pressure; 7) persistence after reboot.

Для долгого soak рекомендуется 24–168 часов. Ошибка Device Gate не должна уничтожать cognitive state: состояние должно восстанавливаться из atomic snapshot + backup.


## Профиль P22 для среднего телефона

Целевой профиль: POCO M7 Pro 5G 8/256, Dimensity 7025-Ultra. P22 переводит phone runtime на единый policy-слой. По умолчанию активен `active` режим с отдельным sensor cadence, адаптивной паузой автономных циклов и пакетным world checkpoint.

Ключевые переменные: `NEURO_RUNTIME_MODE=eco|active|research`, `NEURO_SENSOR_INTERVAL_MS`, `NEURO_WORLD_CHECKPOINT_MIN_INTERVAL_MS`, `NEURO_WORLD_CHECKPOINT_MAX_DIRTY_CYCLES`. Обычный chat делает один LLM-вызов. Второй cognitive-proposal проход включается явно через `deliberate=true`.

Core checkpoint и world checkpoint теперь независимы: world-состояние не пишется на каждый автономный цикл; `flush` сохраняет оба немедленно. Backup для файлового state остаётся включён согласно профилю.

Перед реальным 7-дневным прогоном обязательно измерить фактический расход батареи и поведение HyperOS/Android при screen-off, battery saver, reboot, process kill и low-memory pressure. Android допускает ограничения фоновой работы и запусков foreground services, поэтому supervisor сам по себе не является гарантией непрерывной жизни процесса. Для Android 12+ существуют ограничения запуска foreground service из background, а для Android 15+ отдельные типы foreground service имеют временные лимиты. См. актуальный `DEVICE_GATE_RUNBOOK_RU.md` и официальную документацию Android.
