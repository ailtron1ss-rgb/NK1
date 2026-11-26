# NK1: фактические типы тела и статус аватарных ресурсов

Дата проверки: 26.11.2026  
Ветка проверки: aspect/avatar-visual-prototype-polish-20261124  
Снимок до текущего обновления: 12f830057152c910d76a0eb7a83bf26b2d0049a4

## Главный вывод

В NK1 действительно существует полноценное деформируемое 2D-тело Live2D Cubism. Это не одна плоская картинка и не набор PNG-кадров. Модельная структура ссылается на бинарный Cubism-модуль Kurisu.moc3, атлас текстур, физику, display metadata, expressions, motions и hit areas. В App runtime используются Pixi Live2D + Cubism Core, а модель загружается через Live2DModel.from(modelPath) в WebGL canvas.

Важно разделять два понятия: Cubism — полноценный деформируемый 2D mesh/parameter rig, но не скелетный humanoid 3D-риг с полноценным управлением плечами, локтями, кистями, пальцами и ногами. Кроме того, NK1 сейчас подключает к Live2D только подтверждённый набор каналов: голова/наклон, взгляд, выражения, речь/viseme и authored motion/physics. Наличие более сложного исходного model rig само по себе не доказывает, что NK1 уже управляет каждым сегментом тела.

## Матрица рендереров

| Режим UI | Фактический тип ресурса | Что реально делает | Чего не следует ожидать |
|---|---|---|---|
| **Live2D** | Cubism model3 + moc3 + texture atlas + physics + motions/expressions | Деформирует авторский 2D mesh по параметрам; blink, gaze, выражения, mouth/viseme и motions; отдельные hit areas Head/Body | Не считать его 3D humanoid skeleton/IK; runtime пока не заявляет управление каждой конечностью |
| **NK1 Original** | Программный inline SVG из vector paths | Отрисовывает отдельные SVG-части, меняет позы/черты/одежду, ограниченно проецирует gaze, head/body и breath | Это не production Live2D rig и не собранная layered PSD/KRA анатомия; нет полноценной скрытой анатомии, костей, физики или свободной full-body деформации |
| **Legacy** | PNG sprite poses, загружаемые через Image() и рисуемые на Canvas | Переключает/смешивает готовые изображения; на контакт показывает короткий визуальный halo | Это статичные кадры. Нет deformable rig, независимого управления суставами, настоящего lip-sync или физики |
| **3D preview** | Three.js + GLB/VRM loader | Настоящая 3D-сцена/модель; v5 — встроенный основной candidate, v7/v12 — отдельные preview кандидаты | Preview не является подписанной к выпуску production-моделью; humanoid coverage, visual quality, Android/device и licensing gates не закрыты |
| **2.5D** | Контракт/план rigging, не законченный персонаж | Есть требования к слоям, pivot, depth, occlusion, mesh и тестовым позам | Не считать реализованным 2.5D телом: production layered art pack и rig ещё не созданы и не прошли приёмку |

## Проверенные пути и технические признаки

### Live2D Cubism — реальный body asset

Единый canonical owner ресурсов: runtime/neuro-kurisu/public/live2d/.

Основной model descriptor:
- runtime/neuro-kurisu/public/live2d/Kurisu/Kurisu.model3.json
- Kurisu.moc3 — бинарная модельная геометрия/риг (6,001,152 байт в проверенном tree).
- Kurisu.4096/texture_00.png — основной texture atlas 4096 (8,236,235 байт).
- Kurisu.physics3.json — физические настройки.
- Kurisu.cdi3.json — display metadata.
- Expressions: авторские .exp3.json.
- Motions: .motion3.json, включая loop/idle, TapHead, TapBody и дополнительные движения.
- Groups: EyeBlink и LipSync.
- HitAreas: Head и Body.

Для мобильного профиля предусмотрена отдельная конфигурация с 2048 texture; motion/physics/expressions переиспользуются через относительные ссылки. App viewer выбирает profile и загружает локальные pinned runtime-файлы:
- app/public/live2d/vendor/pixi.min.js
- app/public/live2d/vendor/live2dcubismcore.min.js
- app/public/live2d/vendor/cubism4.min.js

