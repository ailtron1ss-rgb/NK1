# NK1 Aspect 09 — Live2D expressive body control (2026-10-30)

## Scope

This workpass improves the existing Cubism avatar only. It does not claim to create a full skeletal body, free IK, or new authored motion clips. The target is to use the actual parameters already present in the canonical Kurisu rig to add continuous expressive control while preserving the existing motion/physics pipeline.

## Baseline

- Source baseline: `workpass70-source` at `ad564d1879028f00549be41ec5172a2f72e25897`.
- Latest GitHub Release remains `Neuro` / `NeuroKurisu0.1`, published 2026-10-19, with `Neuro_Kurisu_WORKPASS70_2026-10-19.zip` (135,290,615 bytes). This workpass does not claim to update that release.
- Canonical model: `runtime/neuro-kurisu/public/live2d/Kurisu/Kurisu.model3.json`.
- Existing registered motion inventory: Idle x1, TapHead x1, TapBody x1, Special x2.
- The CDI3 parameter inventory includes head/body angles, eye open/smile/ball, brows, mouth, cheek, breath, arm physics, hair physics, tie/shirt/coat/collar/shoes physics.
- Current application contract already transports expression/intensity, mouth visemes, gaze, head tilt, gesture and a bounded motion group/index/token.

## Changes in this pass

6. Made speech cancellation preempt the currently playing Cubism motion instead of relying on the Idle clip's default priority:
   - Verified against the exact pinned `pixi-live2d-display@0.4.0` source: `model.motion(group, index, priority)` accepts a priority argument; `MotionPriority.FORCE` is enum value 3 and forces playback regardless of current priority.
   - The runtime normalizer now preserves `speechPhase`; both viewer entry points select FORCE only for a validated cancelled phase and NORMAL for ordinary motion intents.
   - The Cubism 4 motion manager stops its previous queue when the forced motion starts. This is source/API-grounded, but exact on-device interruption latency still requires browser/Android validation.
7. Защитил асинхронные переходы между Cubism motion в обоих viewer:
   - Каждый новый запрос получает монотонный `motionRequestSequence`; поздний resolve/reject предыдущего запроса не может сбросить состояние или отправить устаревшую ошибку поверх более нового жеста.
   - Если текущий запрос отклонён или вернул `false`, его ключ очищается, чтобы следующий intent мог повторить запуск; синхронные исключения также обрабатываются.
   - Добавлены одинаковые регрессионные проверки для app/runtime viewer. Это защита порядка команд, а не доказательство фактической длительности анимации на устройстве.

1. Added continuous facial parameter composition to both the app-served and runtime Live2D viewers:
   - brow vertical position and angle;
   - left/right eye-smile;
   - cheek/blush intensity;
   - expression-specific profiles for happy, sad, angry, surprised, flustered, embarrassed, thinking, focused, tender, sarcastic, smug, looking-away and tired.
2. Added low-amplitude torso follow-through through existing body-angle parameters, driven by gaze and head tilt.
3. Added continuous breathing through the existing `ParamBreath` parameter, with bounded amplitude modulated by arousal/expression intensity.
4. Kept the existing Cubism update ordering: NK1 overrides are applied at `beforeModelUpdate`, after authored motion and physics have evaluated.
5. Extended avatar motor intent regression assertions to ensure both viewer entry points retain the new channels.

## Design constraints

- This is additive modulation, not a replacement for authored Cubism motion or physics.
- Every output is clamped to a conservative range; unknown expressions fall back to neutral.
- No unsupported motion group or clip is invented.
- The face/body controls use parameters confirmed in the shipped CDI3 inventory.
- The two viewer entry points are kept in sync to prevent app/runtime drift.

## Remaining work

### P0
- Run `npm run test:avatar-motor-intent` and typecheck/build on this exact branch head.
- Browser E2E: verify actual model responds to brow/eye/cheek/body/breath channels and does not fight expressions or physics.
- Test low-memory/mobile profile and sustained 15+ minute operation.
- Measure visual stability and confirm no parameter flicker or unnatural resting expression.

### P1
- Add continuous upper-arm/forearm/hand intent only after inspecting the model's parameter ranges and the authored physics output; avoid writing directly over physics channels.
- Add expression transition hysteresis and blend timing, rather than repeatedly re-triggering expression assets.
- Add a calibrated gaze target model and blink scheduling with reduced-motion support.
- Expand authored motion inventory only with licensed, provenance-tracked clips.

### Explicit non-goals for this pass
- No claim of arbitrary hand/finger control: Live2D rig parameters are not a humanoid skeleton.
- No claim of real acoustic phoneme lip-sync: the current browser speech timeline remains a grapheme/boundary approximation.
- No claim of production-ready clothing swapping: the current model has authored outfit geometry, not a general garment attachment system.
- No Release ZIP refresh until source checks, archive provenance and license review pass.

## Progress estimate

- Existing Live2D foundation: 65/100.
- Continuous face/body channel coverage after this code pass: estimated 50/100.
- Aspect 01 overall: estimated 68/100 before device E2E; code-level gains do not substitute for visual acceptance.


