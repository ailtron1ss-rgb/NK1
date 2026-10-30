
# WorkPass629 — производственный фундамент 2.5D Depth Rig

Дата: 2026-10-30  
База: workpass70-source @ ad564d1879028f00549be41ec5172a2f72e25897  
Рабочая ветка: work/nk1-2p5d-depth-rig-2026-10-30

## Аудит

- В source есть Live2D quality/mobile, SVG Original 2D и отдельный procedural Three.js 3D stage.
- В source tree не обнаружены авторские PSD/слоистый мастер, Blender-сцена 2.5D или готовый GLB depth-rig asset.
- Ветка feature/kurisu-2p5d-body-20261026 содержит production spec, но не отдельный исполняемый depth-rig runtime. В самой спецификации PSD, CMO3, Blender и GLB обозначены как будущие ресурсы.
- Следовательно, этот проход создаёт runtime-контракт и математическую основу. Он не выдаёт отсутствие художественных ресурсов за готовую модель.

## Реализовано

Файл app/src/components/avatar/depthRig.ts:
- manifest v1 с семантическими ролями для корня, головы, глаз, волос, корпуса, рук, кистей, одежды и аксессуаров;
- проверка количества узлов, ID, parent references, pivots, координат, rotations, depth и parallax;
- parent-first обход и обнаружение циклических иерархий;
- независимое управление головой, глазами, корпусом и руками;
- дыхание, глубинный параллакс и render-order;
- ограниченный damped-spring step для вторичной динамики волос/ткани;\n- сохранение artist-authored pivot в результирующих трансформациях;\n- runtime-интеграция spring follow-through для hair-front/back и coat-front/tail с отдельным состоянием на каждый узел и dt clamp;\n- Three.js adapter, который сопоставляет manifest IDs с Object3D.name, применяет локальные transforms/visibility/renderOrder и компенсирует pivot;\n- атомарный отказ при отсутствующих или неоднозначных именах узлов (сцена не меняется частично).

Файл app/src/components/avatar/depthRigThreeAdapter.ts:\n- применяет вычисленные трансформации к импортированной Three.js Object3D-иерархии;\n- не требует хардкодить геометрию в React-компоненте;\n- использует имена узлов как контракт Blender/GLB export pipeline.\n\nФайл app/scripts/depth-rig.test.mjs:
- проверка валидной иерархии;
- отказ при дублях, циклах, отсутствующих parent и недопустимых диапазонах;
- независимость каналов головы/глаз/корпуса;
- ограничение враждебных входов;
- длительная проверка устойчивости spring-модели при нерегулярном delta time.

## Зачем это нужно

| Добавление | Польза |
|---|---|
| Data-driven depth manifest | Риг можно описывать художественными слоями, не хардкодя модель в React |
| Parent-first graph | Предсказуемые локальные трансформации |
| Semantic role mapping | Общий EmbodimentIntent управляет разными телами |
| Parallax/depth | Пространственное ощущение без фотореалистичного 3D |
| Bounded secondary motion | Волосы и ткань получают контролируемую инерцию |
| Fail-closed validation | Ошибочный импортированный риг не ломает сцену |

## Следующие обязательные шаги

1. Изготовить PSD/слоистый master с дорисованными скрытыми областями.
2. Создать Blender scene и экспортёр GLB с именованными узлами, pivots, alpha masks и depth.
3. Подключить manifest `root.userData.nk1DepthRigManifest` к существующему Avatar3DStage: GLB без manifest остаётся обычной 3D-моделью; GLB с manifest проходит валидацию и получает semantic pose каждый кадр. Пользовательский переключатель 2.5D добавлен и доступен только после загрузки модели с успешно проверенным manifest; обычные GLB/VRM остаются в режиме 3D. Художественный asset по-прежнему не включён.
4. Подключить общий EmbodimentIntent через capability-aware adapter.
5. Добавить shape layers лица, веки, mouth shapes, ограничения деформации и вторичную физику.
6. Добавить реальные outfit meshes/layers и attach points.
7. Провести визуальный E2E на Android и desktop.

## Проверка

Из app/: node --experimental-strip-types --test scripts/depth-rig.test.mjs

Это первый кодовый фундамент, не конечное тело. Typecheck/build/CI должны проверяться на точном HEAD PR. Отсутствие художественных ресурсов остаётся явным release blocker.

## Дополнение WorkPass — runtime secondary motion и selector

- `stepDepthRigSecondaryMotion(...)` добавляет пружинное запаздывание только семантическим слоям волос и одежды. Цели выводятся из head/torso intent; состояние пружины хранится отдельно по ID узла и очищается при смене модели.
- Интеграция выполняется в существующем animation frame после расчёта базовой semantic pose. Используется уже ограниченный frame delta (не более 50 мс), а параметры жёсткости, демпфирования, смещения и скорости ограничены отдельно для волос и ткани.
- В `AvatarStage` появился отдельный пункт `2.5D`. Он заблокирован, пока не загружена модель с валидным `nk1DepthRigManifest`; после сброса или замены на обычную GLB/VRM режим 2.5D автоматически снимается. Обычный режим 3D не изменён.
- Важно: селектор не создаёт художественную 2.5D модель и не помечает произвольный GLB как 2.5D. Он только открывает capability уже импортированного проверенного depth rig.