App-ресурсы не являются второй независимой копией-источником. Перед запуском Vite app/scripts/with-app-env.mjs вызывает hydrateCanonicalPublicAssets. Manifest contracts/inventory/canonical-public-assets-workpass42.json задаёт canonical path, app target path, byte size и SHA-256. Hydrator проверяет hash/size, отклоняет symlink и конфликтующий файл и не перезаписывает несовпадающий локальный asset. Поэтому отсутствие бинарной модели в обычном Git-каталоге app/public/live2d само по себе не означает, что модели нет.

В актуальной App-версии viewer код использует локальные runtime-файлы; не следует путать её с историческим runtime viewer, где встречались CDN-подключения.

### NK1 Original — не PNG, но и не Cubism

app/src/components/KurisuOriginalStage.tsx строит персонажа из inline SVG/path. Это живой векторный renderer с ограниченными изменяемыми частями, а не один статический растр. Однако art manifest app/public/kurisu-original/asset-manifest.json имеет статус planning-inventory, а 24 production art entries отмечены not-authored. Контракт прямо запрещает считать текущий SVG production layered illustration или готовым 2.5D/IK rig.

### Legacy — именно статические изображения

app/src/legacy/avatar/LegacySpriteDeck.tsx использует new Image() и ctx.drawImage(). Он выбирает готовый PNG кадр и делает визуальный crossfade. Контактная подсветка честно показывает реакцию на наблюдённое касание, но не симулирует деформацию картинки. Существующие 32 legacy sprite pose assets остаются справочными/статическими позами; они не подтверждают отдельные слои одежды, hidden anatomy, rigging или права на повторное распространение.

### 3D и 2.5D

3D-режим строит реальную Three.js сцену и умеет загружать VRM/GLB. Встроенный v5 остаётся основным кандидатным телом; v7/v12 явно маркируются как временные preview и не должны автоматически становиться canonical/persisted. Для v12 ранее зафиксирована структура 125 nodes, 101 meshes, 19-joint skin и 11 morph targets, но это не закрывает визуальный, мобильный и legal sign-off.

2.5D пока представлен контрактами/планом. Для перехода необходимы исходники слоями (PSD/KRA/SVG), полный слой скрытой анатомии под перекрытиями, stable IDs, pivots, parent graph, depth planes, alpha/masks, mesh/deformation data, turnarounds и испытания крайних поз.

## Где нынешняя архитектура может запутать

В UI есть четыре конкретных режима: live2d, original, legacy, 3d. В capability contract поле EmbodimentMode пока намеренно более грубое: live2d | depth2d | vrm3d; Original SVG и Legacy sprites оба относятся к общей категории 2D и различаются по rendererId (nk1-original-svg-2d, nk1-legacy-sprites-2d). Это не значит, что рендереры идентичны, но coarse mode недостаточно выразителен для пользовательского каталога и телеметрии.

Также productionReady в текущем manifest означает, что renderer с соответствующим asset может быть selectable в своём ограниченном fallback назначении. Это не оценка равенства качества полноценному Cubism body и не доказательство production-grade rig. Следующий этап должен отделить как минимум:
- UI mode ID / renderer ID;
- asset type и canonical source;
- selectable / fallback-only / preview-only;
- rig class: static, vector-driven, Cubism deform rig, depth puppet, humanoid skeleton;
- подтверждённые capability channels;
- visual, device, legal и release approvals.

Необходимо сохранить точную текущую правду: **Live2D — основной полноценный деформируемый 2D rig; Original — векторный концепт renderer; Legacy — статичные спрайты; 3D — preview; 2.5D — пока проектирование.**

## Большой следующий этап: One Body / Renderer Truth / Embodiment Completion

Цель следующего захода — не просто добавить ещё один режим, а создать единый проверяемый body pipeline, в котором выбран ровно один renderer, его фактические возможности видны пользователю, а cognition/motor state не меняются при смене renderer.

### Work package A — Закрыть текущую контактную цепочку
1. Исправить устаревшие toolbar assertions и прогнать exact-head avatar-contact workflow.
2. Довести 3D raycast на animated SkinnedMesh до реального Playwright клика: click → 3D hit-zone → contact envelope → API → SocialMind evidence → snapshot evidence ID → видимая реакция.
3. Проверить Original SVG, Live2D и Legacy тем же end-to-end контрактом отдельно на desktop/mobile; не подменять реальный motion статичным halo.
4. На каждом renderer фиксировать accepted / unsupported / unavailable, а не только общее «касание зарегистрировано».
5. Артефакты приёмки: desktop/mobile screenshots, run logs, exact SHA, hit point/zone, event ID, evidence ID, renderer-specific visual result.

