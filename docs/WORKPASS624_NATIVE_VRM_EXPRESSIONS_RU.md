# [NK1][WorkPass624] Native VRM expressions → organism affect and speech

**Дата:** 30 октября 2026 г.  
**Основа:** WorkPass623 в `feature/embodiment-model-hardening-2026-10-29`  
**PR:** [#392](https://github.com/ailtron1ss-rgb/NK1/pull/392)  
**Статус:** source + regression tests внесены; exact-head CI требуется после последнего коммита. Release ZIP не изменён.

## Проблема, которую закрываем

В WorkPass623 3D body уже реагировал на эмоции и речь, но для импортированных моделей мимика в основном определялась по регулярным выражениям в названиях shape keys: `happy`, `smile`, `mouthOpen`, `blink` и т. п. Это работает только тогда, когда автор модели использовал ожидаемые названия. В VRM эти значения обычно связаны с MorphTarget через отдельную семантическую карту Expressions. В результате корректная модель могла содержать все выражения, но NK1 не находил их, потому что имя morph target было произвольным.

WorkPass624 использует нативное описание модели, а не предполагает, как автор назвал каждый shape key.

## Реализация

Новый модуль: `app/src/components/avatar/vrmExpressionMap.ts`.

### 1. VRM 1.0

Разбирается `extensions.VRMC_vrm.expressions`:
- `preset` и известные алиасы preset names;
- `custom` — только если имя явно соответствует поддерживаемому NK1 preset alias;
- `morphTargetBinds[]`: `node`, `index`, `weight`;
- `isBinary`;
- `overrideMouth`, `overrideBlink`, `overrideLookAt`.

Вес binding приводится к диапазону [0, 1]. Неправильные индексы, нечисловые веса и неизвестные пользовательские имена не превращаются в выдуманную мимику.

### 2. VRM 0.x

Разбирается `extensions.VRM.blendShapeMaster.blendShapeGroups[]`:
- `presetName` (Joy, Angry, Sorrow, Fun, A/I/U/E/O, Blink и LookAt);
- fallback к `name`, если presetName равен unknown;
- `binds[]`: `mesh`, `index`, `weight`;
- `isBinary`.

VRM 0.x хранит bind weight в шкале 0–100; адаптер преобразует его в 0–1. Если один preset объявлен одновременно в legacy и modern extensions, VRM 1.0 имеет приоритет.

### 3. Связь с Three.js

На этапе загрузки модели один раз компилируются:
1. VRM expression definitions;
2. связи target indices с объектами GLTFLoader через `parser.associations`;
3. группы morph targets с перечнем contributing expressions.

Поддерживаются оба распространённых случая:
- VRM 1.0 привязывает expression к glTF node; если node — Group с несколькими primitives, адаптер раскрывает дочерние Mesh объекты;
- VRM 0.x привязывает expression к glTF mesh; адаптер раскрывает все primitives этого mesh и убирает повторные ссылки.

В render loop не выполняется повторный поиск по именам объектов или morph target. Для каждого связанного target суммируются только нужные expression weights, значение ограничивается [0, 1], остальные morph targets не изменяются.

### 4. Один источник состояния — OrganismSnapshot

Никакой второй эмоциональный движок не добавляется. Выражения вычисляются непосредственно из существующего состояния:
- emotion / valence / arousal → happy, angry, sad, relaxed, surprised;
- существующий `MouthPose.viseme` → aa / ih / ou / ee / oh;
- awake + текущий blink pulse → blink;
- gazeX/gazeY → lookLeft/right/up/down.

Это не фонемное распознавание: viseme остаётся аппроксимацией существующей grapheme timeline, но теперь выражения попадают в авторские индексы модели, а не ищутся по строкам.

### 5. VRM procedural overrides

Реализована применимая к facial presets часть VRM override поведения:
- `block`: при активном facial expression соответствующий procedural канал выключается;
- `blend`: процедурный канал линейно ослабляется суммарным весом активных overriding expressions;
- `isBinary`: вес выражения становится 1 при значении больше 0.5, иначе 0.

Это предотвращает типичное двойное управление ртом (emotion morph + procedural viseme) и конфликт моргания. MaterialColorBind и TextureTransformBind пока не применяются; неизвестные custom expressions не получают автоматически придуманный смысл.

## Регрессионная защита

Новый тест: `app/scripts/avatar-vrm-expression-map.test.mjs`. Он проверяет:
- alias normalization;
- VRM 1.0 preset/custom parsing, node bindings, invalid bind rejection и modern precedence;
- VRM 0.x presets, legacy mesh bindings и scale 0–100;
- affect/viseme/gaze/blink → expression weights;
- override block/blend и isBinary semantics;
- multi-primitive node/mesh expansion и deduplication;
- accumulation/clamp без изменения unmapped morph target;
- вызов native VRM pipeline в production 3D stage.

Новая команда: `npm --prefix app run test:avatar-vrm-expressions`. Она добавлена в `.github/workflows/embodiment-quality-gates.yml`.

## Важные границы

WorkPass624 не утверждает, что весь VRM стандарт реализован. Пока остаются за рамками:
- MToon material renderer и materialColor/textureTransform expression binds;
- VRMC_springBone, VRMC_node_constraint и полный VRM LookAt implementation;
- humanoid retargeting всех типов суставов и motion clips;
- акустическое foneme-level lip-sync и общий browser/Android/Termux playback controller;
- проверка на реальном VRM файле с известными expression targets и визуальное сравнение кадров;
- Android GPU/память/FPS и длительный device soak.

Для полноценного release gate необходимо загрузить несколько лицензированно пригодных VRM 0.x/1.0 моделей с multi-primitive meshes, проверить выражения joy/angry/sad, A/I/U/E/O, blink и LookAt в браузере/на телефоне и снять evidence, что указанные morph indices реально меняются на экране.

## Справочные спецификации

- VRM 1.0 expressions: https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_vrm-1.0/expressions.md
- VRM 0.x blendShapeMaster: https://github.com/vrm-c/vrm-specification/blob/master/specification/0.0/README.md
- Three.js GLTFLoader + parser association API: https://threejs.org/docs/pages/GLTFLoader
- NK1 loader association map is compiled at model-load time; the runtime applies only pre-resolved morph targets.

## Критерий закрытия

Нативная expression-map реализация закрывает source-level mapping gap и должна пройти exact-SHA CI. Полное закрытие воплощения всё ещё зависит от визуальной проверки реальных лицензированных VRM assets, device E2E, audio interruption, Live2D timeline soak, 2.5D original rig, full VRM material/physics pipeline и проверенного Release ZIP.
