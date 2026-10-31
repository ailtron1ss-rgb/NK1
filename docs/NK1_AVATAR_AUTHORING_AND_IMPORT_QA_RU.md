# NK1 — конвейер подготовки и допуска VRM/GLB/2.5D-моделей

Дата: 31 октября 2026  
Рабочая ветка: `work/nk1-unified-embodiment-motor-2026-10-31-r2`

## Зачем нужен отдельный конвейер

Нельзя считать модель пригодной только потому, что Three.js смог её открыть. Импортируемая модель — это одновременно бинарный контейнер, граф сцены, набор геометрии/текстур/анимаций, художественный образ, скелет и объект с собственной лицензией. Ошибка на любом из этих уровней может привести к отказу renderer, чрезмерному расходу памяти, неправильным суставам или недопустимой перепривязке моторных команд.

Поэтому NK1 использует несколько независимых gates. Они не подменяют друг друга:

1. художественная подготовка и экспорт;
2. независимая проверка glTF 2.0;
3. локальная NK1 security/resource preflight до Three.js;
4. точная идентификация импортированных байтов и модели;
5. per-model coordinate frame и калибровочный профиль;
6. browser/device visual acceptance.

## Проверенные внешние инструменты

### Khronos glTF-Validator

Официальный проект: https://github.com/KhronosGroup/glTF-Validator  
Локальный web-интерфейс: https://github.khronos.org/glTF-Validator/  
CLI/NPM: https://www.npmjs.com/package/gltf-validator

В приложенном пользователем ZIP `gltf_validator-2.0.0-dev.3.10-web.zip` находится browser-based web bundle: `index.html`, локальные стили и `scripts/validator.dart.js`. В исходном интерфейсе Khronos указано, что выбранные файлы валидируются локально в браузере, без загрузки на сервер. Validator проверяет glTF 2.0 JSON/GLB v2, ссылки, буферы, accessor encoding, анимации, изображения и поддерживаемые extension-контракты.

Локальный ZIP SHA-256:

`fca5e799652f73ffe3943a907c5ba990f3a1419940b9b72a5b2937b8ce88ace9`

Лицензия web bundle — Apache-2.0; рядом с файлами архива присутствуют `LICENSE` и `NOTICES`. Не удалять notices при локальном использовании или дальнейшем распространении.

**Роль в NK1:** независимый authoring/release gate. Этот инструмент не заменяет NK1 preflight: он проверяет соответствие glTF 2.0, но не нашу политику размера, отсутствие внешних ресурсов, идентичность модели, лицензию, renderer profile или MotorFrame mapping.

### VRM Add-on for Blender

Официальный проект: https://github.com/saturday06/VRM-Addon-for-Blender  
Документация: https://vrm-addon-for-blender.info/en-us/  
Официальная страница версии: https://extensions.blender.org/add-ons/vrm/versions/

Приложенный пользователем архив `VRM_Addon_for_Blender-4_10_3.zip` содержит версию 4.10.3. Официальная страница Extensions указывает дату релиза 29 октября 2026, Blender 4.2 LTS в совместимости и сообщает, что Blender 5.3 и выше не поддерживается. В архивном `blender_manifest.toml` указаны минимальная версия Blender 4.2.0, максимальная 5.3.0 и лицензии MIT + GPL-3.0-or-later. При расхождении metadata архива и актуальной страницы Extensions не объявлять Blender 5.3 совместимым без отдельного теста; для воспроизводимого pipeline использовать проверенный Blender 4.2 LTS.

SHA-256 локального ZIP:

`dcf6d55f3d28de8c0de2f72abcc7fe06b2b300195e6b4da2e9cf476fd59165a2`

**Роль в NK1:** внешняя художественная подготовка VRM: импорт/экспорт, VRM Humanoid, MToon и настройка VRM-данных. Add-on не копируется в клиент, runtime или сервер NK1. Он остаётся инструментом художника с собственной лицензией и циклом обновления.

## NK1 upload preflight

Модуль: `app/src/components/avatar/avatarGlbPreflight.ts`  
Тесты: `app/scripts/avatar-glb-preflight.test.mjs`

Preflight вызывается сразу после чтения локального файла и **до** `GLTFLoader.parse()`. Он принимает бинарные GLB 2.0, проверяет объявленную длину и порядок чанков, парсит JSON и отклоняет несамодостаточные ссылки.

Текущие default budgets:

| Ресурс | Предел |
|---|---:|
| Размер .vrm/.glb | 90 MiB |
| Nodes | 8 192 |
| Meshes | 2 048 |
| Primitives | 8 192 |
| BufferViews | 8 192 |
| Accessors | 16 384 |
| Accessor elements суммарно | 20 000 000 |
| Оценка POSITION vertices | 12 000 000 |
| Animations | 256 |
| Animation channels | 16 384 |
| Images | 512 |
| Размер стороны текстуры | 8 192 px |
| Суммарные texture pixels | 96 000 000 |

Проверки включают:

