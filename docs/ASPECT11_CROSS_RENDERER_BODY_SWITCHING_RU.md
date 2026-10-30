# NK1 — Аспект 11: единое тело и переключение 2D / 2.5D / 3D

Дата: 2026-10-30  
Базовая линия: `workpass70-source` @ `ad564d1879028f00549be41ec5172a2f72e25897`  
Рабочая ветка: `work/nk1-cross-renderer-body-switching-2026-10-30`

## Цель

Один организм NK1, одно каноническое состояние тела и несколько взаимозаменяемых renderer-адаптеров. Переключение меняет только способ визуального и физического представления. Оно не должно сбрасывать эмоцию, внимание, речь, намерение, позу, гардероб или историю.

## Актуальное состояние на исходной линии

- `AvatarStage.tsx` уже выбирает `live2d | legacy | original | 3d` и сохраняет пользовательский выбор.
- Live2D получает протокол `EmbodimentIntentV1`, но его body-блок ограничен наклоном головы, булевым жестом и motion group/index.
- Original и Legacy — отдельные 2D-представления, не полноценные скелетные адаптеры.
- Three.js 3D-режим существует, но встроенное тело процедурное; загруженный GLB/VRM может не иметь скелета, а найденные кости обрабатываются ограниченным набором эвристик.
- Сохранение VRM/GLB в IndexedDB есть, но нет общего контракта для переноса состояния между рендерами.
- PR #405 добавляет bounded cross-renderer motor foundation; PR #410 развивает runtime motor controller. Оба Draft и прямо не заявляют готовые renderer adapters.
- PR #409 создаёт основу 2.5D depth rig, PR #406 расширяет Live2D. Они должны подключаться через единый контракт, а не вводить собственные источники состояния.

## Принципы

1. **Single source of truth:** OrganismCore/OrganismSnapshot владеет когнитивным состоянием; embodiment runtime владеет только производным состоянием отображения и исполнения.
2. **Capability honesty:** адаптер декларирует реальные каналы, выражения, visemes, physics, world targets и clothing layers. Не поддерживаемое явно помечается unsupported.
3. **No false success:** принятие команды адаптером не считается выполнением движения. Для исполнения требуется receipt с измеренным результатом.
4. **Continuity:** при переключении фиксируется immutable snapshot с revision и monotonic timestamp; новые обновления продолжают поступать, старые revision не перезаписывают новые.
5. **Safe handoff:** старый renderer остаётся активным до готовности нового; затем происходит bounded crossfade / neutral rebind. При ошибке — rollback к предыдущему renderer.
6. **No hidden state transfer:** не копировать внутренние кости или Cubism parameter IDs напрямую. Переносить семантические каналы и переводить их в локальную систему координат адаптера.
7. **Progressive fidelity:** Live2D и 2.5D честно поддерживают подмножество каналов; VRM поддерживает расширенный суставной набор при наличии соответствующего humanoid rig.

## Добавлено в этой итерации

- `app/src/components/avatar/embodimentSwitch.ts`: версионированный semantic body snapshot, capability-aware switch plan, список неподдерживаемых каналов, общий pose blend и монотонное продвижение перехода.
- `app/scripts/embodiment-switch.test.mjs`: тесты валидации snapshot, переноса речи/эмоций/intent, capability negotiation, отсутствующих каналов и monotonic transition.
- Этот план и критерии интеграции.

Это безопасный контрактный фундамент. Он пока не подменяет подключение к React renderer lifecycle и не объявляет реальные движения выполненными.

## Промежуточный протокол подтверждения Live2D


- Live2D viewer emits a revision-bound `live2d_intent_ack` only after the Cubism `beforeModelUpdate` readback and all requested expression/motion command promises have settled. It records expression/motion as `started`, `unavailable`, `error`, or `not-requested`; these statuses describe command dispatch only, not animation completion. The ACK reports `parameters-observed` or `accepted-unverified`, sets `complete: false` and `visualCompletionVerified: false`, and is correlated to the latest intent revision.

**Ограничение:** `started` означает только, что SDK сообщил об успешном запуске expression/motion; `unavailable` и `error` отражают невозможность запуска или отказ вызова; `not-requested` означает отсутствие новой команды. Ни один из этих статусов не подтверждает завершение анимации или физическую отрисовку кадра. Подтверждение Cubism относится только к значениям параметров после setters в `beforeModelUpdate`. Пока `complete: false` и `visualCompletionVerified: false`, адаптер обязан считать это диагностическим частичным ACK и не создавать `AdapterApplyReceipt` для транзакционного commit.

