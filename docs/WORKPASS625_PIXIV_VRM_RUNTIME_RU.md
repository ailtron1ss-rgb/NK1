# [NK1][WorkPass625] Adopt the official Pixiv VRM runtime

**Дата:** 30 октября 2026 г.  
**Рабочая ветка:** feature/embodiment-model-hardening-2026-10-29  
**Связанный PR:** [#392](https://github.com/ailtron1ss-rgb/NK1/pull/392)  
**Статус:** интеграция runtime и тесты внесены; точный head должен пройти install/typecheck/build/CI. Release ZIP не изменён.

## Архитектурное решение

После собственного WorkPass624 expression adapter закрывал важный mapping gap, но не должен становиться альтернативной реализацией всего VRM стандарта. Для полноценного 3D-воплощения лучше делегировать стандартные VRM semantics поддерживаемому runtime и оставить код NK1 как слой intent/compatibility.

Добавлен pinned dependency @pixiv/three-vrm@3.5.5, MIT-licensed, с peer dependency three >=0.137. В NK1 уже закреплён Three.js 0.180.0. Пакет и 15 связанных @pixiv packages внесены в app lockfile с registry URL и integrity hashes. Бета 3.6.0-beta.0 не выбрана: проект использует стабильный latest npm tag, не prerelease.

## Что теперь делает official runtime

### 1. Единый loader для VRM 0.x, VRM 1.0 и GLB

До парсинга пользовательский байтовый файл по-прежнему проходит NK1 inspectSelfContainedGlb: внешний URI, некорректные buffer ranges, недопустимая сложность и слишком большие текстуры блокируются до GLTFLoader.

Затем создаётся GLTFLoader и регистрируется VRMLoaderPlugin. Если файл содержит VRM, приложение берёт gltf.userData.vrm.scene; обычный GLB остаётся на gltf.scene. Для VRM 0.x применяется VRMUtils.rotateVRM0, чтобы согласовать направление персонажа с VRM 1.0.

### 2. Вместо самописных facials — ExpressionManager

Когда официальный VRM expressionManager доступен, NK1 передаёт в него имеющиеся значения organism state через setValue:
- emotion presets: happy / angry / sad / relaxed / surprised;
- viseme presets: aa / ih / ou / ee / oh;
- blink / blinkLeft / blinkRight;
- LookAt preset expressions выключаются как отдельный канал, если у VRM есть native lookAt, чтобы один взгляд не управлялся одновременно менеджером и target.

Далее vrm.update(dt) обновляет ExpressionManager. Эта библиотечная реализация понимает authored MorphTargetBind, MaterialColorBind, TextureTransformBind, isBinary и override channels. NK1 не запускает ручной override blend второй раз: для official manager deriveVrmExpressionWeights(..., { applyVrmOverrides: false }) формирует intent, а VRM manager выполняет нормативную часть один раз.

Для ordinary GLB, загруженного без VRM runtime, остаётся precompiled WorkPass624 morph-target adapter; прежняя эвристика по именам остаётся последним fallback.

### 3. Humanoid rig и движения

Если VRM предоставляет humanoid.getNormalizedBoneNode, мотор NK1 теперь берёт normalized nodes для head/neck/left/right upper/lower arm. Именно эти узлы являются правильной точкой приложения нормализованного pose intent: последующий vrm.update(dt) синхронизирует normalized rig с raw skeleton. Если конкретной normalized bone нет, адаптер сохраняет предыдущий fallback на raw GLTF bones и parser associations. Порядок кадра также важен: сначала восстанавливается baseline и обновляется AnimationMixer, затем к normalized nodes добавляется моторный offset NK1, и после этого вызывается VRM.update(dt), который переносит нормализованную позу на raw skeleton. Поэтому VRM Humanoid sync больше не стирает жесты, как это могло происходить при прямом управлении raw bones.

Это устраняет важный конфликт предыдущей версии: прямое изменение raw bones до vrm.update могло быть перезаписано Humanoid sync.

### 4. Native LookAt, spring bones, constraints, MToon

- vrm.lookAt.target получает точку, рассчитанную из gazeX/gazeY.
- vrm.update(dt) вызывает VRMCore humanoid/LookAt/expression updates, VRM NodeConstraintManager, SpringBoneManager и обновление поддерживаемых материалов (включая MToon).
- При замене/сбросе модели используется VRMUtils.deepDispose, а plain GLB сохраняет прежний disposer.

В runtime документированы метаданные лицензии VRM через vrm.meta; присутствие метаданных само по себе не доказывает, что пользователь имеет право на любое использование файла — происхождение/условия нужно проверять отдельно.

## Регрессии

Добавлен app/scripts/avatar-pixiv-vrm-runtime.test.mjs и команда test:avatar-pixiv-vrm-runtime, включённая в .github/workflows/embodiment-quality-gates.yml. Проверяются:
- exact package pin, lock entries, MIT metadata и compatibility с Three.js 0.180.0;
- loader plugin registration и выбор VRM scene/VRM0 orientation;
- ExpressionManager, normalized humanoid, native LookAt, VRM.update, MToon/SpringBone/NodeConstraint processing и deepDispose wiring;
- сохранение precompiled WorkPass624 adapter как plain GLB fallback.

## Границы и открытые проверки

Эта интеграция не равна визуальному подтверждению. Нужны реальные лицензированно пригодные VRM 0.x/1.0 assets с известными выражениями, скелетом, MToon и spring bones; затем browser/device screenshots, взгляд/мимика/волосы/одежда, reload/interrupt, память/FPS на Android и soak.

Остаются также: full VRM Animation (VRMA) provider, custom-expression aliases для не preset custom expression keys, 2.5D original layer rig, unified browser/Android/Termux voice provider, acoustic foneme-level sync и финальная Release ZIP provenance gate.

## Official upstream references

- Pixiv three-vrm README / MIT license / loader registration: https://github.com/pixiv/three-vrm/blob/dev/README.md
- VRM expression specification: https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_vrm-1.0/expressions.md
- VRM runtime API: https://pixiv.github.io/three-vrm/docs/classes/three-vrm.VRM.html
- VRM expression manager API: https://pixiv.github.io/three-vrm/docs/classes/three-vrm-core.VRMExpressionManager.html
- VRM humanoid normalized bones: https://pixiv.github.io/three-vrm/docs/classes/three-vrm-core.VRMHumanoid.html
- VRM LookAt target: https://pixiv.github.io/three-vrm/docs/classes/three-vrm-core.VRMLookAt.html