## Дополнение: плавное смешивание мимики

После прохождения исходного CI добавлен ограниченный low-pass переход для каналов бровей, угла бровей, улыбки глаз и румянца. Он сглаживает смену эмоциональных состояний без подмены авторских Cubism motion/physics. Коэффициент смешивания фиксирован (`0.18` на вызов `beforeModelUpdate`); визуальная настройка под частоту кадров и Android ещё требует проверки.


### Дополнение: семантическое направление взгляда

Планировщик моторики теперь формирует gazeX/gazeY вместе с действием организма: исследование направляет внимание вправо, рефлексия — влево/вверх, объяснение — к условной области демонстрации, поддержка — мягче вниз. Валентность и возбуждение дают небольшую ограниченную поправку; координаты всегда ограничены диапазоном [-0.4, 0.4]. AvatarStage передаёт эти значения из единого motorPlan, а не поддерживает отдельную конкурирующую таблицу взглядов. Это семантическая цель, не трекинг реального объекта и не глазная IK; плавность перехода и визуальная калибровка остаются задачей следующей проверки на модели/устройстве.


### Дополнение: воспроизводимый взгляд и микродвижения

Смысловая цель взгляда теперь сглаживается отдельно от микросаккад, а микросаккады и интервалы моргания получают значения из детерминированной последовательности, привязанной к `stateVersion` и счётчикам цикла. Это устраняет `Math.random()` из обоих viewer runtime и упрощает воспроизведение одинаковых сценариев. Коэффициенты и амплитуды остаются инженерными начальными значениями: визуальная калибровка на реальном Cubism canvas и Android ещё не выполнена.


## Дополнение: семантические профили жестов (2026-10-30)

- Motor planner теперь различает профили `considering`, `presenting`, `examining`, `reassuring`, `emphatic` и `none`, а также выдаёт ограниченную интенсивность 0–0.8.
- Профиль применяется в существующем канале наклона головы и компонуется с уже выбранным motion clip; протокол EmbodimentIntentV1 и список Cubism motion groups не расширялись.
- Это семантическое разнообразие верхнего корпуса/головы, а не управление руками, пальцами или IK. Для настоящих жестов рук нужны отдельные проверенные Cubism motion assets или полноценный skeletal/VRM rig.
- Добавлены регрессии на соответствие профиля когнитивному действию, объяснению, исследованию и поддержке. Визуальная настройка амплитуды остаётся отдельным этапом.


## Дополнение: семантический жест передаётся в корпус (2026-10-30)

- `AvatarStage` передаёт `gestureProfile` и ограниченную `gestureIntensity` через существующий EmbodimentIntentV1.
- Оба viewer компонуются с подтверждёнными каналами `ParamBodyAngleX/Y`: лёгкий наклон/сдвиг верхнего корпуса различается для размышления, исследования, презентации и поддержки.
- Поля добавлены как необязательные: старые v1 envelopes остаются допустимыми и нормализуются в `none/0`. Неизвестные профили и интенсивности выше 0.8 отвергаются.
- IK, суставы рук и новые анимационные клипы не заявляются. Визуальная настройка амплитуды на реальном canvas/Android остаётся pending.


## Авторские движения рук и кистей

- Проверены реальные motion assets из `Kurisu.model3.json`, а не только названия групп.
- `Special[1]` (`xhiyori_m03.motion3.json`, 4.57 с) содержит кривые `ParamArmLA`, `ParamArmRA`, `ParamHandL`, `ParamHandR`, а также плечевые и корпусные каналы.
- Объяснительный motor intent теперь выбирает этот существующий authored clip вместо `TapBody`, в котором нет кривых рук/кистей. Другие действия сохраняют прежнюю маршрутизацию.
- Добавлен regression test, который читает сам JSON motion asset и проверяет наличие четырёх кривых рук/кистей и выбор `Special[1]` для объяснения.
- Это использование готовой Cubism-анимации, а не IK, генерация новой анимации или доказательство визуального качества на устройстве. Нужны browser/Android visual acceptance.


## Дополнение: сброс жеста при отмене речи (2026-10-30)

- При фазе `cancelled` AvatarStage теперь явно отправляет `Idle[0]` вместо продолжающегося motion intent ответа.
- В том же envelope обнуляются наклон головы, профиль и интенсивность жеста; это не позволяет уже отменённой реплике продолжать визуально «объяснять» или жестикулировать.
- Добавлен regression guard на ветку отмены. Фактическое время прерывания текущего Cubism clip и визуальное поведение `Idle` требуют проверки в браузере/на Android; это изменение гарантирует корректный новый intent, но не заявляет измеренную latency.


## Дополнение Aspect 09: временная стабильность анимации и контракты активов

### Изменения этого прохода

