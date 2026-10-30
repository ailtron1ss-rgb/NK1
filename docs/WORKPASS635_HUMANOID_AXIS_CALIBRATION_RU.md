# WorkPass 635 — калибровка локальных осей humanoid retargeting

Дата: 2026-10-30

## Что изменено

`humanoidRetarget.ts` теперь принимает необязательные `restWorldRotation` для source и target rig. Для каждой общей semantic-роли строится кватернион базиса:

`B = inverse(targetWorldRest) * sourceWorldRest`

Он переводит векторы из локальной системы source-кости в локальную систему target-кости, если обе мировые rest-ориентации выражены в одной общей системе координат. Перед переносом rest-relative rotation delta выполняется сопряжение:

`targetDelta = B * sourceDelta * inverse(B)`

Затем delta применяется поверх target rest-local rotation. Это устраняет скрытое предположение об одинаковых локальных осях в тех случаях, когда runtime способен корректно снять обе мировые rest-ориентации.

## Безопасность и совместимость

- Старый вызов без world-rest snapshots сохраняет совместимое поведение: локальные оси считаются совпадающими.
- `uncalibratedAxisRoles` явно перечисляет роли без парной калибровки.
- `requireAxisCalibration: true` исключает некалиброванные роли из результата вместо молчаливого переноса.
- Quaternion normalization, shortest-arc clamp и bounded root translation сохранены.
- Тест фиксирует преобразование source-local X rotation в target-local Y rotation при различии базисов на 90°.

## Разделение анимационных трактов

- **VRMA → VRM:** остаётся на официальном Pixiv pipeline `createVRMAnimationClip(animation, activeVrm)`. Повторный ручной quaternion retarget поверх уже скомпилированной VRMA не добавлялся.
- **Model-specific embedded GLTF clips → другой skeleton:** собственный адаптер потенциально нужен, но пока не подключён к `Avatar3DStage`. Для подключения требуется получить source и target rest-world transforms в общей системе координат и определить безопасный способ сэмплировать source clip без вмешательства в mixer активного аватара.

## Проверка

Добавлены deterministic unit tests:
- paired world-rest basis derivation;
- quaternion basis conjugation;
- strict rejection of uncalibrated roles;
- compatibility fallback;
- ранее существовавшие quaternion/rest-pose/translation safety cases.

Эти тесты проверяют математику адаптера, а не визуальное качество настоящих VRM-моделей. Они не доказывают IK, foot contact, retargeting между реальными skeletons, SpringBone поведение или browser/Android E2E.

## Следующие интеграционные задачи

1. Снять `getWorldQuaternion` для semantic bones после `updateMatrixWorld(true)` для обоих rig snapshots.
2. Ввести отдельный source animation sampling path для embedded GLTF clips; не переиспользовать VRMA compiler.
3. Скомпилировать target-local tracks по target node mapping, с фильтрацией неподдерживаемых ролей.
4. Добавить две лицензированные fixture-модели с различными rest axes и proportions и проверить визуальные результаты в браузере.
5. После базового retargeting добавить root-motion policy, foot contact/IK и оценку drift.
