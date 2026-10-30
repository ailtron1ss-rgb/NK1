
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
- ограниченный damped-spring step для вторичной динамики волос/ткани;\n- сохранение artist-authored pivot в результирующих трансформациях;\n- Three.js adapter, который сопоставляет manifest IDs с Object3D.name, применяет локальные transforms/visibility/renderOrder и компенсирует pivot;\n- атомарный отказ при отсутствующих или неоднозначных именах узлов (сцена не меняется частично).

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
3. Подключить manifest `root.userData.nk1DepthRigManifest` к существующему Avatar3DStage: GLB без manifest остаётся обычной 3D-моделью; GLB с manifest проходит валидацию и получает semantic pose каждый кадр. Отдельный пользовательский переключатель 2.5D/Live2D/3D и художественный asset ещё не готовы.
4. Подключить общий EmbodimentIntent через capability-aware adapter.
5. Добавить shape layers лица, веки, mouth shapes, ограничения деформации и вторичную физику.
6. Добавить реальные outfit meshes/layers и attach points.
7. Провести визуальный E2E на Android и desktop.

## Проверка

Из app/: node --experimental-strip-types --test scripts/depth-rig.test.mjs

Это первый кодовый фундамент, не конечное тело. Typecheck/build/CI должны проверяться на точном HEAD PR. Отсутствие художественных ресурсов остаётся явным release blocker.
