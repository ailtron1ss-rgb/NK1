# Neuro Kurisu — спецификация тела 2D / 2.5D v1
Дата: 2026-10-26  
Ветка реализации: `feature/kurisu-2p5d-body-20261026`  
Базовая ветка источника: `feature/visual-embodiment`

## Цель

Тело Курису — не декоративный аватар и не отдельный чат-бот. Это визуальный/двигательный выход одного когнитивного организма NK1. Оно должно выражать то, что организм действительно делает и чувствует: куда направлено внимание, что он проверяет, насколько уверен, говорит ли сейчас, устал ли, шутит или раздражён. Источником состояния остаётся единый `EmbodimentIntent v1`; рендерер не принимает самостоятельных решений о личности и не выдумывает эмоции отдельно от организма.

Целевой визуальный принцип: **аниме-рисунок с почти 2D-идентичностью, но с независимой деформацией лица и корпуса, физикой волос/ткани и дальнейшим переходом к свободным 3D-позам**.

## Что уже есть в NK1

Текущий source stack уже содержит две версии существующей Live2D-модели — quality и mobile — по путям:

- `runtime/neuro-kurisu/public/live2d/Kurisu/Kurisu.model3.json`
- `runtime/neuro-kurisu/public/live2d/Kurisu.mobile/Kurisu-mobile.model3.json`

В quality-модели описаны группы движений `Idle`, `TapHead`, `TapBody`, `Special`, набор expressions и ресурс физики `Kurisu.physics3.json`. Описание параметров `Kurisu.cdi3.json` содержит не только угол лица и глаз, но также `ParamBodyAngleX/Y/Z`, `ParamBreath`, параметры физики волос, рук, галстука, воротника, рубашки, обуви и полы халата. Файл физики заявляет 14 физических настроек, 41 вход и 33 выхода. Значит, базовый риг уже богат; проблема была не только в количестве спрайтов, но и в том, что контроллер использовал лишь часть имеющихся каналов.

В этом проходе добавлен общий mapper `runtime/neuro-kurisu/public/embodiment-pose.mjs`, который превращает действие/эмоцию/уровень возбуждения организма в ограниченную позу. React-производитель и standalone runtime публикуют эти значения через один envelope. Оба Live2D viewer теперь разделяют направление глаз и поворот головы, задают параметры корпуса и модулируют дыхание. Новые поля протокола необязательны, поэтому старый v1 sender по-прежнему может использовать fallback от направления взгляда.

Это улучшает управление **текущим Live2D-ригом**; само по себе это ещё не создаёт настоящую 3D-модель.

## Целевая архитектура

### 1. Один источник намерения

`OrganismSnapshot / внутреннее состояние → EmbodimentIntent v1 → renderer adapter → модель`

Renderer adapter переводит семантические значения в конкретные параметры Live2D или в кости/morph targets 3D-модели. Он не должен самостоятельно менять эмоциональную интерпретацию. Текстовый ответ, аудио, выражение лица, взгляд и жест должны принадлежать одной последовательности состояния.

### 2. Слои исполнения

**Слой A — Live2D baseline.** Используется как текущий рабочий режим: качественное плоское аниме-лицо, expressions, существующие motion clips и физика отдельных частей. Он подходит для окна диалога и мобильного режима.

**Слой B — 2.5D depth rig.** Следующая художественно-техническая задача — изготовить полноценную модель в Blender с анатомически согласованным скелетом, контролируемыми shape keys и cel-shaded материалами. Камера — преимущественно ортографическая, без реалистичных PBR-бликов; контур, плоские цветовые пятна, вручную заданные тени и текстуры должны сохранять аниме-сходство. Лицо требует отдельного внимания: глаза, брови и рот должны быть управляемыми shape keys/слоями, а не просто растягиваемой текстурой.

**Слой C — общий контракт.** Оба рендерера принимают те же семантические каналы. В обычном диалоге можно оставить Live2D, а для более широкого поворота корпуса, рук, сидячих/стоячих поз и будущей ходьбы использовать 3D/2.5D renderer. Не следует поддерживать два независимых «мозга» или две системы эмоций.

