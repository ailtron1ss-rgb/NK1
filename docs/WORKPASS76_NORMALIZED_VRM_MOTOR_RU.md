# WorkPass76 — единый normalized humanoid motor для VRM

## Что было не так

Native VRM runtime уже загружал `.vrm` через `@pixiv/three-vrm`, но NK1 вручную писал значения в normalized proxy bones через отдельный локальный массив `vrmBones`. Это оставляло две конкурирующие схемы управления и не закрепляло один проверяемый контракт для humanoid output.

## Что изменено

- `vrmRuntimeAdapter.ts` стал единственной точкой управления normalized humanoid: `getNormalizedBoneNode()` разрешает модельно-зависимые proxy nodes, а `VRMHumanoid.update()` переносит позу на raw skeleton.
- `Avatar3DStage` включает `autoUpdateHumanBones`, выполняет `rotateVRM0` для VRM 0.x и вызывает адаптер из штатного frame loop.
- Head/neck gaze и tilt распределяются 35/65, если обе кости доступны; каждое обновление начинается с identity, поэтому повторные тики не накапливают Euler drift.
- Существующий NK1 gesture intent для обеих рук передаётся в адаптер как рассчитанные значения `leftArmIntent`/`rightArmIntent`. Это сохраняет влияние action, emotion, social need и guardedness, а не подменяет его упрощённым hard-coded жестом.
- VRM preset expressions, mouth visemes и blink управляются одним affect/speech frame; `vrm.update(delta)` ограничен 50 ms.
- Для VRM отключён generic GLTF `AnimationMixer`: raw-targeted клипы не должны перезаписывать normalized humanoid pose. Generic GLB сохраняет прежний mixer/raw-bone путь.
- При замене, сбросе, ошибке загрузки и размонтировании VRM ресурсы освобождаются через `VRMUtils.deepDispose`; GLB продолжает использовать общий disposer NK1.

## Проверки

- Unit tests проверяют mapping, отсутствие drift, отсутствующие кости, expressions, ограничение delta, метаданные и сохранение уже рассчитанного NK1 arm intent.
- Integration test использует настоящий `VRMHumanoid` из `@pixiv/three-vrm` и проверяет перенос normalized pose в raw skeleton, затем возврат в нейтральную позу.
- CI отдельно запускает оба набора тестов, TypeScript typecheck и production build.

## Ограничения

Это не полноценная IK/VRMA анимация, не ходьба и не захват движения. Пока нет калибровки конкретной модели, координат целей и реального browser/WebGL E2E. VRM metadata отображает заявленные автором сведения, но не является юридической проверкой лицензии. На реальном Android-устройстве ещё требуется soak и проверка GPU/памяти.
