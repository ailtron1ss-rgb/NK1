# NK1 — единый runtime воплощения и MotorFrame

Дата интеграционного прохода: 31 октября 2026  
Рабочая ветка: `work/nk1-unified-embodiment-motor-2026-10-31`

## Цель

Live2D, layered 2.5D и VRM/GLB 3D — не три независимых организма. Это три renderer-проекции одного состояния и одного моторного контроллера. Смена тела меняет целевой renderer/model profile, но не создаёт новую личность, память, мотивацию или независимый MotorFrame.

## Канонический путь данных

```text
OrganismState / authorized action owner
                |
         approved MotorGoal
                |
     EmbodiedMotorController
                |
          MotorFrame
                |
       MotorFrameChannel
                |
     OrganismMotorRuntime
       |       |       |
   Live2D   Depth2D   VRM3D
       |       |       |
 Cubism     DepthRig  Humanoid bones
              |       /
        same organism UI
```

- `OrganismMotorRuntime` владеет одним `EmbodiedMotorController`.
- `registerRendererRigProfile()` добавляет не controller, а валидированную проекцию поверх того же набора joint IDs, parent links, limits и motion dynamics.
- Второй профиль не может незаметно изменить канонический скелет. Это ошибка `renderer-profile-canonical-skeleton-mismatch`.
- Профиль идентифицируется тройкой `profileId + renderer + modelId`; одновременно нельзя зарегистрировать два неоднозначных профиля на один renderer/model. Реестр ограничен 16 профилями.
- Обновление профиля требует возрастающей revision и сохранения вида renderer.

## Renderer contracts

| Renderer | Стабильный modelId / binding | Компоненты и единицы | Смысл |
|---|---|---|---|
| Live2D | `kurisu-live2d-balanced-v1` или `kurisu-live2d-mobile-v1`; target kind `cubism-parameter` | `value / parameter`; target ID только `Param[A-Za-z0-9_]+` | Ограниченная approximate-проекция углов/позы на параметры Cubism, не независимый скелет |
| 2.5D | `DepthRigDefinition.rig.id`; target kind `depth-rig-node` | `x/y/z / normalized`, `rotation / degrees` | MotorFrame накладывается на семантическую DepthRigPose; неизвестные узлы и единицы отклоняются |
| VRM/3D | glTF scene userData/extras `nk1MotorModelId`; target kind `humanoid-bone` | `x/y/z / radians` | Моторная поза применяется только к найденным костям конкретной модели; неполный batch отклоняется целиком |

Для VRM-модели `nk1MotorModelId` должен приходить из доверенного asset metadata корневой сцены и совпадать с `modelId` калиброванного профиля. Не следует выводить ID из имени файла или угадывать его по костям.

Для 2.5D `modelId` в MotorRigProfile должен в точности совпадать с `DepthRigDefinition.rig.id`. Это позволяет привязывать профиль к фактически импортированной сцене, а не к произвольной строке из UI.

## Transport API

`GET /api/organism/motor-frame` и SSE `GET /api/organism/motor-frame/stream` принимают:

- `renderer=live2d|depth2d|vrm3d`;
- `modelId=<stable-id>`.

`modelId` запрещён без явного renderer. Ошибочные renderer и path-like IDs получают HTTP 400. SSE status сообщает, есть ли controller frame и какие калиброванные профили зарегистрированы. Frame envelope содержит сырой MotorFrame и только renderer-scoped projection; сервер не принимает от UI новые motor goals через этот read-only маршрут.

На клиенте `motorFrameStream.ts` проверяет:
- same renderer + exact model ID;
- frame tick и timestamp;
- target kind, component и единицы;
- конечные значения и ограничение output range;
- уникальность joint IDs и target channels;
- размер события и monotonic tick.

Любая неоднозначность, неизвестная модель, отсутствующий профиль, неверная калибровка или некорректное событие приводит к `unmapped/invalid`, а не к угадыванию движения. При переподключении tick cursor сбрасывается; status-only события очищают предыдущую batch.

## Live2D application receipt

Live2D viewer принимает только Cubism parameter commands для текущего профиля и только target IDs вида `Param...`. Он применяет batch через Cubism model update hook. Отправляемый `live2d_motor_frame_ack` содержит frameTick, profileId и количество параметров, прочитанных обратно через `getParameterValueById`.

Это **не** доказательство presented frame:
- `visualCompletionVerified` всегда остаётся `false`;
- Cubism parameter readback не доказывает, что GPU уже показал этот кадр;
- полный renderer receipt потребует отдельного привязанного к frame ID capture/readback и browser visual E2E.

Для DepthRig применяются scene graph readback и атомарный rollback, однако `presentedFrameVerified` остаётся false. Для VRM в этом pass добавлен atomic bone projection, но реальный skinned asset и визуальный кадр ещё требуют device/browser проверки.

## Калибровка и границы безопасности

Производственный renderer profile обязан иметь `calibration.status = calibrated`, непустые evidence ID, calibratedAt и verifier version. `test-fixture` профили разрешены только в тестах и не могут активировать production compile path.

- Live2D bindings обязательны approximate; output ограничен ±100 и target ID должен быть именованным Cubism `Param*` параметром.
- 2.5D translation-like channels ограничены ±2 normalized (Z — ±10), rotation — ±90 degrees.
- VRM joint angle output ограничен ±2π radians.
- Перепривязка renderer к другому model ID требует отдельной калибровки.
- Один controller и один MotorFrame остаются единственным источником значений; renderer не создаёт свои цели движения.

## Добавлено в этой интеграции

1. **Registry профилей.** Один моторный организм теперь обслуживает несколько тел без сброса контроллера при регистрации следующего renderer.
2. **Renderer-scoped API.** Сервер адресует projection по renderer + modelId; ошибки модели не приводят к чужому движению.
3. **Общий SSE-парсер.** Клиент проверяет профиль, tick, цели, единицы и диапазоны.
4. **Live2D MotorFrame.** Mobile/balanced Cubism модели объявляют стабильный modelId, получают batch и отдают только parameter readback.
5. **2.5D projection.** Калиброванные motor-команды накладываются на semantic DepthRigPose по точным node IDs.
6. **VRM projection.** Кости получают команду атомарно только при полном target resolution.
7. **Server/app regressions и CI.** API rejects, профили, parser, renderer adapters и model identity включены в проверки.

## Что остаётся до полной готовности

- Подготовить и проверить production calibration profile для каждого реального Live2D, layered 2.5D и VRM asset.
- Создать художественный 2.5D master asset с hidden geometry/paint, masks, pivots и реальным rig.
- Добавить реальные skeletal VRM/GLB assets с проверенным `nk1MotorModelId`.
- Подключить transactional body-switch #415 к фактическому выбору renderer и подтверждать не только подготовку, но и реально показанный кадр.
- Провести Playwright/browser visual E2E, Android/Termux, реальный звук/lip-sync, soak и performance на устройстве.
- Подтвердить, что выбранные calibration mappings семантически корректны (yaw/pitch/roll), а не только проходят структурную валидацию.

До закрытия этих пунктов нельзя называть embodiment 100% готовым. Нынешний результат — интегрированный control/data path с fail-closed контрактами и проверяемыми локальными receipts, не готовая полная художественная модель или доказанное mobile renderer.