Для web-версии практичный 3D-путь — Blender → glTF/GLB → Three.js `GLTFLoader` и Animation System. Кости, morph targets и клипы позволяют анимировать разные свойства и смешивать движения. VRM стоит рассматривать дополнительно, если потребуется совместимость с внешними humanoid-avatar инструментами, LookAt, expressions и spring-bone-экосистемой. Для первого рабочего 2.5D тела достаточно GLB; VRM не является обязательным условием.

## Концепт персонажа

### Силуэт и материалы

- Длинные медно-рыжие волосы с отдельными чёлкой, боковыми прядями и задним объёмом; крупные пряди должны иметь разный вес и инерцию.
- Голубые глаза с отдельными радужкой/зрачком, бликами и верхним/нижним веками.
- Белый лабораторный халат с двумя передними полами, задней частью, воротником, рукавами, манжетами и карманами; ткань движется, но не должна выглядеть резиновой.
- Белая рубашка, тёмно-винный галстук, тёмные короткие шорты, тёмные колготки и ботинки с пряжками.
- Палитра должна быть стабильна между состояниями и одеждой; нельзя менять цвет волос/глаз от эмоции без отдельного художественного решения.
- **Постоянный визуальный маркер NK1:** асимметричная геометрическая бирюзовая заколка и сдержанный циановый акцент на одной манжете. В альтернативных комплектах сохраняется хотя бы один из этих маркеров. Это направление для будущего PSD/GLB; текущая существующая модель ещё не перерисована под этот акцент.

### Характер, читаемый через позу

- **Сарказм:** небольшая асимметрия бровей, боковой взгляд, короткая полуулыбка, голова слегка наклонена, одна рука может фиксировать локоть или указывать.
- **Любопытство:** взгляд уходит к объекту, голова поворачивается не синхронно с глазами, корпус немного наклоняется вперёд.
- **Анализ/проверка:** взгляд устойчивый, голова чуть опущена, плечи собраны, рука у подбородка или указывает на факт.
- **Раздражение:** брови сведены, движение жестче и короче, корпус подается вперёд; не включать агрессивную позу при каждом небольшом уровне arousal.
- **Радость:** мягкие глаза, улыбка и более открытые плечи; интенсивность должна быть постепенной, а не бинарной.
- **Смущение/теплота:** короткий уход взгляда, небольшой поворот корпуса, расслабление плеч и слабый румянец, только если это соответствует состоянию.
- **Усталость:** веки ниже, взгляд медленнее, плечи опущены, дыхание спокойное.
- **Заинтересованность/сосредоточенность:** почти незаметные движения, а не постоянное махание руками.

Эмоция должна управлять несколькими согласованными каналами, но не обязана включать заранее записанную полную анимацию. Непрерывные малые параметры создают живое поведение; motion clips используются для смысловых жестов.

## Контракт тела

Текущий `EmbodimentIntent v1` получил дополнительные необязательные поля внутри `body`. Все новые числовые значения нормализуются и ограничиваются до попадания в рендерер.

| Канал | Диапазон | Назначение |
|---|---:|---|
| `gaze.x / gaze.y` | -1…1 | Направление глаз, отдельно от головы |
| `body.headAngleX` | -1…1 | Поворот головы по X / yaw |
| `body.headAngleY` | -1…1 | Наклон головы по Y / pitch |
| `body.headTilt` | -0.15…0.15 | Небольшой боковой наклон головы, сохранённый из v1 |
| `body.bodyAngleX/Y/Z` | -1…1 | Поворот/наклон корпуса |
| `body.breathIntensity` | 0…1 | Амплитуда дыхания |
| `body.gesture` | boolean | Есть ли смысловой жест сейчас |
| `body.motionGroup/index/token` | ограниченные значения | Выбор motion group и уникальность запуска движения |
| `mouth.open/form/viseme` | ограниченные значения | Таймированная форма рта, связанная с speech clock |
| `expression / expressionIntensity` | allow-list / 0…1 | Выражение и интенсивность |

