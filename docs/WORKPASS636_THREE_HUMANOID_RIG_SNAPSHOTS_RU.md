# WorkPass636 — Three.js humanoid rig snapshots

## Что добавлено

- `threeHumanoidRigSnapshot.ts` снимает семантические rest-позы из реальных `THREE.Object3D` / `THREE.Bone` узлов.
- Сохраняются индексы семантических костей, локальные quaternion rest-повороты, мировые rest-повороты, длины доступных сегментов и высота модели.
- World rotation нормализуется относительно общего `frameRoot`. Это важно: source и target модели могут иметь разные transforms собственных GLTF roots, но basis должен быть выражен в одной внешней системе координат.
- Снимок выполняет `updateMatrixWorld(true)` перед чтением transform-ов, а не полагается на потенциально устаревшие матрицы.

## Контракт интеграции

1. Снять source и target snapshots до запуска анимации.
2. Передать один и тот же внешний `frameRoot` для обеих моделей.
3. Передать snapshots в `buildHumanoidRetargetProfile(source, target)`.
4. Для cross-rig transfer включать `requireAxisCalibration: true`; не подменять отсутствующую калибровку предположением о совпадении осей.
5. VRMA, уже скомпилированная через `createVRMAnimationClip(animation, activeVrm)`, остаётся на Pixiv runtime path. Этот adapter не должен повторно преобразовывать её quaternion tracks.

## Границы результата

Это runtime-facing snapshot adapter, но ещё не законченный cross-rig animation player. Он не создаёт target AnimationClip, не решает foot IK/contact, не выполняет motion retargeting для произвольных GLTF track bindings и не заменяет browser/Android E2E. Для полноценного переноса embedded GLTF clips потребуется отдельный source-asset lifecycle и sampler, который сможет проигрывать source clip на source rig, снимать позу по времени и строить target-local tracks.

## Проверки

Добавлена отдельная deterministic suite для frame-relative transforms, размеров/длин костей и дублирующихся semantic roles. До запуска GitHub Actions на новом commit SHA результаты тестов считаются непроверенными.
