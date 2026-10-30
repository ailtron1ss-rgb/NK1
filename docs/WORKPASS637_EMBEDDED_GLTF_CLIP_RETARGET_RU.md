# WorkPass637 — Embedded GLTF clip retarget baking

## Добавлено

- `threeHumanoidClipRetarget.ts` — Three.js adapter: проигрывает source GLTF `AnimationClip` на временном `AnimationMixer`, семплирует локальные quaternion позы и запекает target-local quaternion tracks.
- Семантическое сопоставление выполняется по humanoid-ролям; для каждой роли обязательна парная world-rest axis calibration. Некалиброванные роли не получают silent fallback.
- Для hips переносится height-scaled локальное смещение с ограничением амплитуды. Quaternion tracks адресуются UUID целевых узлов.
- В `Avatar3DStage.tsx` добавлен отдельный импорт source VRM/GLB с embedded GLTF animations. Source rig загружается как скрытый временный объект в общей сцене, его clips запекаются на текущий target rig и попадают в существующий motion selector.
- При смене target-модели clips пересобираются от сохранённого source rig; при reset и unmount source asset освобождается. Добавлена проверка runtime wiring и изоляции VRMA.

## Граница и безопасность

- Не передавать сюда VRMA-клипы после `createVRMAnimationClip(animation, activeVrm)`: Pixiv уже компилирует их под целевую VRM-модель.
- Переносятся humanoid rotations и hips displacement; expressions/visemes, root motion вне hips, IK, foot contact и spring bones не переносятся.
- Семплирование ограничено 60 Hz и 3600 кадрами. Source bone и root transforms восстанавливаются после baking; target rig не должен изменяться во время генерации клипа.
- Источник не сохраняется в IndexedDB: это отдельный временный motion source. Импорт остаётся локальным и проходит тот же self-contained GLB preflight.

## Проверка

Запускать `npm run test:avatar-three-humanoid-retarget`, `npm run test:avatar-3d-stage`, затем typecheck/build. До CI на точном SHA результат не считается подтверждённым.