- App viewer остаётся классическим inline script ради совместимости message-handler regression harness и динамически импортирует timing helpers до запуска Cubism; runtime viewer импортирует их статически.
- Вынесены общие чистые функции `smoothToward`, `smoothingAlpha` и `sampleBlink` в `temporal-smoothing.mjs`; идентичная версия размещена в app и runtime asset roots, а контрактный тест проверяет побайтное равенство.
- App viewer переведён на ES module entry point и импортирует те же проверяемые временные функции, что и runtime viewer.
- Сглаживание мимики, рта, формы рта, семантического взгляда и микросаккад теперь зависит от elapsed seconds и time constant, а не от количества кадров.
- Моргание рассчитывается по абсолютному времени относительно старта 180 ms blink envelope. Форма закрытия/открытия симметричная и не накапливает множители на каждом тике.
- Профили лица вынесены из hot update path; добавлен отдельный консервативный уровень открытости глаз для нейтрального, радостного, грустного, злого, удивлённого, задумчивого, сосредоточенного и уставшего состояния.
- Добавлен `app/scripts/live2d-production-contract.test.mjs`: проверяет замкнутость FileReferences, существование motion/expression/texture/physics/CDI-файлов, совместимость всех параметров записываемых обоими viewer с CDI3, входы/выходы Physics3, группы motion и выражения.
- Тест также проверяет frame-rate invariance на 30/60/144 Hz, границы blink envelope и равенство общих timing helpers.
- Добавлена команда `npm run test:live2d-production-contract`; существующий glob `test:scripts` также включает новый файл автоматически.

### Почему это нужно

Ранее коэффициенты `0.18`, `0.30`, `0.14`, `0.08` применялись один раз за тик. В результате фактическая скорость мимики, взгляда и рта зависела от частоты кадров и throttling (в покое 14 Hz, при активности 30 Hz). Blink дополнительно использовал последовательное умножение `blinkT *= 0.72` и шаговое вычитание, поэтому продолжительность/форма зависела от расписания кадров. Теперь временная константа задаёт поведение в секундах, а не в количестве callback-вызовов.

### Приёмка и оставшиеся ограничения

- Кодовый контракт: проверяется новой тестовой группой.
- Визуальная приёмка модели: не выполнена этим коммитом.
- Browser E2E и проверка скрытой/повторно открытой вкладки: pending.
- Android low-memory/thermal soak 15+ минут: pending.
- Реальный acoustic phoneme lip-sync не добавлен; текущая временная шкала речи остаётся текстово/boundary-ориентированной.
- Произвольная суставная моторика и независимая смена одежды не добавляются в Live2D: возможности ограничены авторским Cubism rig.

### Обновлённая оценка

- Live2D foundation: 65/100 до этого прохода.
- Temporal/expressive runtime reliability: улучшен на уровне кода; устройство ещё не проверено.
- Aspect 09 overall: 70/100 по реализованной кодовой части, но ниже 100% из-за отсутствия визуальной/browser/Android приёмки и расширенной калибровки.
- Release ZIP не обновлялся.


## Финальная фиксация этого кодового прохода (2026-10-30)

- Оба viewer отклоняют неизвестную motion group, дробный/отрицательный индекс и индекс за пределами числа клипов канонической модели ещё до вызова Cubism playback. Защита действует и для legacy compatibility message path.
- Production contract test фиксирует эту защиту и совпадение motion inventory обеих точек входа с `Kurisu.model3.json`.
- На HEAD `b8f2995bd086681b198529259a68bf75cf09909a` все шесть PR status checks завершились успешно. `targeted-and-regression` включает app script regression suite, app typecheck/build, runtime typecheck, Live2D regression, memory/persistence, speech gateway и cognitive runtime tests.
- Кодовая оценка Aspect 09 после прохода: 72/100. Это оценка программной зрелости и автоматической проверяемости; полная визуальная и Android-приёмка не выполнена.
- Не закрыто: browser visual E2E на реальном Cubism canvas, калибровка всех каналов на нескольких размерах экрана, Android low-memory profile, 15+ минутный device soak, измерение lip-sync/interrupt latency и акустические phoneme/viseme данные.
- PR остаётся draft, Release ZIP не обновлялся.


## Дополнительный проход: единый моторный профиль 2D/3D (2026-10-30)

- Добавлен общий `resolveAvatarGestureArmTargets(...)`: профили `considering`, `presenting`, `examining`, `reassuring`, `emphatic` преобразуются в ограниченные асимметричные цели плеч с учётом эмоции и бодрствования.
- `Avatar3DStage` теперь использует тот же `planAvatarMotorIntent(...)`, что и Live2D. Процедурные руки и распознанные плечевые/верхне-плечевые кости импортированной GLB/VRM-модели получают единый профиль жеста; отдельная таблица «действие → угол рук» удалена.
- Добавлены проверки диапазонов, асимметрии презентационного жеста, эмоциональной модуляции, нейтрализации во сне и фактического подключения 3D viewer.
- Ограничение: это общий высокоуровневый моторный план и адаптер плеч, а не полный IK. Локти, кисти, пальцы, предотвращение столкновений и физика одежды требуют полноценного humanoid rig и отдельного IK/retarget слоя.
