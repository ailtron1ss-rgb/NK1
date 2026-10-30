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
