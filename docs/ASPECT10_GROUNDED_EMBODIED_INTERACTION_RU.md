# [NK1][Aspect 10] Grounded embodied world interaction

Date: 2026-10-30
Branch: `aspect10-embodied-world-interaction-2026-10-30`
Base: `workpass70-source` at `ad564d1879028f00549be41ec5172a2f72e25897`

## Goal

Give NK1 a conservative, renderer-independent interaction planner that turns grounded world targets into body-level interaction plans and only accepts completion after a verified postcondition.

## Current architecture found

- `WorldContext.objects` and `GroundedWorldState` already represent objects, visibility, confidence and provenance.
- `WorldEnvironment` provides a simulated world for planning; it is not physical reality.
- `EmbodiedActionExecutor` gates real Android actions and correctly refuses to fabricate success when a device capability is absent.
- `ExternalPostconditionVerifier` distinguishes independent observation from command receipts.
- `MotorSchema` and the canonical ActionGateway already own governed tool execution.
- `Avatar3DStage` currently loads a GLB/VRM and animates available clips, but does not expose a general hand/object contact or IK API.

## Implemented in this pass

Added `EmbodiedInteractionController`, a pure planning/assessment layer:
1. Grounded target identity, visibility, observation freshness and confidence checks.
2. Spatial distance and arm-reach checks.
3. Explicit hand availability and target affordance checks.
4. Deny-by-default contact/manipulation policy.
5. Hazard-name denylist as a conservative extra guard (not a substitute for semantic safety classification).
6. Plans for look, inspect, reach, touch, grasp, release and press.
7. Every plan requires a capability adapter and postcondition.
8. Unknown execution or missing verification becomes `uncertain`, never success.
9. Result is bound to the original plan and target ID to reject stale/mismatched receipts.

## Important boundaries

- This controller does not move a real 3D rig, control a phone camera, manipulate a physical robot, or prove contact. It produces a validated intent for a future renderer/device adapter.
- The existing simulator must not be used as evidence that a real-world object was touched or grasped.
- Contact and manipulation are disabled by default. An adapter must independently enforce policy, permissions, collision limits, joint limits and emergency stop.
- No automatic interaction with people, dangerous objects, unknown chemicals, hot surfaces or electrical equipment is authorized by this module.
- Existing ActionGateway remains the only route for external side effects.

## Validation

Run:
`node --experimental-strip-types runtime/neuro-kurisu/tests/aspect10-embodied-interaction.mjs`

Expected: deterministic planner tests covering grounded look, reach, contact policy, hazards, stale observations, confidence, affordances, adapter gate, postcondition verification, target binding and stale plan rejection.

## Next work

1. Connect actual camera/object detections to `InteractionTarget` with calibrated 3D coordinates and uncertainty.
2. Add renderer adapters for Live2D gaze/pointing, 2.5D depth rig and VRM humanoid IK.
3. Implement collision-aware hand trajectories and contact sensors/visual postconditions.
4. Add persistent interaction episodes and causal learning from verified outcomes.
5. Validate on desktop and Android; do not claim physical manipulation until hardware-backed tests exist.


## Следующий слой: независимая кинематика руки

Добавлен renderer-independent `planarArmIK.ts`: двухзвенная плоская IK-модель (плечо + предплечье), ограничение углов суставов, контроль длины сегментов, confidence gate, единый calibrated avatar-root frame и безопасное ограничение недостижимых целей. Модуль только рассчитывает углы — он не запускает анимацию и не подтверждает контакт. Для интеграции с VRM/GLB нужно сопоставить его углы с реальными humanoid bones, учесть bind pose, оси скелета, ограничения модели и коллизии.


## Calibrated VRM humanoid rig mapping foundation

- Added `vrmHumanoidRigAdapter.ts` to resolve a unique left upper-arm/lower-arm pair from common humanoid bone names and convert planar IK angles into bind-pose-relative Euler targets.
- The adapter requires explicit per-rig axis, sign, offset and joint-limit calibration. It refuses missing/ambiguous bones, invalid calibration and non-finite bind poses; it does not assume a universal VRM bone axis.
- Added deterministic adapter tests and a dedicated CI step.
- This is a mapping/pose-calculation seam only: `Avatar3DStage` does not yet apply these targets to a live rig. Right-arm mapping, calibrated model profiles, 3D IK, collision checks and execution/postcondition wiring remain pending.

