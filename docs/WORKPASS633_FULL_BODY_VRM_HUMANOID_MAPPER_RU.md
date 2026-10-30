# NK1 WorkPass 633 — Full-body VRM humanoid mapper

Дата: 2026-10-30  
Область: VRM 0.x / VRM 1.0 / generic glTF humanoid name compatibility.

## Что изменено

- Семантический словарь расширен от шести моторных ролей верхней части тела до torso, eyes/jaw, shoulders, arms, hands, всех поддерживаемых VRM finger joints, legs, feet и toes.
- `buildHumanoidRoleMap` читает authoritative node indices из VRM 1.0 `VRMC_vrm.humanoid.humanBones` и VRM 0.x `VRM.humanoid.humanBones`.
- Неизвестные роли и некорректные node indices не попадают в карту.
- Добавлены aliases для Mixamo, Blender `.L/.R`, и VRM/J_Bip, включая числовые finger joints (1/2/3 → proximal/intermediate/distal).
- 3D stage собирает normalized nodes Pixiv three-vrm для всего humanoid набора, а не только head/neck/arms. Existing motor intent remains limited to its explicitly implemented channels.

## Контракт и ограничения

1. VRM humanoid API имеет приоритет над именами узлов.
2. Name matching — compatibility fallback, не доказательство правильной топологии.
3. Bone discovery не является IK, locomotion, foot planting, hand contact, twist correction или motion retargeting.
4. Сброс/анимация костей зависит от реального rig, bind pose, skin weights и клипов; требуется проверка на реальных разных VRM телах.
5. Наличие finger roles не гарантирует корректную кисть: нужны anatomical pose tests и визуальная проверка.

## Regression coverage

- VRM 1.0 custom node indices.
- VRM 0.x legacy array mapping.
- Mixamo / Blender / J_Bip aliases.
- Finger chain naming and unknown-role rejection.
- Active stage source contract.

Команда: `npm run test:avatar-humanoid-bones`.

## Следующий проход

- Разделить semantic bone inventory и runtime control channels.
- Добавить motion retarget profile с rest-pose normalization и scale-aware limb lengths.
- Проверить VRMA клипы на разных пропорциях тела, включая foot contact и arm reach.
- Не объявлять Aspect #5 завершённым до real-model visual E2E и Android resource soak.
