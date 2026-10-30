# WorkPass637 — Embedded GLTF clip retarget baking

## Добавлено

- `threeHumanoidClipRetarget.ts` — Three.js adapter, который проигрывает source GLTF `AnimationClip` на временном `AnimationMixer`, семплирует локальные quaternion позы и запекает target-local quaternion tracks.
- Семантическое сопоставление выполняется по ролям humanoid; для каждой роли обязательна парная world-rest axis calibration. Некалиброванные роли не получают silent fallback.
- Для hips переносится height-scaled локальное смещение с ограничением амплитуды. Quaternion tracks адресуются UUID целевых узлов, чтобы не зависеть от одинаковых имён костей у разных моделей.
- Добавлена regression suite с разными ориентациями и пропорциями source/target, плюс negative cases.

## Граница и безопасность

- Это первый baking adapter, а не готовая пользовательская функция импорта source-модели: отдельный source GLB lifecycle, hidden source scene node, UI выбора motion source и Android/browser E2E остаются следующим этапом.
- Не передавать сюда VRMA-клипы после `createVRMAnimationClip(animation, activeVrm)`: Pixiv уже компилирует их под целевую VRM-модель.
- Adapter переносит humanoid rotations и hips displacement; expressions/visemes, root motion вне hips, IK, foot contact и spring bones не переносятся.
- Семплирование ограничено 60 Hz и 3600 кадрами. Source rig восстанавливается к исходным transforms после baking; target rig не должен изменяться во время генерации клипа.

## Проверка

Запускать `npm run test:avatar-three-humanoid-retarget` и затем typecheck/build. До CI на точном SHA результат не считается подтверждённым.