### Подключение к 3D-сцене

- `Avatar3DStage` теперь использует resolver при загрузке локального VRM/GLB и сообщает, какие из левой/правой цепей верхняя рука + предплечье удалось однозначно распознать.
- Resolver поддерживает обе стороны и отказывается от неоднозначных/неполных пар. Это discovery-интеграция: существующие клипы и моторные смещения остаются прежними; рассчитанные IK-углы ещё не применяются к костям.
- Добавлена проверка source contract для 3D-сцены; CI path filters включают stage и его тест.

## Безопасная bind-pose основа для VRM IK

- Добавлены captureVrmArmBindPose, computeVrmArmPose, applyVrmArmPose и restoreVrmArmBindPose.
- IK-цель теперь вычисляется от сохранённого снимка bind pose, а не от текущих вращений костей. Это предотвращает накопление углового дрейфа при повторных вычислениях в animation loop.
- Применение поддерживает ограниченный blend weight, проверку идентичности костей и конечности значений; исходная поза может быть восстановлена плавно или полностью.
- Удалён alias LeftShoulder/RightShoulder как подмена upper-arm: одна только плечевая кость не доказывает корректную пару плечо–предплечье.
- Добавлены регрессии на неизменность bind snapshot, отсутствие дрейфа, применение/восстановление, mismatch identity и invalid blend weight.
- Важно: это готовый безопасный seam, но он ещё не вызывается из live Avatar3DStage. Калибровка осей конкретной модели, конфликт с animation mixer, 3D IK и collision-aware execution остаются отдельными gates.

## Профили калибровки конкретной VRM-модели

Добавлен `vrmRigCalibrationProfile.ts`: версионированный двусторонний профиль привязывается к fingerprint модели, ID системы координат, происхождению калибровки и точным именам костей upper-arm/forearm слева и справа. Профиль отклоняется при несовпадении модели/системы координат/костей, отсутствии одной из цепей, неизвестной версии схемы или некорректных осях, знаках и пределах суставов. Принятый профиль замораживается перед использованием. Это контракт проверки, а не автоматическая калибровка: значения должны быть измерены/проверены для конкретной модели. Live IK в Avatar3DStage не включён.

### Уточнение границы импорта калибровки

Проверка профиля теперь различает структурно некорректный документ и численно небезопасную калибровку: для второго случая возвращается отдельный `invalid-calibration`. Смещения и границы суставов ограничены диапазоном ±2π радиан, имена костей не могут быть пустыми/пробельными. Эти пределы защищают импорт от явно неправдоподобных значений, но не заменяют измерение осей и диапазонов на конкретной модели.

### Импорт и экспорт профиля