- GLB magic, версию 2, точную длину, JSON chunk первым, отсутствие дублирующихся JSON/BIN;
- только встроенный BIN buffer; внешние buffer URI запрещены;
- отсутствие HTTP/file/path image URI; допустимы embedded PNG/JPEG в bufferView или base64 data URI;
- диапазоны bufferView/accessor, componentType/type/count, sparse references;
- индексы mesh, primitive, material, skin, scene, animation sampler/channel;
- уникальность parent, корректность дерева и отсутствие циклов;
- бюджеты количества ресурсов и размеров текстур.

Preflight — защита от некорректных структур и чрезмерных ресурсов перед выделением Three.js объектов. Это **не** полный Khronos validator, не VRM compliance certificate, не проверка визуального качества и не лицензия. Khronos report и NK1 preflight должны оба пройти.

## Контракт авторского GLB

Для каждого production-asset требуется:

- GLB v2, self-contained BIN и встроенные изображения;
- однозначный root scene и единая parent hierarchy;
- уникальные имена bone/node, без неоднозначных Left/Right alias;
- применённые object transforms и согласованные rest/bind poses;
- VRM Humanoid mapping, если asset предназначен как VRM;
- явно объявленный `nk1MotorModelId` в root extras, если модель принимает MotorFrame;
- явно объявленный `nk1CoordinateFrameId` в root extras, если модель допускает калибровку/IK;
- sidecar calibration profile, привязанный к точному SHA-256 файла, coordinate frame и реальным bone names;
- provenance: автор/источник, URL, SPDX/license, redistribution permission, дата и reviewer.

Никакой model ID, coordinate frame или bone mapping нельзя угадывать из filename. Если metadata отсутствует, модель может использоваться только в неподкалиброванном режиме; моторные и IK-проекции остаются закрыты.

## 2.5D layered scene contract

2.5D asset не равен обычному VRM/GLB с несколькими mesh. Для него требуется `nk1DepthRigAssetV1`, точное совпадение имён scene nodes и parent hierarchy с authored rig, pivots, depth order, masks/occlusion и rest transforms.

Минимальные авторские плоскости:

- задние волосы и пряди;
- затылок/голова;
- шея и корпус;
- плечи/верхние рукава;
- предплечья/кисти;
- передняя чёлка;
- лицо, глаза и рот;
- одежда и отдельные перекрывающие аксессуары.

Скрытая анатомия должна продолжаться за пределы видимого края маски. Иначе при повороте появляются пустоты между слоями. Flat color/layer order сами по себе не доказывают глубину. Для полноценной смены поз нужны hidden geometry, pivots, деформация и визуальная проверка нескольких ракурсов.

Текущая NK1 2.5D scene adapter проверяет authored node graph и применяет позу к существующим Three.js nodes. Сам художественный master asset и hidden geometry ещё не поставлены.

## VRM calibration sidecar

В source уже существуют:

- `vrmHumanoidRigAdapter.ts`;
- `vrmRigCalibrationProfile.ts`;
- `vrmRigCalibrationSession.ts`;
- `planarArmIK.ts`.

Профиль валидируется по fingerprint точных байтов модели, coordinateFrameId и именам плеч/локтей. Измеренный профиль должен создаваться через известный reference fixture; animation clip не считается ground truth. Слабое движение, off-axis motion, неверные лимиты и несовпадение модели отклоняются.

**Ограничение этого прохода:** профильные модули и тесты уже присутствуют, но интерактивный импорт/экспорт calibration sidecar и полноценное применение измеренной двусторонней IK к реальному skinned VRM ещё не подключены к UI. До этого момента не заявлять, что любой загруженный VRM полностью моторно откалиброван.

## Рекомендуемый workflow для художника/инженера

1. Создать/импортировать персонажа в Blender через VRM Add-on; проверить Humanoid и bind pose.
2. Экспортировать self-contained VRM/GLB с текстурами внутри и сохранить исходный .blend.
3. Проверить экспорт Khronos glTF-Validator; сохранить JSON report.
4. Загрузить файл в NK1: локальный preflight должен завершиться PASS до Three.js.
5. Зафиксировать SHA-256, model ID, coordinate frame ID и уникальные bone/node names.
6. Выполнить измеренную bilateral calibration session на known-angle fixture; сохранить sidecar отдельно от модели.
7. Проверить нейтральную позу, крайние углы, жесты, речь/lip-sync, переключение renderer и rollback.
8. Провести browser visual E2E и Android/Termux device soak; сохранить evidence с модельным fingerprint.

## Что означает PASS

- **Khronos PASS** — структура glTF/GLB соответствует проверенным правилам валидатора.
- **NK1 preflight PASS** — файл прошёл локальные ограничения структуры, URI и ресурсов.
- **Rig calibration PASS** — точный файл и frame совпали с измеренной калибровкой; joints найдены однозначно.
- **Renderer readback PASS** — целевая сцена/параметры прочитаны после применения.
- **Presented-frame PASS** — отдельное доказательство, что кадр с точным execution/frame ID реально был представлен браузером/GPU.

Эти статусы нельзя объединять в один флаг. Успех одного уровня не означает успех следующего.