## План интеграции

### P0 — единый контракт и владение
- Сопоставить существующие `EmbodimentIntentV1`, `OrganismSnapshot`, motor goals PR #410 и capability map PR #405.
- Устранить дублирующие источники позы; определить единственного владельца revision и intent IDs.
- Добавить versioned `EmbodimentAdapter` lifecycle: `prepare`, `capture`, `apply`, `verify`, `dispose`.
- Согласовать renderer identity, capability fingerprint и модель/rig identity.

### P0 — транзакционное переключение
- Состояния: `stable → preparing → ready → crossfading → committed`; ошибки: `rollback`.
- Не размонтировать источник до успешного `prepare` целевого renderer.
- Сохранять speech event/audio clock, expression, gaze target, motor intent, wardrobe ID и поддерживаемые pose channels.
- Использовать monotonic revision и отмену устаревшего handoff.
- При несовместимости не выдумывать позу: применить ближайший безопасный neutral pose и показать ограничения.

### P1 — адаптеры
- Live2D: map semantic head/gaze/breath/gesture/expression/viseme в существующие Cubism параметры и клипы.
- Depth2D: map depth layers, pivots, deformation, limb targets и occlusion.
- VRM3D: map normalized humanoid bones, expressions, look-at, spring bones, VRMA и IK.
- Legacy/Original оставить совместимыми fallback renderer modes, не называть их 2.5D.

### P1 — согласование моделей
- На загрузке модели строить capability manifest из фактически найденных bones, morphs, expressions, clips и garment attachment points.
- Проверять required skeleton topology, rest pose, joint limits, scale, orientation, missing nodes и license metadata.
- Считать capability fingerprint и не переносить pose channels, если rig identity изменился.
- Хранить пользовательские модели локально; не загружать байты модели на сервер без явного согласия.

### P1 — качество перехода
- Crossfade 150–350 ms как начальный диапазон, измерить на desktop/Android.
- В момент передачи удерживать последнюю подтверждённую позу; не делать скачок в rest pose.
- Синхронизировать viseme по единому speech clock; новый renderer получает текущую фазу и audio time, а не запускает речь заново.
- Учитывать capability degradation: пальцы/ноги/контакты могут отсутствовать в 2D.
- Сохранять выбранный режим и модель, но не сохранять временные animation handles.

### P2 — верификация
- Unit: schema, stale revisions, capability filtering, rollback, interpolation, no-NaN.
- Integration: Live2D ↔ 2.5D ↔ VRM round-trip с одним snapshot.
- Browser E2E: переключение во время речи, жеста, эмоции и загрузки модели.
- Device E2E: Android low-memory/WebGL loss, orientation change, background/foreground.
- Soak: не менее 30 минут циклических переключений, без утечек RAF, WebGL contexts, audio sessions и IndexedDB handles.
- Метрики: handoff latency, dropped frames, pose discontinuity, speech-clock drift, rollback rate, unsupported-channel rate.

## Критерии 100%

- Все renderer modes реализуют один версионированный adapter contract.
- Никакой renderer не владеет отдельной копией личности/эмоций/речи.
- Switch snapshot не теряет revision, speech event, intent, emotion, gaze и wardrobe selection.
- Устаревший handoff не может перезаписать более новое состояние.
- Старый renderer остаётся доступен до успешной готовности нового.
- Rollback работает при загрузочной ошибке и WebGL loss.
- Capability manifest отражает фактический rig, а не желаемые возможности.
- Поддержанные каналы достигают заданной точности; неподдержанные явно отчитываются.
- 2D/2.5D/3D round-trip проходит browser E2E и Android E2E.
- Выпущенный ZIP собран из проверенного Release source и имеет подтверждённый checksum.

## Не входит в эту итерацию

Полный скелет, художественные ресурсы 2.5D, полноценная VRM-модель, одежда и биомеханика — отдельные аспекты. Этот аспект обеспечивает их согласованное переключение и не должен дублировать их реализацию.


## Интеграция частичного ACK в AvatarStage

Родительский `AvatarStage` теперь принимает `live2d_intent_ack` только от текущего iframe и только при совпадении `stateVersion` с последним отправленным intent. Проверяются `appliedRevision`, `complete === false`, а также явные статусы expression/motion «not independently verified». На экране отображается только диагностический счётчик наблюдённых параметров или факт принятия без readback.

Это подтверждение транспортной корреляции и ограниченного readback, не полноценное доказательство исполнения семантического состояния: ACK не содержит независимой проверки expression/motion, не подтверждает GPU-presented frame и не преобразуется в `AdapterApplyReceipt`. Устаревшие ACK, чужой origin/source и некорректные версии отбрасываются.


