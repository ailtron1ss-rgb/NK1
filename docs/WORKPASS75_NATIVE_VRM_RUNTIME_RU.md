# WorkPass75 — нативная интеграция VRM 0.x / VRM 1.0

## Что изменилось

Ранее `Avatar3DStage` использовал только `GLTFLoader`: файл `.vrm` принимался как glTF/GLB, но VRM-расширения не активировались. Теперь тот же загрузчик регистрирует `VRMLoaderPlugin` из `@pixiv/three-vrm@3.5.5`. Архитектура аватара не заменяется: текущий NK1 body motor, анимационный mixer, gaze/emotion state и существующий GLB fallback продолжают жить в `Avatar3DStage`.

При обнаружении VRM активируется `gltf.userData.vrm`, а в сцену добавляется `vrm.scene`. Для VRM 0.0 выполняется `VRMUtils.rotateVRM0`; VRM-меши исключаются из frustum culling. При замене/сбросе VRM освобождается через `VRMUtils.deepDispose`.

## Почему отключён normalized-to-raw auto update

Существующий NK1 avatar motor и импортированные GLTF clips напрямую изменяют raw skeleton nodes. Стандартный `VRMHumanoid.autoUpdateHumanBones=true` копирует normalized humanoid pose в raw skeleton во время `vrm.update()` и мог бы перезаписать текущие motor/clip изменения. Поэтому `VRMLoaderPlugin` конфигурируется с `autoUpdateHumanBones:false`. Существующий raw rig остаётся под контролем NK1; сам VRM runtime по-прежнему обновляет look-at, expression manager, node constraints, spring bones и MToon materials при каждом `vrm.update(delta)`.

Это осознанный мост совместимости, а не заявление, что normalized humanoid pose уже управляется NK1 напрямую. Следующий отдельный этап — адаптер normalized-pose/IK с измерением поведения на контрольных VRM 0.x и 1.0 моделях.

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

Добавлены unit tests для affect→VRM expression mapping, bounded frame updates, VRM 0/1 meta parsing и preservation of raw-bone motor ownership. CI дополнительно выполнит app TypeScript typecheck и production Vite build.

Физический визуальный E2E с авторизованными VRM 0.x/1.0 моделями на Android пока не считается пройденным: требуется проверить реальный MToon render, spring-bone jiggle, model-specific expression mappings, memory/freeing при многократной загрузке, и синхронность mouth pose. Generic GLB behavior также должен остаться регрессионно совместимым.