**Gate A:** все реальные контакты проходят на точном HEAD; ноль выдуманных evidence; 3D hit detection подтверждён именно браузером, не unit-тестом.

### Work package B — Сделать каталог тел однозначным
1. Разделить coarse class и конкретный UI renderer identity в schema capability contract; не ломать старый EmbodimentMode без миграции и совместимых тестов.
2. Заменить неоднозначный production boolean на отдельные статусы: selectable, fallback-only, preview-only, rigged, visual-approved, device-approved, license-reviewed.
3. Подключить capability registry прямо к selector UI: Live2D явно обозначить «Cubism / deform rig»; Original — «SVG / limited vector body»; Legacy — «static sprite poses»; 3D — «VRM/GLB preview».
4. Запретить автоматическое молчаливое переключение с Live2D на Legacy. При ошибке — честный error, retry и явное действие пользователя для выбора fallback.
5. Заблокировать 2.5D в selector до наличия валидного asset manifest и rig preflight.
6. Добавить тесты: UI label ↔ rendererId ↔ assetKind ↔ actual adapter ↔ accepted capabilities совпадают; fallback никогда не выдаётся за canonical rig.

**Gate B:** в UI нельзя спутать PNG, SVG, Cubism rig, 2.5D puppet и 3D humanoid; выбранный тип тела и ограничения сообщаются до/после переключения.

### Work package C — Поднять именно основное Live2D тело
1. Аудитировать параметры Cubism model и записать mapping всех реальных параметров в NK1 adapter: head, eyes, brow, mouth/viseme, torso/arm motion, outfit toggles, hit areas.
2. Проверить, какие limb/body channels действительно управляются текущими authored motions, а какие отсутствуют; не ставить в manifest неподтверждённые каналы.
3. Расширить expression/motion library под cognitive semantics: idle/listen/think/curious/disagree/explain/defend/embarrassed/relieved; конфликтующие движения арбитрировать по приоритету и fade.
4. Проверить hit areas на краях силуэта и синхронизировать body/head tap с настоящими Cubism areas, а не только половиной canvas.
5. Проверить mobile profile/texture quality, загрузку, GPU cleanup, FPS, memory и long-run stability на Android.

**Gate C:** Live2D остаётся основным default body; every declared channel проходит параметрический readback + visual browser/device acceptance, речь согласована с аудио-часами, нет ложного lip-sync.

### Work package D — Настоящее производственное 2.5D тело
1. Получить/создать редактируемый master, не flattened PNG: PSD/KRA/SVG, 4096 master canvas, layered alpha exports.
2. Подготовить six views, десять эмоций, три outfits, accessory slots и скрытую анатомию под hair/clothes.
3. Собрать manifest слоёв со stable IDs, parent graph, exact pivots, z/depth, masks, occlusion, rest transform, bounds и source hashes.
4. Сделать deformable meshes с seams/UV/alpha padding и measured displacement budgets.
5. Реализовать renderer adapter: head/neck, torso, upper arm, forearm, hands, legs, hair, eyes, jaw, breath, parallax; использовать IK только там, где он действительно существует.
6. Прогнать deformation contact sheets для крайних положений; проверить дырки/швы/пересечения, multi-view silhouette и identity consistency.
7. Оставить 2.5D non-selectable до полного provenance + visual + runtime gate.

**Gate D:** 2.5D не является пачкой случайных картинок; это единый layered puppet с документированной геометрией/перекрытиями и реальными управляемыми каналами.

### Work package E — 3D довести до контролируемого production candidate
1. Сверить v5, v7, v12 и последующие модели по topology, rig humanoid coverage, face morphs, materials, scale, animations, texture memory.
2. Проверить Humanoid mapping, wrists/hands/fingers/ankles, inverse kinematics, floor contact, gaze, expression and visemes.
3. Провести визуальное сравнение в одинаковых camera/light/expression/pose сценах; отдельно измерить likeness, anatomy, motion artifacts and mobile frame time.
4. Зафиксировать происхождение, права, source project, generated model license and redistribution terms.
5. Только после approval пометить candidate как production-approved; до этого 3D остаётся preview.

