# NK1 — аудит исходных визуальных активов для настоящего 2.5D (WorkPass 636)

Дата: 2026-10-30  
Ветка: `work/nk1-2p5d-depth-rig-2026-10-30`

## Краткий вывод

В проекте уже есть качественная Live2D-модель с лицевым управлением, физикой волос/одежды и небольшим набором авторских motion clips. Также есть 32 статичных PNG-иллюстрации и редактируемый SVG-концепт. Но **готового исходного layered PSD/ORA или production 2.5D GLB с авторскими слоями, скрытыми областями и pivots в проверенном source tree не найдено**.

Поэтому правильный следующий шаг — не автоматически разрезать полные PNG и не генерировать новый арт, а подготовить спецификацию layered master asset и решить, какой источник использовать как визуальный эталон.

## Инвентаризация

### 1. Live2D Cubism — лучший существующий визуальный эталон

Канонический владелец ассетов: `runtime/neuro-kurisu/public/live2d/Kurisu`. Публичная копия для app не хранится второй независимой версией: `with-app-env.mjs` перед Vite dev/build вызывает hash-locked `sync-canonical-public-assets.mjs` и гидратирует только byte-identical shadows из runtime.

Подтверждённые данные модели:

- `Kurisu.moc3`: около 6.0 MB; atlas 4096×4096 около 8.2 MB.
- Mobile profile использует texture 2048×2048 около 1.6 MB, при этом разделяет moc/physics/motions/expressions с desktop.
- `Kurisu.physics3.json`: 14 physics settings, 41 inputs, 33 outputs, 47 vertices, 60 FPS.
- Motion groups: `Idle` ×1, `TapHead` ×1, `TapBody` ×1, `Special` ×2 — всего пять зарегистрированных clips.
- В model3 manifest зарегистрировано восемь expression files.
- CDI3 содержит полезные подтверждённые каналы: `ParamAngleX/Y/Z`, `ParamBodyAngleX/Y/Z`, `ParamBreath`, eye open/smile/ball, brow X/Y/angle/form, mouth form/open, cheek/tears/rage, arm physics, hair physics и coat/tie/shirt/collar physics.

**Вывод:** Live2D — сильный источник для эталона лица, gaze, body response, hair/cloth motion и поведения Курису. Но compiled `.moc3` и texture atlas не равны исходному PSD: нельзя считать, что из них автоматически получится чистая система отдельных 2.5D-слоёв.

### 2. Legacy sprite deck — 32 полных still PNG

`spriteEngine.ts` описывает четыре семейства: office, lab, cinematic и trench/full-body; суммарно 32 именованных изображения. Предыдущий визуальный аудит открывал реальные PNG и обнаружил, что несколько исторических ID не совпадают с видимым содержимым; текущая маршрутизация уже учитывает фактическую позу.

**Вывод:** эти PNG полезны как reference board, palette/wardrobe reference и набор реакционных карточек. Это цельные иллюстрации, а не раздельные слои: нет независимо доступных головы, волос, рук, одежды и скрытой геометрии под перекрытиями. Автоматическое slicing даст швы, пустоты и ложные суставы. Для production 2.5D потребуются ручные cutouts, repaint hidden regions и авторские pivots/occlusion masks.

### 3. NK1 Original SVG — редактируемый концепт, но пока не depth rig

`KurisuOriginalStage.tsx` содержит отдельные SVG-пути/формы для лица, волос, одежды, ног и нескольких силуэтов рук; поддерживает outfit/palette и preset poses. Это более пригодный источник для технического blockout, чем полные PNG.

**Вывод:** SVG можно реорганизовать в группы depth-слоёв и использовать для тестового puppet prototype, но его preset silhouettes не обеспечивают свободную суставную деформацию, hidden-area paint, корректные профили/повороты и production occlusion. Нужна отдельная художественная доработка, а не только перенос SVG path в Three.js.

### 4. Текущий 2.5D runtime

PR #408 уже реализует versioned `nk1DepthRigManifest`, проверку иерархии, pivots, depth/parallax, bounded semantic pose, Three.js transform adapter, face morph resolver и spring follow-through для волос/пальто. WorkPass635 добавляет опциональный bridge для PR #410 MotorFrame с explicit joint bindings и measured `angleRad`.

Runtime готов принимать валидный rig, но **производственный layered character asset отсутствует**, а родительский UI пока не передаёт живой MotorFrame через новые optional props.

## Рекомендованный производственный формат

Для первого полноценного 2.5D master asset нужен один согласованный layered source:

1. **Head/face:** face base, separate eyes/eyelids/eyeballs, brows, mouth shapes, ears, front hair, side locks, back hair, hair accessories.
2. **Neck/torso:** neck, shirt, tie, coat body, left/right lapels, front/back coat tails.
3. **Arms:** left/right upper arms, forearms, hands, cuffs; скрытые участки плеч/рукавов должны быть дорисованы под перекрытиями.
4. **Lower body:** skirt/shorts, left/right legs, socks/tights, shoes — если нужен кадр ниже пояса.
5. **Occlusion:** отдельные masks/ordering rules для hair↔face, arms↔torso, lapels↔shirt, hands↔props.
6. **Rig metadata:** stable node IDs, parent IDs, normalized pivots, rest transforms, depth order, parallax coefficient, semantic role и explicit motor binding IDs.
7. **Export:** PNG/WebP с alpha + manifest; затем GLB/Three.js scene с manifest в glTF extras/userData, чтобы существующий loader мог валидировать контракт.

Каждый слой должен содержать запас скрытой геометрии за соседними слоями. Не вырезать только видимый контур: при yaw/tilt иначе откроются прозрачные дыры.

## Этапы без преждевременной генерации

1. Зафиксировать art direction и референсы из существующей Live2D/PNG/SVG библиотеки.
2. Подготовить layer inventory, pivots и occlusion matrix; выбрать фронтальный master pose.
3. Сделать один тестовый верхний торс (head + neck + torso + hair + coat + arms), а не сразу полный персонаж.
4. Проверить повороты головы, gaze, дыхание, gesture, spring follow-through и перекрытия в PR #408 runtime.
5. Только после visual review расширять до ног, аксессуаров, дополнительных outfits и secondary motion.
6. Выполнить desktop/Android visual E2E и performance checks до включения 2.5D по умолчанию.

## Оценка готовности

| Область | Оценка | Основание |
|---|---:|---|
| Существующая Live2D модель и physics | 75/100 | Реальные модель, параметры, expressions и physics присутствуют; visual/device E2E ещё требуется |
| Legacy PNG как reference library | 65/100 | 32 существующих stills, семантика проверена; нет независимых частей |
| Editable SVG как blockout source | 55/100 | Разделённые векторные формы и preset poses; нет полноценной depth/occlusion системы |
| 2.5D runtime foundation PR #408 | 70/100 | Manifest, validation, Three adapter, face resolver, springs, optional MotorFrame bridge; CI code checks pass |
| Production layered art asset | 5/100 | Авторский PSD/ORA/GLB с hidden areas/pivots пока не подтверждён |
| Полный 2.5D персонаж end-to-end | 25/100 | Runtime foundation есть, art asset, live motor feed и device visual E2E отсутствуют |

## Ограничения

- В этом WorkPass не создавались и не генерировались новые изображения.
- Не утверждается, что PNG sprites или compiled Live2D texture могут быть автоматически превращены в чистые 2.5D слои.
- Лицензия/право на переработку и распространение каждого исходного арт-актива должны быть отдельно подтверждены до включения в Release ZIP.
- Канонический GitHub Release ZIP не изменён.
