# NK1 Embodiment Motor Foundation — WorkPass 628

Дата: 2026-10-30  
База: `workpass70-source`  
Ветка: `work/nk1-embodiment-motor-foundation-2026-10-30`

## Назначение

Добавлен renderer-independent моторный фундамент для трёх тел NK1: Live2D, будущего depth/2.5D rig и VRM/3D. Это не новый автономный мозг и не замена существующему `planAvatarMotorIntent`. Модуль принимает предложения от когнитивных/эмоциональных/социальных контроллеров, разрешает конфликты, ограничивает суставы и выдаёт безопасные цели для конкретного renderer adapter.

## Что добавлено

- `solveTwoBoneIK`: устойчивое аналитическое решение двухзвенного IK с pole vector; недостижимая цель проецируется на достижимую область.
- `resolveMotorProposals`: приоритетное разрешение конфликтов на уровне каждого сустава; равноприоритетные источники смешиваются по весу; неподдерживаемые суставы и NaN/Infinity отклоняются.
- `advanceJointPose`: ограничение скорости изменения суставов по delta-time, чтобы избежать телепортации позы и зависимости от FPS.
- `filterPoseForCapabilities`: явное согласование позы с возможностями конкретного тела. Неподдерживаемые каналы возвращаются отдельно, а не молча имитируются.
- Регрессионные тесты на геометрию IK, недостижимые цели, приоритеты, некорректные числа, скорость и capability filtering.

## Архитектурные решения

1. **Один моторный контракт, много исполнителей.** Источники намерения не импортируют конкретный renderer.
2. **Безопасность выше выразительности.** Ограничения суставов и safety proposals имеют больший приоритет, чем жесты и idle-анимация.
3. **Нет ложного подтверждения действия.** Вычисленная цель — не доказательство того, что модель реально выполнила движение; adapter должен возвращать наблюдаемый результат.
4. **Никаких случайных движений.** Модуль детерминированный; вариативность должна происходить из намерения, контекста и проверяемых параметров.
5. **Обратная совместимость.** Существующий Live2D intent v1 остаётся источником семантического намерения. Новый моторный слой — следующий уровень, не ломает текущий протокол.

## Предлагаемая интеграция

- Live2D: capability map ограничивает доступные параметры; суставные цели переводятся в параметрические offsets рига.
- 2.5D: IK elbow/wrist и depth transforms применяются к layered mesh rig.
- VRM: canonical joints retarget-ятся на normalized humanoid bones; IK исполняется до mixer/после базовой анимации согласно выбранной pose policy.
- Все адаптеры должны возвращать `requestedPose`, `appliedPose`, `unsupportedChannels`, `constraintsHit` и `executionStatus`.

## Реальная интеграция WorkPass629

- `Avatar3DStage` создаёт адаптер при загрузке GLB/VRM и строит карту каналов по реально найденным костям; распознаются стандартные VRM `J_Bip_*`, распространённые имена Humanoid и Mixamo.
- Когнитивное действие и аффективная экспрессия формируют отдельные предложения; приоритеты разрешаются единым motor controller, затем скорость и пределы суставов ограничивают движение.
- Адаптер накладывает каналы на текущую позу GLTF AnimationMixer, а не заменяет клипы; неподдерживаемые каналы не исполняются и не считаются успешными.
- Проверки адаптера используют тестовый скелет. Проверка на реальном пользовательском VRM/GLB-файле и браузерный E2E пока не выполнены.

## Ограничения этой итерации

- Это математическое ядро с первой runtime-интеграцией в загружаемый GLB/VRM путь; это ещё не полноценная биомеханика или подтверждённый результат на реальной модели.
- Нет полного скелета встроенного процедурного персонажа; его текущие части всё ещё частично жёсткие.
- Не реализованы foot planting, баланс всего тела, collision/contact solver, grasping, пальцы и физическая симуляция одежды.
- IK — геометрический solver; реальный renderer adapter обязан учитывать локальные системы координат, bind pose, skinning и ограничения конкретной модели.

## Проверка

Запустить из `app/`:

```bash
node --experimental-strip-types --test scripts/body-motor-controller.test.mjs
```

Далее обязательны typecheck, browser E2E и проверка на нескольких лицензированных VRM/GLB скелетах.


## WorkPass 630 — CI-driven VRM adapter correction

The first exact-branch validation run exposed two test failures in `vrm-motor-adapter.test.mjs`:

1. The adapter mapped `J_Bip_C_Neck` to `neckYaw` but omitted the same bone alias for `neckPitch`. Both channels now share the verified normalized alias.
2. The additive-Euler test used strict equality for a floating-point sum (`0.1 + 0.2`), which is not a valid precision contract. Assertions now use a tight `1e-10` tolerance.

The runtime order was inspected: `Avatar3DStage` restores the loaded bones' baseline rotations, updates the GLTF mixer, and only then applies the motor pose. This establishes a per-frame base pose and prevents accumulated offsets.

The correction is committed on the same PR branch. A fresh exact-head workflow result is required before marking this pass validated. The test does not establish IK execution on a real VRM model.