### Текущая Live2D-адаптация

- `headAngleX` → `ParamAngleX` (первичная калибровка: нормализованное значение × 30).
- `headAngleY` → `ParamAngleY` (первичная калибровка: × 20).
- `headTilt` → `ParamAngleZ` (существующее масштабирование × 35).
- `gaze.x/y` → `ParamEyeBallX/Y`; взгляд больше не используется как единственный источник поворота головы.
- `bodyAngleX/Y/Z` → `ParamBodyAngleX/Y/Z` (первичная калибровка: × 10 параметрических единиц).
- `breathIntensity` → плавно меняющийся `ParamBreath` с синусоидальной фазой и ограниченной амплитудой.

Множители — стартовая калибровка под текущий риг, а не универсальные значения для любой Live2D-модели. Перед релизом требуется визуально проверить крайние значения и при необходимости скорректировать адаптер для конкретной модели. Если новое поле отсутствует, viewer безопасно возвращается к совместимому поведению v1.

### Первичная карта действия → поза

Общий mapper `deriveEmbodimentPose(action, emotion, arousal)` выдаёт малые непрерывные смещения для `explore`, `verify`, `reflect`, `respond`, `wait`, `rest`, `defer`. Эмоция добавляет небольшое смещение; arousal увеличивает дыхание. Все выходы ограничены, неизвестные action/emotion заменяются безопасными значениями. Это начальная политика, подлежащая визуальной настройке, а не утверждение о точной физиологии.

## Производственный арт-пайплайн Live2D

Один плоский PNG/JPEG с красивыми позами не может стать хорошим деформируемым телом автоматически. Для качественного рига нужен PSD/совместимый послойный исходник с дорисованными областями, которые в исходной фронтальной иллюстрации скрыты.

Рекомендуемые группы слоёв:

1. **Face:** контур/кожа, шея и уши; белки глаз, радужки, зрачки, блики; верхние/нижние веки, отдельные брови; нос; верхняя/нижняя части рта, внутренняя полость рта, язык, зубы, несколько mouth-shapes.
2. **Hair:** задний массив, левая/правая боковые части, чёлка по отдельным прядям, пряди у лица, выбивающиеся локоны. Под волосами обязательно дорисовать закрытые участки лица/головы.
3. **Torso:** задняя часть халата, отдельные передние полы, рукава, манжеты, воротник, рубашка, узел и лента галстука, карман/значок.
4. **Arms/hands:** верхняя/нижняя части рук, кисти и пальцы; варианты кистей для указания, жеста сомнения, опоры подбородка, скрещённых рук и удерживания планшета.
5. **Lower body:** таз/шорты, левая и правая нога, отдельные слои колготок/обуви, детали пряжек.
6. **Optional outfit groups:** базовый лабораторный комплект, повседневный комплект, зимний/пальто, домашний/rest-вариант. Это отдельные рисованные ресурсы/части; переключение нельзя объявлять рабочим, пока наборы не созданы и не проверены.

Контуры и заливка каждого импортируемого материала должны быть подготовлены согласно правилам редактора. В местах вращения головы, локтей, плеч и перекрытия одежды оставляется запас рисунка за видимой границей. Организация слоёв и hidden-area paint — ключ к отсутствию дыр в момент деформации.

