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
