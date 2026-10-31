# NK1 Aspect 04 — канонический runtime 2.5D

Дата: 30 октября 2026
Базовая исходная линия: 0d90f9b8966c989dc644642a915e2e63e0ea89d4

## Единственный владелец схемы

- `DepthRigDefinition` из `app/src/components/avatar/depthRig.ts` остаётся единственным authoring/pose schema.
- `depthRigSceneAdapter.ts` — единственный Three.js scene adapter для этой схемы.
- `resolveDepthRigPose()` переводит семантические намерения в bounded additive transforms.
- `EmbodimentIntentV1` и единый snapshot организма остаются источником эмоций, речи, взгляда и намерений.
- `DepthRigManifest` из старого PR #408 не добавляется как вторая схема. Полезные runtime-требования #408 реализуются поверх уже принятого `DepthRigDefinition`.

## Контракт GLB

Корневая glTF scene должна содержать `extras.nk1DepthRigAssetV1`. GLTFLoader передаёт это в `gltf.scene.userData.nk1DepthRigAssetV1`.

Envelope версии 1 включает:
- `schemaVersion: 1`.
- `rig`: version-1 `DepthRigDefinition`, один корень, уникальные node IDs, parent IDs и нормализованные pivots.
- `artwork`: явные `width`, `height`, `units: scene`, `origin: center`.
- `layers`: один слой на каждую rig node; точные `nodeId`, `objectName`, `width`, `height`.

Координаты `rest.x` и `rest.y` — parent-local доли canvas в scene units; начало координат находится в центре authoring canvas, положительный X направлен вправо, положительный Y исходного арта — вниз. Pivot задаётся в 0..1 от левого верхнего угла слоя. Размеры слоя обязательны, чтобы компенсировать pivot при вращении и масштабе.

Каждая layer node должна быть реальным Object3D в импортированной сцене. Имена сопоставляются точно; fuzzy matching и автоматическое исправление иерархии запрещены. Дочерний объект должен быть непосредственным child объекта, указанного его `parentId`.

## Runtime

`prepareDepthRigSceneV1()` проверяет schema version, plain-record shape, диапазоны, дубли имён, точные object bindings и реальную parent hierarchy. `applyDepthRigPreparedScenePoseV1()` применяет parent-first rest pose плюс bounded semantic deltas, обновляет мировые матрицы, читает локальные transforms обратно и возвращает receipt только после полного совпадения.

Receipt связан с `adapterId`, `executionId` и `stateRevision`. При ошибке применения или readback все изменённые узлы откатываются. Успешный scene-graph readback означает `verified: true`, но `presentedFrameVerified: false`: он не доказывает, что кадр уже показан GPU.

## Режимы тела

- Live2D сохраняет текущую Cubism-модель и её речь/выражения.
- 2.5D использует только импортированный layered GLB с `nk1DepthRigAssetV1`; при отсутствии манифеста режим явно недоступен. Процедурная 3D-фигура не выдаётся за 2.5D.
- 3D продолжает использовать текущий VRM/GLB skeleton path и procedural fallback.
- Все режимы получают состояние одного организма; переключение вида не создаёт отдельную память или личность.

## Что ещё не означает готовность 2.5D

Этот pass создаёт исполняемый scene adapter и контракт импорта, но не поставляет авторский layered Kurisu asset. До включения 2.5D как production-ready остаются:
1. Создание слоистого master art с hidden-area paint, masks, pivots, волосами, лицом, руками, одеждой и аксессуарами.
2. Экспорт GLB с manifest и точными именами/parent hierarchy.
3. Ручной визуальный review перекрытий, поворотов головы и корпуса.
4. Browser и Android visual E2E, resizing, reduced-motion и mobile performance.
5. Независимое подтверждение presented frame; scene-object readback не заменяет GPU/frame evidence.

Никаких изменений `main` или GitHub Release ZIP этим PR не выполняется.
