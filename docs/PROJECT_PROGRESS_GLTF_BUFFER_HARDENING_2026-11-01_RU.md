# NK1 — инженерный проход: GLB/VRM parser hardening

Дата: 2026-11-01  
Ветка: `workpass70-source`  
Проверенный HEAD: `4c7353a83905e66120c161403dae5efab6e11a71`  
Официальный взвешенный прогресс: **80.1% — без изменения**

## Что реально изменено

1. В `avatarModelLimits.ts` введён общий лимит `MAX_AVATAR_BUFFERS = 32`.
2. В `avatarModelPreflight.ts` метаданные buffers проходят ограничение размера до перебора элементов.
3. Для GLB 2.0 теперь явно проверяется layout embedded buffer:
   - URI-less buffer может быть только один;
   - он должен находиться на позиции 0;
   - при его наличии обязателен BIN chunk;
   - BIN chunk должен соответствовать объявленной длине с допуском только 0–3 байта выравнивания;
   - BIN chunk без соответствующего embedded buffer отклоняется.
4. В `avatar-model-preflight.test.mjs` добавлено пять регрессий: допустимое выравнивание, дублирующий embedded buffer, избыточный padding, orphan BIN и превышение лимита buffer metadata.
5. Изменения зафиксированы в CHANGELOG.

## Изменённые файлы

- `app/src/components/avatar/avatarModelLimits.ts`
- `app/src/components/avatar/avatarModelPreflight.ts`
- `app/scripts/avatar-model-preflight.test.mjs`
- `CHANGELOG.md`

## Коммиты этого прохода

- `e1fea529ff7ecd34a7b38439486e575615bd0d48`
- `580a1a2f3e0b0d6dc4b1357283a6601cb9ffb5b1`
- `6a0b64deb1615697fe342611ffa9997fe206309f`
- `4c7353a83905e66120c161403dae5efab6e11a71`

## Проверки и ограничения

- Изменения и актуальные blob SHA подтверждены GitHub API.
- Пять новых тестов добавлены, но **не объявляются пройденными**: локальный запуск не состоялся, поскольку среда не смогла разрешить `raw.githubusercontent.com`; для HEAD не получено подтверждение успешного CI run.
- Проверка целостности опубликованной GLB-модели в предыдущем коммите существует отдельно; этот проход не повторно валидировал удалённый asset.
- Изменения не проверяют WebGL-визуализацию, Android/Termux или производительность на устройстве.

## Прогресс и Release

Официальные **80.1%** сохранены: parser hardening повышает безопасность входных 3D-файлов, но не закрывает независимые retrieval, browser/device E2E, clean-room restore, licensing и soak gates. Release ZIP не обновлялся и не объявляется обновлённым. Следующий технический приоритет — связать эти проверки с реальным CI-run на точном HEAD и затем продолжить независимую memory retrieval uplift работу.