Официальный процесс подготовки материала: [Live2D — Illustration Processing](https://docs.live2d.com/en/cubism-editor-tutorials/psd/). После отделения частей модель собирается в Cubism Editor с ArtMesh, warp/rotation deformers, параметрическими keyforms, physics, expressions и motions. Форматы поставки и ссылки на model/texture/physics/motion задаются через `.model3.json`: [About Models (Web)](https://docs.live2d.com/en/cubism-sdk-manual/model-web/) и [Data for Embedded Use](https://docs.live2d.com/en/cubism-editor-manual/export-moc3-motion3-files/).

## Производственный арт-пайплайн настоящего 2.5D тела

Будущая папка исходников художника/технического художника должна содержать:

- `art/kurisu/2d/Kurisu_Rig_Master.psd` — исходник с именованными и сгруппированными слоями;
- `art/kurisu/2d/Kurisu.cmo3` — проект Cubism;
- `art/kurisu/3d/Kurisu_2p5d.blend` — Blender-сцена со скелетом, материалами, shape keys и клипами;
- `runtime/neuro-kurisu/public/2p5d/kurisu.glb` — runtime-модель для Three.js;
- `runtime/neuro-kurisu/public/2p5d/body-profile.v1.json` — отображение семантического EmbodimentIntent на кости и morph targets;
- source/hydrated asset manifest с SHA-256/размером и синхронизацией quality/mobile профилей.

Это **целевые пути**, а не файлы, которые уже присутствуют в репозитории.

Минимальный 3D-скелет: root/hips, spine, chest, neck, head, clavicles, upper/lower arms, hands/fingers, thighs, calves, feet. Добавить IK targets для кистей и стоп, look target для глаз/головы, shape keys для эмоций и mouth-shapes, а также spring-like вторичную динамику волос, галстука и пол халата. Лабораторный халат должен иметь отдельные поверхности/кости или контролируемые деформеры, иначе он слипнется с ногами при сидении.

Для вида «как 2D» использовать ортографическую камеру, плоское освещение, toon ramp, ручные тени и тонкий контур. Избегать реалистичных металлических бликов и тяжёлой глубины резкости: они визуально изменят стиль сильнее, чем движение помогает. Критические лицевые формы лучше сделать как корректные shape keys/morph targets и/или отдельные 2D-графические элементы, а не как единственную растягиваемую текстуру.

Three.js Animation System поддерживает анимацию костей, morph targets, материалов и трансформов, а также смешивание клипов: [Three.js — Animation System](https://threejs.org/manual/pages/animation-system.html). Если позже потребуется обмен с внешними виртуальными аватарами, отдельно оценить [VRM](https://vrm.dev/en/).

## Библиотека поз и движений

### Непрерывные сигналы

Idle breathing; естественные моргания; глазные микросаккады; независимый поворот головы и взгляда; небольшие наклоны корпуса; физика задних/боковых волос, галстука, воротника, рукавов и пола халата.

### Смысловые клипы

1. Idle/neutral — базовое дыхание и расслабленные плечи.
2. Listen — взгляд на собеседника, редкие кивки.
3. Analyze — рука у подбородка, слегка опущенная голова.
4. Verify — взгляд в сторону данных, устойчивое положение.
5. Explore — взгляд/голова переключаются между объектами.
6. Sarcastic — боковой взгляд, полуулыбка, короткий жест рукой.
7. Explain/point — короткий указующий жест с возвратом в нейтраль.
8. Cross-arms — закрытая, но не агрессивная позиция.
9. Shrug — короткий жест неопределённости.
10. Lean-forward — заинтересованность/акцент на важной мысли.
11. Lean-back — отступление/скепсис.
12. Embarrassed — короткий взгляд в сторону и смягчение плеч.
13. Frustrated — короткий акцент жеста, затем расслабление.
14. Surprise — раскрытие глаз и рта, ограниченный шаг позы.
15. Tired/rest — замедленная реакция, опущенные плечи.
16. Seated/tablet — отдельная посадка с проверкой пересечений рук и халата.

У каждого клипа есть длительность, fade-in/out, приоритет и cancellation semantics. При речи рот остаётся привязан к speech clock; новый жест не должен сбрасывать временную шкалу речи. Инициация движения зависит от состояния и action, а не от случайного выбора каждый кадр.

## Одежда и предметы

Переключаемая одежда — это не текстовая метка, а набор созданных слоёв/мешей/текстур с согласованными именами частей. Для первой поставки закрепить лабораторный образ как baseline. После него сделать casual, winter и rest варианты; только затем добавлять видимый переключатель. Телефон, планшет, чашка и очки — отдельные объекты с attach points к кистям/голове, иначе они будут «приклеены» к экрану при смене позы.

## Приёмочные критерии

- Глаза могут смотреть в сторону при почти неподвижной голове; голова и корпус поворачиваются независимо.
- На каждом новом body channel есть проверка типа, конечности и диапазона; неверный payload отклоняется до применения.
- Head/body angles и breath реально попадают в параметры существующей модели в обоих viewer — app и standalone runtime.
- Старые v1 payloads без новых полей остаются валидными и используют безопасный fallback.
- Expression, жест, рот, тело и речь используют одну версию состояния; старые события не могут переиграть более новое состояние или вернуть отменённую речь.
- Quality/mobile профили работают с локальными закреплёнными SDK-ресурсами; скрытая вкладка приостанавливает рендер, после возврата применяется актуальное состояние.
- У 3D-перехода будет отдельный набор тестов: загрузка GLB, пропорции, pose/morph bounds, motion blending, spring physics, memory/render budget и контроль сходства с утверждённым front-view.
- Перед распространением проверить происхождение и лицензионные условия модели, текстур, Cubism/SDK и используемых анимационных ресурсов. В частности, [официальная страница лицензии Live2D Cubism SDK](https://www.live2d.com/en/sdk/license/) отдельно рассматривает интерфейсы AI/chatbot и категорию Expandable Applications; нужно определить применимую категорию для реального способа распространения NK1, не предполагая автоматически, что любой режим покрыт бесплатным планом.

## Ограничения текущего результата

Этот pass делает реальные интеграционные изменения для существующей Live2D-модели: разделяет взгляд и поворот головы, использует параметры корпуса и дыхание, добавляет общую политику поз и тесты контракта. Он **не** создаёт автоматически полноценный PSD, `.cmo3`, новый `.moc3` или `.glb`: для них нужно художественно подготовленное исходное изображение, ручная дорисовка скрытых частей, риггинг в редакторе и визуальная приёмка. Текущий mouth animation в NK1 строится по таймлайну текста/clock, а не по измеренным акустическим фонемам; аппаратная Android/Termux проверка остаётся отдельным gate.

## Источники

- [Live2D — Illustration Processing / layer separation](https://docs.live2d.com/en/cubism-editor-tutorials/psd/)
- [Live2D — Deformers](https://docs.live2d.com/en/cubism-editor-manual/deformer/)
- [Live2D — Parameter Operation](https://docs.live2d.com/en/cubism-sdk-manual/parameters/)
- [Live2D — Web Model loading](https://docs.live2d.com/en/cubism-sdk-manual/model-web/)
- [Live2D — Embedded model/motion export](https://docs.live2d.com/en/cubism-editor-manual/export-moc3-motion3-files/)
- [Live2D Cubism SDK — official release licensing for AI/chatbot and expandable applications](https://www.live2d.com/en/sdk/license/)
- [Three.js — Animation System](https://threejs.org/manual/pages/animation-system.html)
- [VRM documentation](https://vrm.dev/en/)


## WorkPass107 — selectable NK1 Original presentation (2026-10-26)

### Variants now surfaced in the application

The existing AvatarStage selector now exposes three modes:

1. **Live2D** — the shipped Cubism model and the shared `EmbodimentIntent v1` bridge. This remains the original default.
2. **NK1 Original** — an independently authored, stylized SVG concept renderer at `app/src/components/KurisuOriginalStage.tsx`. It is a genuinely separate look and layout, with a dark scientific backdrop, asymmetric cyan-style hair marker, cyan cuff/garment accents, its own layered hair/face/coat shapes and responsive mood/action pose. It is **not** a Live2D `.moc3` model yet.
3. **Legacy** — the existing sprite deck and its real asset catalog remain available as a fallback/alternate presentation.

The selected presentation is stored using the same best-effort local preference system. The classic Live2D model is not overwritten, and leaving the new SVG preview does not change the cognitive state or speech timeline.

### Live appearance controls in NK1 Original

The in-app `Настроить образ` panel changes the actual current SVG render and persists each preference on the device:

- Outfits: laboratory coat, casual/city outfit, night hoodie.
- Eye tint: ice blue, amethyst, sea-teal.
- Hair palette: copper, redwood/wine.
- NK1 accent: cyan, rose, lime.
- Motion profile: soft or expressive head/body response and secondary movement.
- Character scale: 85–115%.

Emotion, action and arousal still come from the organism snapshot. The new renderer does not invent a parallel emotional state; it uses those values for pose and expression. During speech, the mouth receives the parent's shared audio-timed viseme/open value. A reduced-motion media preference disables decorative animation. Each setting is optional local UI state, not a write to the organism's memory or personality.

### Public research and asset provenance

The official NK1 repository tree includes quality and mobile runtime model descriptors at `runtime/neuro-kurisu/public/live2d/Kurisu/Kurisu.model3.json` and `runtime/neuro-kurisu/public/live2d/Kurisu.mobile/Kurisu-mobile.model3.json`; it also includes the existing legacy sprite manifest at `app/public/sprites/manifest.json`. The existing Cubism parameter catalog covers head, eyes, body angle and breathing; the physics asset ties body-angle inputs to hair, arms, tie, collar, coat and shoe outputs. These are the starting point for the classic variant.

The GitHub release metadata currently exposes an October 19, 2026 release asset `Neuro_Kurisu_WORKPASS70_HOTFIX1_2026-10-19.zip` (136,354,713 bytes), plus the earlier WorkPass70 ZIP. The GitHub connector used for this inspection returns release metadata but does not download binary ZIP contents, so the bytes inside the release archive have **not** been inspected in this pass. Therefore this new variant is committed to the feature branch / draft PR, not claimed to be inside the published ZIP.

Public research found a particularly relevant implementation reference at [Akatosh6DW/Amadeus](https://github.com/Akatosh6DW/Amadeus): its `assets/live2d/models.json` demonstrates how to select a classic lab model and a daily-outfit variant over shared face, expression and motion assets. Its `ASSETS_LICENSE.md` also says the model copyright remains with the original author and that the permission described is as a component of that Amadeus project; NK1 must not treat the model as freely reusable or copy the binaries without separate permission. See [asset rights statement](https://github.com/Akatosh6DW/Amadeus/blob/main/ASSETS_LICENSE.md).

A second reference, [mohui666/Amadeus — live2d-authoring experiment](https://github.com/mohui666/Amadeus/tree/main/experiments/live2d-authoring), contains a five-layer PSD and Cubism project and documents eyes, mouth, and head-tilt controls. Its own README says it was derived from original game portraits; the software MIT license alone is not evidence that those character assets can be redistributed by NK1. We use the workflow as technical research, not copy its PSD or model binary. [FrancescoCaracciolo/Amadeus](https://github.com/FrancescoCaracciolo/Amadeus) is another reference for model-selection UX but explicitly describes an uncredited model with no motion/expression assets; it is not a safe source for a production asset.

The image search surfaced character sheets and Amadeus-themed images, but search-result visibility is not a reuse license. No third-party character PNG/PSD/MOC3/model binary was copied into this new variant.

### Next production gate for a true custom Live2D

The current NK1 Original mode provides a working selection and editable appearance controls without waiting for an image generator. To convert this distinct design into an actual Live2D asset, the next art gate is a new original layered source—not the existing copyrighted model:
1. create and approve a full model sheet for the NK1 Original silhouette and outfit family;
2. prepare a layered PSD with hidden overlap areas painted in;
3. rig face/eyes/brows/mouth, head yaw/pitch/roll, torso, arms/hands, coat panels and hair strands in Cubism;
4. export a new `.moc3`, `.model3.json`, expressions, motions and physics under a separate model ID;
5. add that model to a model registry and allow Live2D selection between **Classic** and **NK1 Original Cubism**, while preserving the current SVG concept option as a lightweight fallback.

Do not label the current SVG preview as a full Live2D rig; its secondary motion is stylized procedural SVG animation rather than Cubism physics.
