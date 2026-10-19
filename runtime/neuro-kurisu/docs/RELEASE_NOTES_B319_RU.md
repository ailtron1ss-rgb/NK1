# BIG PASS B319 — Crash Injection / Recovery

## Цель

После B318 проверялся обычный process restart. B319 проверяет следующий уровень: аварийное завершение во время atomic-write pipeline, сохранность предыдущего durable generation и восстановление из backup.

## Добавлено

- crash-injection hooks в `FileStateStore`
- `tests/big-pass-319-crash-recovery.mjs`
- `tests/big-pass-319-crash-worker.mjs`
- `npm run test:big-pass-319`

## Crash points

- `after-tmp-write`
- `after-file-fsync`
- `after-backup`
- `before-rename`
- `after-rename`

Инъекция включается только через `NEURO_CRASH_INJECT`, поэтому штатный runtime не меняет поведение без явного тестового флага.

## Доказанный сценарий B319

1. Создать durable state.
2. Запустить новый процесс.
3. Принудительно завершить его на `before-rename`.
4. Проверить, что primary state остался предыдущей валидной generation.
5. Повредить primary.
6. Загрузить через `FileStateStore`.
7. Убедиться, что backup восстанавливает правильное состояние.
8. Создать новый `OrganismCore` из recovered state.
9. Выполнить новый checkpoint.

## Значение

Теперь persistence архитектурно проверяется не только через restart, но и через контролируемую аварию в середине записи.

Следующий persistence-шаг: matrix по всем crash points + измерение максимального crash-loss window + автоматический release policy для corrupted state.