## Зафиксированное решение по каноническому 2.5D rig (2026-10-30)

Проведено сравнение актуальных PR #408, #409, #410 и #405 по фактическим diff, а не только по описаниям.

- **Каноническая реализация 2.5D — PR #408 (DepthRigManifest, Three.js adapter).** В нём есть runtime-путь в Avatar3DStage, проверка фактической parent hierarchy импортированной GLB/VRM-сцены до мутаций, fail-closed transform application, face morph/viseme resolver, secondary motion, capability gate и явный перевод измеренных суставных значений из MotorFrame #410.
- **PR #409 не должен становиться вторым runtime или второй схемой.** Его полезные свойства — нормализованные pivots/rest transforms, семантический affine composition, renderer-neutral layer contract и явная joint-to-node calibration — следует переносить в #408 как требования/миграционные тесты. До переноса PR #409 остаётся Draft-источником, не production-путём.
- **PR #410 — единственный канонический joint-space motor substrate.** Не переносить из PR #405 второй arbiter/controller; его renderer-specific mapping должен быть адаптирован к MotorFrame #410.
- **PR #415 — orchestration contract**, а не новый владелец позы или моторики. Его SemanticBodyState/adapter lifecycle должны потреблять canonical organism snapshot и измеренный MotorFrame, а не создавать конкурирующие моторные цели.
- **PR #408 пока остаётся Draft:** технический blockout не является авторским Kurisu artwork; layered production asset, реальные browser/device round-trip и проверка готового визуального результата остаются отдельными release gates.

### Целевая цепочка данных

OrganismCore → EmbodimentIntentV1 / MotorGoal → MotorFrame (#410) → renderer adapter (#408) → observed renderer state

Эмоции, речь, взгляд и личность остаются в каноническом состоянии организма. Renderer адаптирует и отображает команды, но не становится источником когнитивного состояния. При переключении renderer coordinator переносит immutable snapshot и текущий подтверждённый MotorFrame; неподдерживаемые каналы явно деградируют, а не синтезируются.

### Запреты на архитектурное расхождение

1. Не объединять #408 и #409 путём параллельного импорта двух DepthRigManifest типов.
2. Не использовать targetAngleRad как фактически достигнутую позу; renderer получает измеренный angleRad.
3. Не объявлять успешным handoff на основании postMessage, принятой команды или частичного Live2D ACK.
4. Не сливать #405 как независимый controller; извлечь полезные alias/mapping части в #410/#408.
5. Не называть blockout-модель готовым персонажем и не обновлять Release ZIP до проверки production assets и E2E.



## Проверка границ наблюдаемости Pixi Live2D Display 0.4.0

Проверена документация именно закреплённой в viewer версии `pixi-live2d-display@0.4.0` (MotionManager, InternalModel, MotionManagerEvents):

- `model.motion(group, index)` возвращает `Promise<boolean>`: `true` означает успешный запуск motion, а не окончание клипа.
- `internalModel.motionManager` предоставляет `isFinished()` и `playing`, но это агрегированное состояние менеджера, не подтверждение завершения конкретного `group/index/motionToken`. Фоновая/idle motion также может влиять на это состояние.
- В документированном `MotionManagerEvents` перечислены `destroy`, `motionLoaded` и `motionLoadError`; публичного per-motion completion event в этой версии не обнаружено. Внутренний callback `_startMotion(..., onFinish)` защищённый/абстрактный, поэтому viewer не должен подменять его недокументированным событием.
- `InternalModel` подтверждает доступ к `coreModel` и `motionManager`, но само наличие обновления параметров или завершившегося менеджера не доказывает, что нужный визуальный результат был представлен GPU.

**Решение:** оставить `motionStatus: started` только как подтверждение успешного dispatch. Не добавлять `motion-completed` и не выставлять `visualCompletionVerified` без собственного проверяемого механизма, который коррелирует конкретный motion token с наблюдаемым завершением и представленным кадром. Следующий корректный путь — собственный adapter-level instrumentation/renderer frame evidence, а не угадывание имён событий SDK.

Источники API: [MotionManager 0.4.0](https://guansss.github.io/pixi-live2d-display/api/classes/index.MotionManager.html), [MotionManagerEvents 0.4.0](https://guansss.github.io/pixi-live2d-display/api/interfaces/index.MotionManagerEvents.html), [InternalModel 0.4.0](https://guansss.github.io/pixi-live2d-display/api/classes/index.InternalModel.html).