**Gate E:** выбранная 3D-модель проходит independent visual, humanoid rig, device-performance и license checks; preview candidate не меняет canonical v5 автоматически.

### Work package F — Единое тело для cognition и motor
1. Оставить один canonical organism/embodiment frame; renderer adapters — только отображение.
2. Добавить renderer-independent action plan: intent, priority, duration, interruptibility, blend, target, provenance and expiry.
3. Развести internal affect, observable expression и user-visible response, чтобы разные рендереры не симулировали эмоции, которых нет в state.
4. Подключить switch handoff с exact state revision, current speech clock, gaze, pose, interaction state and visual acknowledgement.
5. Добавить deterministic replay: один motor trace проигрывается в Live2D, SVG, 3D и будущей 2.5D сцене, но каждое адаптерное ограничение видно.

**Gate F:** renderer switch меняет только оболочку тела; intent, affect, speech timeline, memory/cognition revision и interaction ledger сохраняются и имеют проверяемые receipts.

## Приоритет и готовность

Первым выполнять A и B — они устраняют фактическую проблему надёжности контактов и неоднозначности выбора. Затем C — укрепить уже существующее настоящее тело. D и E вести параллельно как production art/3D tracks, но не включать в selector преждевременно. F объединяет всё в единую систему.

Нельзя объявлять следующий этап завершённым по одному успешному build. Нужны exact SHA, unit + integration + browser acceptance, реальный Android soak, asset hashes, визуальные доказательства, provenance/license и release ZIP audit. До закрытия этих gates ветви остаются Draft и не попадают в Release.

## Дополнение к реализации 26.11.2026

В текущей ветке добавлен второй уровень точности для каталога рендереров:
- schema v2 добавляет `rigClass` и `selectionRole`;
- `productionReady` оставлено как совместимое поле наличия/selectability реального тела, но больше не трактуется как оценка качества, лицензии, Android и готовности к релизу;
- schema v1 остаётся читаемой для старых сохранённых manifest;
- registry выбирает `primary` для canonical режима, допускает `fallback`, но не выдаёт `preview-only` кандидата за selectable тело;
- несовместимые пары, например `static-poses + cubism-model`, блокируются валидатором.

Текущая v2 классификация:
| rendererId | rigClass | selectionRole | смысл |
|---|---|---|---|
| nk1-live2d-cubism | cubism-deform | primary | основное деформируемое 2D-тело |
| nk1-original-svg-2d | vector-driven | fallback | управляемая векторная иллюстрация |
| nk1-legacy-sprites-2d | static-poses | fallback | набор готовых PNG-поз |
| nk1-three-vrm3d | humanoid-skeleton | preview-only | 3D-кандидат, не production body |

В #1164 изменён приём pointer contact у Original SVG: обработчик перенесён на stage wrapper в capture-фазу, событие принимается только если pointerdown начался внутри SVG, а координаты вычисляются относительно SVG bounding box. Причина фикса — на предыдущем exact-head browser acceptance реальный Playwright tap по SVG не создавал canonical event, хотя unit tests проходили. До успешного повторного browser run это решение считается кандидатом на исправление, не доказанным исправлением.

Проверка #1164 на предыдущем HEAD c5793566f3b0213182f5a09479ab09665a51a059 завершилась так:
- Live2D WebGL visual browser acceptance — success.
- GLB/VRM preflight, switch contract + app typecheck, cognitive-affect motor coupling + typecheck, Original 2D asset contract — success.
- Avatar Contact Browser Acceptance — failure на первом Original SVG face tap (ожидался zone=head, наблюдаемого event не было); 3D browser stage в этом запуске не был достигнут.
- На новом HEAD 2c87d22110b356ce973ca78a6a815dbd97aa6c2a включены capture-handler fix, его тест, rig/selection schema v2 и проверки. Exact-head workflows поставлены на повторную проверку; их результаты нельзя наследовать от предыдущего SHA.

Дополнительная диагностика browser gate добавлена в commit 0cd7c70d28e80344b49848190113703cd87b3b68: при отсутствии Original SVG contact событие pointerdown/up/cancel, pointerId/type, SVG/stage bounds, нормализованные координаты и фактический elementFromPoint записываются в лог; снимается full-page screenshot. Это нужно для однозначной диагностики, если перенос обработчика на stage capture не закроет проблему.