- Добавлены \`parseVrmRigCalibrationProfileJson\` и \`serializeVrmRigCalibrationProfileJson\`.
- Импорт ограничен 32 KiB, обрабатывает некорректный JSON без выброса исключения и всегда проверяет профиль против уже загруженной модели, coordinate frame и обеих фактически разрешённых цепей костей.
- Экспорт повторно валидирует профиль перед сериализацией; при несовпадении модели/риг-схемы возвращает \`null\`. JSON формируется в фиксированном порядке полей для стабильного diff/round-trip.
- Это безопасный программный import/export seam, не UI-мастер калибровки и не доказательство достоверности заявленных измерений. Значения \`manual-measured\` должны быть получены реальными измерениями; импортированный файл не становится доверенным только из-за валидного JSON.


### Получение калибровки из измеренной эталонной позы

- Добавлен `calibrateVrmArmFromMeasurement`: вычисляет смещение оси плеча/локтя из bind-pose и эталонной позы с заранее известными углами fixture; оси и знаки задаются явно для каждой руки.
- Отклоняются слишком малые эталонные движения, нецелевое вращение по другим осям, нечисловые данные, небезопасные диапазоны и эталонные значения за пределами измеренных суставных лимитов.
- `createMeasuredVrmRigCalibrationProfile` строит двусторонний профиль только для уже разрешённых костей конкретной модели и повторно пропускает его через строгую проверку fingerprint/frame/bone identity.
- Это инструмент вычисления из предоставленных измерений, а не автоматический визуальный wizard: известные fixture-углы и joint limits должны быть получены независимо; анимационный клип или произвольная поза не считаются ground truth. Live IK остаётся выключенным.


## Сессии захвата калибровки с происхождением измерений

Добавлен `vrmRigCalibrationSession.ts` как следующий программный слой перед визуальным мастером:

- `createVrmRigCalibrationSession` фиксирует неизменяемую двустороннюю bind pose, fingerprint модели, coordinate frame, имя модели и точные имена четырёх костей.
- `captureVrmRigReferencePose` принимает только ту же модель и те же кости, сохраняет эталонную позу, обязательный ID fixture, ISO-время и ограниченную заметку оператора.
- `finalizeVrmRigCalibrationSession` вычисляет обе руки из bind/reference snapshots с независимо заданными углами fixture, осями, знаками и измеренными joint limits; итоговый профиль повторно проходит проверку активной модели.
- JSON sidecar сохраняет исходные снимки и происхождение измерений отдельно от runtime-профиля. Он нужен для аудита/повторяемости, но сам по себе не является подписью или доказательством корректности fixture.
- Добавлены отдельный npm test script и focused CI gate для создания сессии, неизменяемости снимков, provenance, точного совпадения rig identity, отказа при отсутствии эталонной позы и успешной финализации.

Ограничение: это API capture-session, не интерактивный wizard. Визуальное ручное управление костями, блокировка animation mixer во время съёма, SHA-256 fingerprint реального файла и UI импорта/экспорта остаются следующими шагами. Не применять IK к живому VRM только на основании созданной сессии.


## [NK1][Aspect 10] Evidence-gated interaction hardening — 2026-10-30

### Changes in this pass
- Correct the arm-reach unit contract: `reachM` is metres and is no longer clamped to a normalized 0..1 interval. Invalid or implausible values are rejected.
- Bind an interaction plan to the camera-track ID, canonical world-entity ID, coordinate frame and world revision.
- Give each plan a monotonic sequence and finite execution lifetime. Repeated plans created in the same millisecond cannot share an ID; the expiry boundary is exclusive.
- Fix Unicode/case/whitespace normalization. The bridge validates world-snapshot freshness/confidence, rejects ambiguous same-label entities instead of selecting the newest row, validates entity identity/presence, and allowlists affordances.
- Require a verifier-backed, short-lived, provenance-bearing safety authorization for touch/grasp/release/press. A detector's `safeToTouch` boolean is only a legacy hint and cannot authorize contact alone.
- Require independent postcondition evidence bound to the exact plan, target, world entity and coordinate frame. Evidence must be fresh, sufficiently confident, provenance-bearing and accepted by an injected trusted verifier. Grounded plans require a non-regressing world revision.
- Reject unknown adapter/postcondition status values and malformed hands, affordances, hand availability and world entities.
- Simulator interactions are limited to look/inspect and are returned as `simulated`, never as proof of a real-world action.

### Validation
- `node --experimental-strip-types tests/aspect10-embodied-interaction.mjs`: 40 assertions pass.
- `node --experimental-strip-types tests/aspect10-grounded-bridge.mjs`: 13 assertions pass.
- The existing focused workflow already invokes `npm --prefix runtime/neuro-kurisu run test:aspect10:interaction`; no package-script change is needed.

### Explicit remaining boundary
This pass hardens grounded planning, safety authorization and the evidence gate. It does **not** add a physical camera pipeline, move a live VRM/2.5D rig, prove hand contact, or manipulate real objects. These still require calibrated sensor/renderer adapters, independently measured rig geometry and hardware-backed verification. Simulation remains separate from physical evidence.