Проверка на exact HEAD выполняется GitHub Actions после коммитов; до завершения CI локальный build/Android visual E2E не заявляются как пройденные.


## WorkPass — semantic face rig

`app/src/components/avatar/depthRigFace.ts` separates organism affect/speech from the concrete art asset:

- `resolveDepthRigFacePose(...)` emits bounded channels for blink, brow raise/furrow, smile/frown, mouth open/wide/round and core emotion shapes.
- `applyDepthRigFaceMorphs(...)` maps known aliases or artist-provided bindings to imported GLB/VRM morph targets. Every channel is optional: absent shapes are reported as missing and do not reject the model.
- Ambiguous names that normalize to the same morph key are skipped rather than writing to an arbitrary target.
- `Avatar3DStage` now uses this resolver in its existing morph-target update path, preserving the ordinary bone/3D path and not requiring every model to implement the full facial set.

The resolver is a runtime contract, not a claim that the repository already contains a finished Kurisu face asset or a complete viseme library. A production asset still needs artist-authored eye/brow/mouth shapes and visual calibration.


## WorkPass — asymmetric face rig and speech viseme integration

- Face controls now distinguish left/right blink, brow raise/furrow and eye aim axes. Legacy symmetric channels remain supported for older GLB/VRM assets.
- Added AA/EE/IH/OH/OU/FV/MBP/L viseme channels, bounded viseme weights and a frame-rate-independent blend helper for expression transitions.
- Avatar3DStage maps the existing grapheme timeline categories (open, wide, round, teeth, closed) to the closest supported viseme family and passes current gaze into the face adapter. This remains a grapheme-level approximation: it is not acoustic phoneme recognition.
- Custom artist bindings are validated defensively; malformed values are ignored. Overlapping aliases were removed so generic mouth-open channels cannot overwrite dedicated viseme morphs.
- Tests cover asymmetric eyelids/brows, gaze bounds, viseme selection, blend convergence, partial morph sets, ambiguous aliases and malformed binding metadata.
- The production art asset, calibration and Android/desktop visual E2E remain outstanding.


## WorkPass — Blender → GLB production export contract

Добавлен исполняемый helper `tools/blender/export_nk1_depth_rig.py` для Blender:

- Сборка manifest v1 из коллекции `NK1_RIG`; каждый объект должен иметь custom property `nk1_role`, а его имя становится стабильным ID узла.
- Родительские связи, локальные position/rotation, artist-authored pivot, depth/parallax и render visibility переносятся в manifest. Ограничения соответствуют runtime-контракту: 1–128 узлов, безопасные ID, depth [-1, 1], parallax [0, 2], pivot [-1, 1].
- Экспортёр вызывает штатный glTF 2.0 GLB exporter Blender с `export_extras=True`, затем записывает `nk1DepthRigManifest` и необязательный `nk1DepthRigFaceBindings` непосредственно в extras активной glTF scene. Это сохраняет согласованность с `gltf.scene.userData`, откуда метаданные читает `Avatar3DStage`.
- После экспорта проверяется, что каждый ID manifest присутствует среди имён glTF nodes. Неполный экспорт завершается ошибкой, а не выпускает молча некорректную модель.
- CLI-проверка `app/scripts/depth-rig-glb-validator.mjs` читает GLB v2 JSON chunk и проверяет manifest, узлы, родительские связи, диапазоны и циклы.
- Добавлены тесты синтетического GLB: успешный импортный контракт, отсутствующий узел, дубли/циклы/отсутствующие родители, несовпадение реального glTF parent graph и повреждённый контейнер.
- Focused CI теперь запускает четыре набора тестов и следит за Blender exporter/GLB validator файлами.

Команда:

```bash
blender --background character.blend --python tools/blender/export_nk1_depth_rig.py -- \
  --output build/kurisu-depth-rig.glb --collection NK1_RIG
cd app
node scripts/depth-rig-glb-validator.mjs ../build/kurisu-depth-rig.glb
```

Текущий helper автоматизирует техническую упаковку и проверку, но не генерирует художественную геометрию: слоистая модель, дорисованные скрытые участки, skinning/weights, occlusion masks и калибровка pivot остаются задачей создания самого Blender-проекта. Blender binary/реальная сцена в CI пока не предоставлены, поэтому фактический экспорт художественного GLB ещё не заявляется как проверенный.


### Дополнение — runtime-потребление face bindings

- `Avatar3DStage` теперь читает `nk1DepthRigFaceBindings` из extras той же glTF scene, что и manifest, и передаёт bindings в `applyDepthRigFaceMorphs(...)` на каждом кадре.
- Метаданные рассматриваются как недоверенные: неизвестные/повреждённые каналы и alias-значения безопасно отбрасываются существующим resolver; отсутствие bindings сохраняет стандартный alias lookup.
- При сбросе модели bindings очищаются вместе с depth-rig и secondary-motion state, чтобы не переносить настройки одного GLB на другой.
