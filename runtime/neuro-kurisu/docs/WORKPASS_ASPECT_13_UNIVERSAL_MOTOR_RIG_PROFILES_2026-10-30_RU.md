# NK1 — WorkPass: Aspect 13, универсальная моторная система

Дата: 2026-10-30. База: `work/nk1-autonomous-motor-control-2026-10-30`, PR #410.

## Что уже было в #410

Единый EmbodiedMotorController, приоритеты и expiry моторных целей, ограничения угла/скорости/ускорения/рывка, quaternion FK, position/pose IK, multi-effector IK до шести целей, MotorFrameChannel, организм-владелец runtime и ограниченный 20 Hz loop. На точном исходном HEAD #410 имел 23 успешных CI-проверки.

## Что добавляет Aspect 13

- `MotorRigProfileV1`: единая versioned schema для Live2D, 2.5D DepthRig и VRM3D.
- Каталог из 62 стабильных canonical joint roles: ось головы/шеи/корпуса/таза, плечи, локти, предплечья, запястья, ноги и базовые каналы пальцев.
- Явные единицы, координатная система, renderer target, X/Y/Z компонент для пространственных костей и per-joint limits.
- Проверка калибровочного evidence metadata, topology, parent cycles, уникальности ролей и target-channel, геометрии, осей и лимитов.
- Live2D всегда объявляет fidelity=approximate: параметр Cubism не притворяется независимой скелетной костью.
- Компиляция в существующий EmbodiedMotorController и SkeletalKinematics3D; единый MotorFrame проецируется в renderer-specific command batch.
- Runtime принимает только production-calibrated профиль и показывает активный renderer/profile. Отклонённая конфигурация не подменяет существующую.
- Workflow #410 запускает новые pure-profile и runtime integration regressions.

## Проверки

Локально до публикации прошли профильные проверки (62 роли, валидация, renderer mapping, fail-closed calibration, общая native bone с несколькими осями) и runtime integration test, а также strict TypeScript check новых модулей на изолированной type surface. Полный GitHub runtime typecheck и CI необходимо подтвердить на новом commit SHA после публикации.

## Что не объявляется завершённым

Production-calibrated профили конкретной Курису пока не созданы. Renderer readback receipts и device/browser E2E отсутствуют; 3D IK adapter, баланс, контакт/foot planting, столкновения, grasp и autonomous MotorGoal genesis из OrganismCore ещё не подключены. Command batch — это проекция, не доказательство применённого движения.

## Следующие шаги

1. Калибровать конкретные Live2D Cubism parameters, 2.5D node graph и VRM humanoid skeleton с подписанными/проверяемыми evidence receipts.
2. Перевести DepthRig и VRM адаптеры на один MotorFrame и профиль, удалить дублирующий renderer-specific controller.
3. Возвращать readback receipt с profileId, model generation, frameTick, goalId и measured joint values.
4. Подключить безопасную генерацию моторных целей из OrganismCore через единственный ActionGateway/EthicalGate.
5. Довести FABRIK fallback, баланс, contact dynamics и grasp; проверить round-trip смены тел и Android/Desktop E2E.

## Definition of Done

Один моторный controller управляет всеми откалиброванными телами через валидированные профили; каждый renderer честно объявляет capabilities; каждая команда получает подтверждение наблюдаемого результата; недостижимые и неподдерживаемые движения возвращаются в sensorimotor feedback loop и не считаются исполненными.
