# WorkPass75 — нативная интеграция VRM 0.x / VRM 1.0

## Что изменилось

Ранее `Avatar3DStage` использовал только `GLTFLoader`: файл `.vrm` принимался как glTF/GLB, но VRM-расширения не активировались. Теперь тот же загрузчик регистрирует `VRMLoaderPlugin` из `@pixiv/three-vrm@3.5.5`. Архитектура аватара не заменяется: текущий NK1 body motor, анимационный mixer, gaze/emotion state и существующий GLB fallback продолжают жить в `Avatar3DStage`.

При обнаружении VRM активируется `gltf.userData.vrm`, а в сцену добавляется `vrm.scene`. Для VRM 0.0 выполняется `VRMUtils.rotateVRM0`; VRM-меши исключаются из frustum culling. При замене/сбросе VRM освобождается через `VRMUtils.deepDispose`.

## Единый normalized humanoid motor (WorkPass76)

Первый проход WorkPass75 временно держал `autoUpdateHumanBones:false`, поскольку исходный motor менял raw skeleton напрямую. WorkPass76 устранил этот конфликт: `VRMLoaderPlugin` и `configureVrmForNk1NormalizedMotorDrive` включают `autoUpdateHumanBones:true`, а сам NK1 motor теперь пишет humanoid intent в штатные proxy nodes, полученные через `vrm.humanoid.getNormalizedBoneNode()`.

В текущий normalized output path подключены:
- `head` + `neck`: gaze X/Y, cognitive load, energy, sadness/anger head tilt;
- `leftUpperArm`: существующий explore gesture;
- `rightUpperArm`: существующие respond/speaking и verify gestures.

Когда доступны обе кости head/neck, угловое намерение распределяется между ними в долях 35/65, чтобы не удваивать исходный raw-bone offset. Все четыре node rotations на каждом кадре сбрасываются к normalized identity и рассчитываются заново — без накопления Euler drift. Затем `vrm.update(delta)` штатно копирует normalized pose в raw bones и обновляет look-at, expression manager, node constraints, spring bones и MToon materials.

Для generic GLB сохраняется прежний raw-bone motor/mixer. Для VRM normalized humanoid update является владельцем человеческого скелета; embedded GLTF animation tracks, направленные в raw humanoid bones, не должны считаться полноценным retargeted motion clip — отдельный VRMA/normalized animation retargeting ещё предстоит сделать.

## Граница IK

В NK1 уже есть `planarArmIK` и model-specific `vrmRigCalibrationProfile`, но в `Avatar3DStage` пока нет валидированного пространственного target observation: 2D/3D target coordinates в avatar-root frame, измеренных upper/forearm lengths и confidence/provenance от perception. Поэтому этот проход подключает существующий мотор к normalized humanoid, но **не выдаёт фиктивную IK-позу** и не считает planar solver интегрированным в реальный live arm control. Следующий корректный шаг — подать туда реальные perception/action targets и exact-fingerprint calibration profile, затем применить accepted IK через уже существующий calibrated raw/normalized bridge.

## Выражения и речь

`vrmRuntimeAdapter.ts` преобразует состояние NK1 в стандартные VRM expressions:

- joy → `happy`
- anger/frustration → `angry`
- sadness/anxiety → `sad`
- calm/protective → `relaxed`
- mouth pose → `aa / ih / ou / ee / oh`
- blink → `blink`

Если конкретная модель не содержит preset expression, `setValue` ничего не добавляет: это не приводит к исключению. Generic GLB без VRM продолжает использовать предыдущий morph-target fallback.

## Метаданные модели

В интерфейсе показывается ограниченная сводка VRM meta: имя, авторы, license field / URL и avatar permission. Эти поля — подсказка, а не автоматическое разрешение на публикацию или коммерческое использование. Перед распространением аватара всё равно требуется вручную сверить license URL, ограничения автора и third-party assets. Модель остаётся локальным пользовательским файлом в IndexedDB.

## Зависимость и происхождение

- `@pixiv/three-vrm` закреплён на `3.5.5` (без диапазона версий).
- Peer requirement: `three >=0.137`; NK1 использует `three@0.180.0`.
- Все 14 runtime/type packages в npm lockfile закреплены на `3.5.5` с registry integrity hashes.
- Исходный архив `three-vrm-3.5.5.zip`, SHA-256: `4dfc3b486fff6bebe8baae826d57c5406fc41ae77e300ee7b65ea69c8ed48984`; в нём присутствует MIT LICENSE pixiv Inc.
- В NK1 не копируется исходный monorepo, используется опубликованный пакет из npm registry.

## Проверка и незакрытые вопросы

Добавлены unit tests для affect→VRM expression mapping, normalized humanoid head/neck/arm mapping, missing-bone rejection, no-drift frame output, bounded frame updates и VRM 0/1 meta parsing. CI дополнительно выполнит app TypeScript typecheck и production Vite build.

Физический визуальный E2E с авторизованными VRM 0.x/1.0 моделями на Android пока не считается пройденным: требуется проверить реальный MToon render, spring-bone jiggle, model-specific expression mappings, memory/freeing при многократной загрузке, и синхронность mouth pose. Generic GLB behavior также должен остаться регрессионно совместимым.
