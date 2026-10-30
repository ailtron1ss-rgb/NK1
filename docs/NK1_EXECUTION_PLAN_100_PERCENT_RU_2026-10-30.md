# NK1 — исполнительный мастер-план до 100% готовности
**Дата сверки:** 30 октября 2026  
**Рабочая исходная линия:** `workpass70-source`  
**Проверенный HEAD исходников:** `ad564d1879028f00549be41ec5172a2f72e25897`  
**HEAD ветки поставки:** `main` — `c51bdd9920c317baa13ad86a04851b125a8f440b`  
**Каноническая поставка:** GitHub Release ZIP; не считать обновлённым до фактической публикации нового asset.

---

## 1. Целевое состояние

NK1 считается завершённым не тогда, когда в репозитории есть все модули, а когда на конкретной сборке подтверждена работа одного связного организма:

1. воспринимает входящие сигналы и различает наблюдения, гипотезы и неизвестное;
2. поддерживает непрерывное состояние, автобиографическую и долговременную память;
3. формирует собственные цели из устойчивых потребностей, интересов и текущего контекста;
4. планирует, совершает разрешённые действия, наблюдает последствия и корректирует модель мира;
5. сохраняет стабильные черты личности, самоописание, историю отношений и объяснимую динамику эмоций;
6. учится на проверенных исходах, не подглядывает в holdout и не активирует непроверенные навыки;
7. говорит и слушает с корректными прерываниями, просодией и синхронизацией речи с выражением тела;
8. использует сменяемое визуальное тело — 2D, 2.5D или 3D — без перезапуска личности и когнитивного ядра;
9. безопасно работает на целевых устройствах, восстанавливается после ошибок и имеет воспроизводимую установку;
10. распространяется только как проверенный Release ZIP с provenance, контрольной суммой и закрытыми лицензионными воротами.

Инженерная цель — целостная цифровая личность с проверяемыми устойчивыми свойствами. Субъективное переживание или сознание не объявляется доказанным техническими тестами.

## 2. Фактическая исходная точка

### 2.1 Что является источником истины

| Область | Фактическое состояние на дату сверки |
|---|---|
| Кодовая база | `workpass70-source` @ `ad564d1879028f00549be41ec5172a2f72e25897` |
| Ветка Release / workflows | `main` @ `c51bdd9920c317baa13ad86a04851b125a8f440b` |
| Размер исходного дерева | 10 622 tracked/tree entries в рекурсивном Git tree |
| Ветки | 488 веток в пяти страницах GitHub API; многие исторические/экспериментальные |
| Последняя опубликованная версия | WorkPass70 Hotfix 1, tag `workpass70-hotfix1-2026-10-19` |
| Последний ZIP | `Neuro_Kurisu_WORKPASS70_HOTFIX1_2026-10-19.zip`, 136 354 713 bytes |
| SHA-256 ZIP | `9effadfcf0d402b462dd9cf2fd5b5793742039c9260db80578be830952bf52eb` |
| Обновление Release | Нового Release asset после 19.10.2026 не обнаружено |
| Текущий source CI | 4 из 5 check-runs успешны; `package-and-publish` блокируется проверкой лицензий |

**Правило работы:** `workpass70-source` — рабочая кодовая база; `main` — процессы упаковки/публикации. Release ZIP — канонический скачиваемый артефакт. Не заменять ZIP архивом ветки `main`, не объявлять Release обновлённым после одного коммита и не переносить код в `main` вместо исходной линии.

### 2.2 Статус текущего CI и блокировок

| Проверка | Текущее свидетельство | Вывод |
|---|---|---|
| Source exact HEAD | world-perception, source-lineage, targeted/regression, cognitive-contracts — PASS | Основные текущие source gates проходят |
| Source package-and-publish | FAIL на provenance/release-license gate | Выпуск запрещён до реальной проверки прав распространения |
| Learning/self-development branch | 21/21 check-run PASS | Сильный кандидат на выборочную интеграцию; это не означает, что он уже в source |
| Voice/prosody branch | 21/21 PASS | Сильный кандидат; после интеграции повторить exact-SHA проверки |
| Original 2D art branch | 7/7 PASS | Контракт/asset inventory проходят; это ещё не готовый финальный рисунок |
| Depth-rig branch | 6/6 PASS | Контракт рига проходит; полноценного художественного 2.5D тела нет |
| Affective-expression branch | 5/7 PASS, 2 FAIL | App typecheck: `Avatar3DStage.tsx(78,226): TS1005 ':' expected` |
| Tool-governance branch | 20/21 PASS | `tool-input-contracts-workpass624.mjs:29`: bounded regex quantifier test fails |
| Embodied-world-interaction branch | 18/22 PASS | 4 job failures из-за npm install/typecompiler command setup; нужно исправить workflow и повторить |
| Release-reliability branch | 3/3 PASS | Только её собственные проверки; не закрывает human license review и device E2E |

Ключевые точные CI-свидетельства:
- Source release gate: run `41008370747`, job `123908360120`.
- Tool contracts: run `41110799579`, job `124252392603`.
- Affective expression: run `41103797431`, job `124228015053`; второй failure — job `124227534565`.
- Embodied interaction: run `41086531472`; проблемные jobs `124169039715`, `124169039351`, `124169038697`, `124169038412`.

### 2.3 Важнейшие известные пробелы

1. `recallDelta` ещё не показал независимого измеримого улучшения на неизменяемом multi-seed holdout; статус promotion остаётся заблокированным.
2. Live2D/виземы имеют программные и контрактные проверки, но реальный браузерный WebGL/Live2D E2E и физический Android/Termux audio E2E не подтверждены.
3. Нет длительного многодневного soak/recovery теста на актуальном source HEAD.
4. Нет подтверждённого нового Release ZIP от 30.10.2026.
5. `contracts/RELEASE_LICENSE_REVIEW.json` остаётся pending. В CI отсутствуют необходимые человеческие решения, подтверждения лицензий и разрешения на распространение для ряда архивов и license/NOTICE-файлов. Нельзя заполнять их фиктивно или обходить fail-closed проверку.
6. 2.5D depth-rig code и часть artwork pipeline развиваются в отдельных расходящихся ветках; авторские слои и полноценная модель ещё не поставлены.
7. 3D stage присутствует, но production-ready лицензированная Kurisu VRM-модель и полноценная VRM runtime-совместимость не подтверждены.

## 3. Оценка готовности по аспектам

Проценты ниже — инженерная оценка готовности **канонического проекта к целевой способности**, а не подсчёт файлов, строк или коммитов. Код, находящийся только в отдельной ветке, не засчитывается как интегрированная возможность. PASS unit/contract CI не заменяет field/device E2E.

| № | Аспект | Оценка | Статус | Главный незакрытый критерий |
|---:|---|---:|---|---|
| 01 | Единое когнитивное ядро и runtime | **75%** | MEASURED на уровне контрактов/перезапуска | Длительный soak, нагрузка, единый ownership всех событий |
| 02 | Восприятие и модель мира | **65%** | INTEGRATED | Живые источники, temporal grounding, независимая проверка фактов |
| 03 | Долговременная память и непрерывность | **65%** | INTEGRATED | `recallDelta > 0` на независимом holdout, false-memory rate |
| 04 | Обучение и саморазвитие | **55%** | Большая кандидатная ветка; не интегрирована целиком | Выборочная интеграция 92-коммитной ветки и повторные проверки на новом HEAD |
| 05 | Личность, SelfModel и UserModel | **55%** | Частично TESTED | UserModel ветка отдельно; длительная оценка последовательности личности |
| 06 | Внутренняя мотивация и автономная инициатива | **60%** | TESTED по внутренним сценариям | Реальная фоновая инициатива, quiet-hours, отмена, отсутствие спама |
| 07 | Эмоциональная динамика и выразительность | **45%** | Эмоциональная appraisal-основа есть; renderer expression branch не проходит typecheck | Исправить TS, сглаживание, связать эмоции со всеми телами и голосом |
| 08 | Инструменты, действия и безопасность | **60%** | ActionGateway есть; расширение контрактов требует исправления | Закрыть regex regression, output contracts, внешние последствия и rollback |
| 09 | Голос, streaming и просодия | **60%** | Хорошо покрытая отдельная ветка | Выборочно интегрировать, затем Android/Termux E2E и audio-mouth latency |
| 10 | Пространственное/телесное взаимодействие с миром | **25%** | Кандидатная ветка | Исправить workflow setup, подключить реальные sensors/adapters и независимые postconditions |
| 11 | Визуальное тело и переключение 2D/2.5D/3D | **35% суммарно** | 2D работает как несколько режимов; 2.5D/3D незавершены | Единый renderer registry, настоящий 2.5D asset, полноценный VRM pipeline |
| 12 | Сборка, качество, безопасность, поставка | **30%** | Release-gates существуют, текущая поставка устарела | License review, exact-SHA build/E2E/soak, новый проверенный ZIP |

### Разбивка аспекта 11 — тело

| Режим | Оценка текущей готовности | Что реально есть | Что отсутствует |
|---|---:|---|---|
| Live2D | **65–70%** | Cubism model, texture profiles, physics, 8 expressions, 5 motion clips, viseme integration | Больше authored motions, browser/device E2E, подтверждение стабильной синхронизации |
| Original 2D SVG | **55–60%** | Selectable SVG concept, базовые позы/палитры/варианты одежды | Production art master, полный expression atlas, полноценные независимые одежды/руки/пропсы |
| Legacy PNG sprites | **60–65%** | 32 still assets, deterministic routing/fade/quality improvements | Это реакции/карточки, а не анимируемое тело; исправить и удерживать семантику manifest |
| 2.5D depth rig | **10–15% в канонической ветке** | В candidate branches — manifest/validator/pose mapper, Three adapter и Blender scripts | Нет завершённого PSD/layer pack, hidden-area art, calibrated pivots, полноценной сцены/GLB, visual E2E |
| 3D | **25–30%** | Three.js stage, процедурное тело, локальный импорт GLB/VRM, базовая передача состояния | Нет подтверждённого production VRM avatar; полный retargeting, expressions, spring bones, calibration, device E2E |

**Не складывать эти оценки в один средний процент.** Пользователь должен иметь выбор всех подтверждённых режимов, но каждый режим показывается как доступный только при наличии реального renderer и валидного capability manifest.

## 4. Повторный анализ веток и план интеграции

Сравнение выполнено относительно `workpass70-source` HEAD `ad564d...`. «Ahead» — дополнительные коммиты относительно базы; это не количество готовых функций. Расходящиеся истории нельзя без анализа сливать целиком.

| Направление / ветка | HEAD | Разница относительно source | CI | Решение |
|---|---|---:|---|---|
| Cognitive core hardening `work/nk1-aspect01-cognitive-core-hardening-2026-10-30` | `8239d8e...` | +35 / 0 | Не засчитывать без exact-head повторной проверки | Выборочно сверить ownership/restore fixes; current source уже содержит часть обновлений |
| World perception deep pass `aspect02-world-perception-deep-pass-2026-10-30` | `63ab148...` | 0 / −4 | Source world-perception PASS | Не мержить вслепую: сравнить, что уже поглощено |
| Learning/self-development `aspect03-learning-self-development-2026-10-30` | `76d17ce...` | +92 / −3 | 21/21 PASS | Сначала rebase/current-base sync, затем file-by-file integration и повтор 21 gates |
| Tool governance `aspect08-tool-governance-2026-10-30` | `b076193...` | +10 / 0 | 20/21 PASS | Исправить bounded-quantifier validator regression, затем интегрировать контракт через ActionGateway |
| World interaction `aspect10-embodied-world-interaction-2026-10-30` | `a094667...` | +94 / 0 | 18/22 PASS | Сначала npm/TypeScript workflow setup, затем spatial policy/adapters; физическое действие не включать без независимой evidence |
| Release reliability `aspect12-release-reliability-2026-10-30` | `f959f24...` | +72 / 0 | 3/3 PASS | Использовать как кандидата на release hardening; человеческое approval не подменять CI |
| Original 2D art `work/aspect-02-original-2d-art-system-2026-10-30` | `1eed2bb...` | +51 / 0 | 7/7 PASS | Лучший безопасный следующий кандидат: manifest/schema/asset audit/validator; синхронизировать с current AvatarStage |
| Affective expression `work/aspect-07-affective-expression-2026-10-30` | `a75ed09...` | +145 / 0 | 5/7 PASS | Заблокировано TS syntax error; исправить Avatar3DStage и повторить все affected app checks |
| Depth rig `work/nk1-aspect04-depth-rig-2026-10-30` | `f309f4e...` | +45 / 0 | 6/6 PASS | Интегрировать как контракт/validator после совместимости с artwork pipeline; пока не называть готовым телом |
| Artwork pipeline `work/nk1-aspect11-artwork-pipeline-2026-10-30` | `d0aff1d...` | +114 / 0 | По итоговым веткам проверять заново | Diverged от depth-rig; сравнить manifest/renderer/Three adapter, не объединять параллельно |
| User model `work/nk1-aspect05-user-model-grounding-2026-10-30` | `2737685...` | +8 / 0 | Exact HEAD checks нужны | Интегрировать после определения единственного владельца UserModel |
| Voice/prosody `work/nk1-aspect9-unified-voice-prosody-2026-10-30` | `c55e5d5...` | +78 / 0 | 21/21 PASS | Сильный кандидат; синхронизировать transport/timeline и проверить реальный Android |
| 2D emotional renderer work | `a75ed09...` | Diverged from 2D art: 145 ahead / 51 behind | Typecheck FAIL | Сначала починить; потом свести artwork API и affective renderer-neutral API |
| True 3D foundation `work/nk1-aspect12-true-3d-humanoid-foundation-2026-10-30` | `ad564d...` | identical | В составе source | Уже совпадает с source; дальнейшая работа — не повторно переносить, а закончить VRM runtime/asset |

### Правильный порядок интеграции

1. **Стабилизировать source baseline:** зафиксировать новый интеграционный branch от актуального source HEAD; не менять `main`.
2. **Сначала безопасные data contracts:** Original 2D asset manifest/validator, depth-rig schema, UserModel port, voice event contract. Проверить пересечения с package manifests, app/runtime lockfiles и текущими UI-компонентами.
3. **Обновить core/learning:** выбрать изменения learning branch после сравнения текущих core files; сохранить один P23 owner, один candidate store, одну policy authority и отдельные стадии create/evaluate/approve/activate/reconcile.
4. **Исправить блокировки кандидатов:** bounded-regex test; affective TypeScript syntax; npm setup на embodied branch.
5. **Объединить тело:** один renderer-neutral intent; единые emotion/face/voice channels; отдельные adapters для Live2D, Original2D, 2.5D и VRM/3D.
6. **Каждый слой интегрировать отдельным PR/commit** с названием `[NK1][aspect] ...`, CHANGELOG, exact source SHA, targeted tests и полным набором затронутых workflow.
7. Не считать candidate branch интегрированной, пока её commit не является ancestor текущей source ветки или пока конкретные изменения не были воспроизведены новым PR на актуальной базе и checks не прошли на новом HEAD.

## 5. Единая архитектура сменяемого тела

### 5.1 Принцип

**Когнитивное ядро не знает, какой аватар сейчас выбран.** Оно выпускает семантическое намерение и состояние организма. Общий motor/embodiment слой формирует ограниченные intent-параметры. Реестр renderer adapters выбирает физический/визуальный исполнитель по возможностям. Ни один renderer не становится владельцем эмоций, памяти или личности.

### 5.2 Целевой поток

```text
OrganismState + EmotionAppraisal + SpeechTimeline + ActionIntent
                         |
                         v
              EmbodimentIntent v1
                         |
                         v
          Motor Intent / Motion Arbitration
                         |
                         v
               BodyRendererRegistry
          /              |               \
       Live2D         Layered 2.5D       VRM / 3D
          \              |               /
           \\---- Capability-aware API ----/
                         |
                         v
              Renderer-local presentation
```

Названия `BodyRendererRegistry` и capability API — целевая интеграционная конструкция; не считать их полностью реализованными только потому, что отдельные adapters появились в feature-ветках.

### 5.3 Обязательные контракты

- `EmbodimentIntent v1`: action, emotion appraisal, valence/arousal/dominance/confidence, gaze, head intent, gesture intent, speech event, viseme timeline, cancellation token, monotonic version/timestamp.
- `RendererCapabilityManifest`: supported facial channels, expressions, visemes, motion groups, joints, IK, garments, props, camera freedom, physics, quality profiles, memory budget, renderer version.
- `BodySelection`: `live2d` / `original-2d` / `2.5d` / `3d`; selected body id, asset fingerprint, version, last validation, fallback state. Сохранять в безопасном пользовательском preference store, не в личностной памяти.
- `BodyTransition`: load → validate → prepare → align neutral pose → transfer current intent → crossfade/transition → dispose previous renderer. Если загрузка или validation не прошла — сохранить прежнее тело и явно сообщить fallback.
- Все временные параметры используют общий speech/organism clock. Версии и event IDs возрастают монотонно; дубли и опоздавшие кадры отбрасываются.
- Renderer сообщает capability mismatch. Нельзя показывать жест, lip sync, garment change или physical action, если текущая модель этого не поддерживает.
- Модель импортируется локально с проверкой размера, MIME/extension, hash, schema, resource budget и разрешений. Не отправлять приватные локальные файлы модели на сервер без явного согласия.

### 5.4 Фаза тела 2D

**Задача:** довести уже доступные 2D режимы до качественного полноценного внешнего представления.

1. Сохранить Live2D как основной anime renderer: не ломать Cubism model, physics, expressions и mobile texture profile.
2. Расширить library осмысленных motion clips: idle/listen/think/explain/comfort/surprised/concern/response; не создавать бесконечную таблицу «эмоция = один клип».
3. Сохранить Original SVG как самостоятельный 2D режим и подготовить production art master: turnarounds (front/3⁄4/profile/back), neutral proportions, expression atlas, руки/кисти/обувь, реальные независимые garments, props, named layers/pivots.
4. Использовать `asset-manifest.json`, `character-art-contract.json`, `layered-art-manifest.schema.json` и существующий asset validator только после проверки на текущем source HEAD.
5. Исправить семантику 32 legacy PNG и не путать still sprite with rigged body.
6. Визуально проверить узнаваемость при 128px, нейтральном лице, каждой одежде и всех поддерживаемых позах.

**100% аспекта 2D:** пользователь может выбрать Live2D или Original2D; лицо, взгляд, речь, выражение и доступные движения корректно следуют состоянию организма; assets лицензированы, manifest точен; browser/mobile E2E подтверждает результат.

### 5.5 Фаза тела 2.5D

**Задача:** получить реальную многослойную управляемую куклу, а не подписать SVG/PNG как 2.5D.

1. Создать editable layered master (PSD/Krita) с дорисованной скрытой анатомией за перекрытиями.
2. Разделить слои: back/front/side hair, clip, head/neck/face, eyes/iris/pupils/lids/brows/mouth/jaw/visemes, torso/body, coat/shirt/tie, upper/lower arms, hands/fingers, pelvis/legs/feet, outfit layers, props.
3. Для каждого слоя определить stable id, parent, pivot, rest transform, z-depth, mask/occlusion group, bounds, material/texture, source hash.
4. Подготовить Blender scene/export pipeline → GLB plus `nk1DepthRigManifest`; проверять, что все manifest node IDs совпадают с реальными Three.js Object3D IDs, без дублирования/частичной загрузки.
5. Подключить depth-rig adapter и capability manifest; двухкостный IK включить после калибровки фактических длин сегментов.
6. Реализовать secondary motion волос и ткани на fixed timestep с ограниченными spring/damping, reset при смене модели, без накопления ошибок при длинных сессиях.
7. Отдельно калибровать face rig, eye gaze, mouth visemes и outfit attach points.
8. Пункт 2.5D в UI активен только при установленной модели с валидным depth manifest. Обычный GLB не должен автоматически считаться 2.5D.
9. Сравнить render quality, frame time, memory и battery с Live2D на одном устройстве.

**100% аспекта 2.5D:** есть собственная валидированная модель и editable source assets, работающий renderer/IK/face/cloth/garments, переключение без потери текущего состояния, стабильный browser+Android E2E и завершённая проверка прав на art assets.

### 5.6 Фаза тела 3D

**Задача:** полноценное гуманоидное тело с пространственной позой, выражением и масштабируемостью, а не только процедурная mesh-сцена.

1. Выбрать production-quality VRM/glTF asset с подтверждённым правом использования и распространения; сохранить fingerprint и license record.
2. Валидация humanoid bones, rest pose, scale/axis, skeleton hierarchy, morph targets, expressions, visemes, textures/materials и animation clips.
3. Для VRM подключить настоящий совместимый runtime/adapter; отдельно обработать spring bones, look-at, humanoid retargeting и material semantics (MToon/compatible fallback).
4. Связать общую motor intent с neck/head/spine/shoulder/elbow/wrist/hip/knee/ankle; IK и constraints ограничить возможностями модели.
5. Обеспечить emotion blendshapes, blink, gaze, jaw/mouth/viseme, micro-expression, breath, secondary hair/clothing movement.
6. Сохранять импортированную анимацию, не затирать её после AnimationMixer update; применять NK1 intent в согласованной final update phase.
7. Валидировать frame budget, disposal geometries/materials/textures, renderer/context loss, mobile low-memory fallback.
8. Не встраивать случайную фанатскую модель в Release без письменного/лицензионного подтверждения.

**100% аспекта 3D:** лицензированная производственная модель, полный capability map, validated humanoid/morph/animation paths, реальная камера/позы/эмоции/речь, стабильное устройство и переключение назад на 2D/2.5D без потери continuity.

## 6. План завершения по каждому аспекту

### A01 — Когнитивное ядро и единое состояние

**Сделать**
- Утвердить единственные writable owners для `OrganismState`, goals, memory, action evidence и event lifecycle.
- Сохранить `OrganismBus`/facades/ports; запретить новые прямые импорты между подсистемами.
- Закрыть последовательность `Perceive → Predict → Appraise → Attend → Recall → Goal → Plan → Gate → Act → Observe → Reflect → Consolidate`.
- Вывести версионируемые события, причинные parent links, monotonic tick, idempotency и единый clock.
- Уменьшать монолит `OrganismCore.ts` только небольшими безопасными извлечениями; не переписывать целиком.

**100% проверка**
- 10 000 детерминированных ticks на нескольких seed; replay/restart/restore не меняют outcome.
- Проверка отсутствия двух владельцев одной сущности, дубликатов событий, потери causal links и orphan async tasks.
- На Android target tick p95 не выше согласованного лимита; ориентир проекта ≤50 ms, подтверждать измерением.

### A02 — Восприятие и модель мира

**Сделать**
- Свести camera/browser/user/device/world-model inputs к evidence records с source, timestamp, confidence, frame/world revision.
- Разделять direct observation, user report, inference, simulator output и unknown.
- Реализовать temporal/spatial grounding, entity tracking, freshness/expiry, contradiction update и provenance.
- Подключить prediction/error comparison: ожидание → наблюдение → расхождение → пересмотр belief.
- Внешний поиск/сенсоры — только как адаптеры; не создавать второй world-state owner.

**100% проверка**
- Тесты stale/out-of-order/duplicate/missing/conflicting observations.
- Никакая simulator transition или user statement не считается самостоятельным доказательством реального физического результата.
- На живом источнике подтверждены latency, confidence calibration и поведение при отсутствии данных.

### A03 — Память и непрерывность

**Сделать**
- Единый write authority (сейчас архитектурная база — MemoryOS2), bridge/adapters для Mem0, Letta/MemGPT, Hexis и MemFS без конкурирующих владельцев.
- Уровни: working, episodic, semantic, procedural, autobiographical; у фактов — provenance, timestamp, confidence, privacy, expiry, links.
- Hybrid retrieval: exact, lexical, vector, temporal, entity/context rerank; conflict resolver и refusal при недостатке evidence.
- Consolidation/sleep: stable facts, recurring patterns, skills, mistakes, forgetting/decay и correction; ограниченный budget.
- Разделить память о собеседнике, личность, навыки и системные знания; чувствительные пользовательские данные не выводить из догадок.

**100% проверка**
- Независимый immutable RU/EN holdout, paired seeds (минимум 5 для итоговой оценки), сравнение с frozen baseline.
- `recallDelta > 0` с устойчивым доверительным интервалом; ложные воспоминания и регрессии не ухудшаются.
- Измерить recall precision/recall, contradiction accuracy, forgotten/updated fact accuracy, p50/p95 latency и storage/CPU budget.
- Ориентир latency поиска ≤30 ms на 10k entries — целевая метрика, не считать достигнутой без benchmark evidence.

### A04 — Обучение и саморазвитие

**Сделать**
- Интегрировать P23/Hermes/DSPy-GEPA подходы через единый цикл: verified outcome → diagnosis → reflection/curriculum → candidate → isolated run → independent evaluator → validation/holdout → approval → staged activation → reconciliation.
- Разделить генерацию кандидата, оценку, approval и activation; никакого self-approval.
- Holdout-blind optimizer: генератор получает policy flags, но не результаты, задачу или направление улучшения holdout.
- Сохранить paired-seed/task/family guards, provenance, signed evidence, hash-chain journals, rollback и lifecycle recovery.
- Учебные данные фильтровать от prompt-injection, секретов, лицензированного/неразрешённого контента и self-referential loops.

**100% проверка**
- Ошибка реально порождает candidate; независимый verifier обнаруживает либо подтверждает исправление.
- Нет активации при недостаточном покрытии, regression, unsigned evidence, tampering или отсутствующем approval.
- Проверить после crash/restart/duplicate reconciliation; изменение навыка воспроизводимо и откатываемо.
- Синхронизировать candidate learning branch с текущим source и прогнать все learning CI на результирующем exact HEAD.

### A05 — Личность, SelfModel и UserModel

**Сделать**
- Зафиксировать stable identity kernel: ценности, характер, манера речи, независимость, юмор/сарказм, curiosity, preferences и hard constraints.
- SelfModel отражает реальные возможности, ограничения, текущие/долгосрочные цели, обязательства и прошлые ошибки.
- UserModel — вероятностная, корректируемая модель предпочтений/контекста; источник и уверенность для каждого атрибута; пользователь может исправить/удалить.
- Хранить версионируемые изменения личности и объяснимую причину; ситуативный стиль не уничтожает core traits.
- Подключить память отношений и событий, не заменяя реальные воспоминания промптом.

**100% проверка**
- Longitudinal scenario suite: диалог после паузы, изменение предпочтений, конфликт/несогласие, исправление ошибки, обещание и его выполнение.
- Нет приписывания неизвестных фактов о пользователе, ложных воспоминаний, конфликтующих версий собственного состояния.
- Оценка слепыми рецензентами на устойчивость, различимость и уместную адаптацию поведения.

### A06 — Мотивация, автономия и инициатива

**Сделать**
- Общие drives/homeostasis: curiosity, competence, social connection, autonomy, continuity, energy/rest, uncertainty/stress.
- Цели порождаются из drive deltas, событий, незакрытых намерений и контекстных возможностей; priority arbitration и дедлайны.
- Background reflection/initiative loop с quiet-hours, rate limits, budget, snooze, cancel, pause/resume, resource guards.
- Хранить `time_since_last_interaction`, последнюю причину контакта, незавершённые темы и rationale.
- Инициатива должна быть полезной и объяснимой, а не бесконечным «пингом» пользователя.

**100% проверка**
- 24h/72h idle+active сценарии, минимум несколько устройств/состояний сети.
- На выбранном лимите инициативы (ориентир — не более 1/час, с настраиваемой политикой) нет дублей/спама; pause/cancel прекращает работу.
- Каждый спонтанный контакт имеет trace: внутреннее состояние → цель → оценка пользы/риска → разрешённое действие → объяснение причины.

### A07 — Эмоции и регуляция

**Сделать**
- Единственный appraisal source: valence/arousal/dominance/confidence + причины/события.
- Внутренняя эмоциональная динамика должна влиять на выбор цели, стиль ответа, голос и body intent, но не обходить EthicalGate.
- Добавить temporal smoothing, attack/release, hysteresis, baseline recovery и low-confidence policy.
- Renderer-neutral profile: brows/eyes/blink/cheeks/mouth tension/head tilt/posture/gesture/voice prosody.
- Не размножать независимые эмоции в Live2D/2.5D/3D; каждый renderer только маппит общие каналы на свои возможности.

**100% проверка**
- Длинные сценарии на устойчивость, отсутствие резких oscillations, overshoot и несогласованности голоса/лица/позы.
- Проверить низкую уверенность, смешанные эмоции, interrupt/resume и возврат к neutral.
- Исправить TS error в affective branch и пройти app typecheck + renderer contract tests на актуальном HEAD.

### A08 — Инструменты, внешние действия и безопасность

**Сделать**
- Один ActionGateway для всех мутаций: registry, input/output contracts, policy, approval, idempotency receipt, verifier, audit.
- Tool schemas валидируются до approval consumption и executor entry; output schemas валидируются после исполнения.
- Защитить prompt injection, untrusted tool output, path/command injection, secret exposure, SSRF и excessive permissions.
- У mutating provider timeout — ambiguous outcome, пока независимое подтверждение не докажет, что действия не было; не делать слепой retry.
- Деструктивные/финансовые/физические действия требуют явной проверки/подтверждения и safe rollback, где это возможно.
- Исправить bounded regex quantifier regression в ToolInputContract validator.

**100% проверка**
- Negative tests для malformed input/output, schema drift, replay, duplicate requests, timeout ambiguity, prompt injection и permission escalation.
- Независимое postcondition доказательство для внешних действий; simulator result маркируется simulated.
- Провести threat-model review и проверить fail-closed поведение.

### A09 — Голос и реальное время

**Сделать**
- Единый speech event ID/clock, audio stream lifecycle и viseme timeline; один источник времени для звука/рта.
- STT/VAD listen, interruption barge-in, cancellation, resume, output queue, partial transcripts и backpressure.
- TTS adapters: локальные/облачные providers, GPT-SoVITS/RVC where available, Edge-TTS fallback; чёткая деградация при offline/provider error.
- Emotional prosody на общих appraisal channels; отдельные профили регистров речи, но без искусственной подмены личности.
- Проверить русскую и английскую фонетику, UTF-16/grapheme anchors, viseme interpolation, stream discontinuity.

**100% проверка**
- Browser/Android real audio; измерить speech-to-mouth offset (целевой ориентир проекта ≤80 ms), interruption latency (≤200 ms), dropped audio and recovery.
- Физический Android/Termux test с моделью устройства, Android build, speaker/mic, permissions, thermal/load state.
- Провести длительное воспроизведение, resume after background, network loss/reconnect и device restart.

### A10 — Пространственное/телесное взаимодействие

**Сделать**
- Обобщить target observations: position/frame/revision/confidence/age/source/affordance.
- Планировать look/inspect/reach/touch/grasp/press через capability adapter; отдельно оценивать approach/contact/manipulate/verify.
- Для реальных действий — explicit safety authorization, target binding, TTL и независимый sensor/device postcondition.
- Нельзя считать ответ адаптера или симулятора независимым подтверждением реального контакта.
- Сначала simulation/replay; физические устройства подключать только с безопасной политикой и подтверждением пользователя.

**100% проверка**
- Stale/moved target, wrong frame, target substitution, missing sensor, unsafe label, expiry, retry, interrupted plan и false-positive postcondition scenarios.
- Без evidence outcome остаётся uncertain, не completed.
- Только потом live device/robot E2E и recovery.

### A11 — Аватар, тело и пользовательский интерфейс

**Сделать**
- Свернуть все режимы в общий BodyRendererRegistry и capability manifest.
- Сохранить текущие Live2D, Original2D и Legacy sprite as separate renderers; добавить полноценный 2.5D и 3D runtime только после реальных assets.
- Переключение тела сохраняет OrganismState, active speech, emotion, goal, gaze, selected action и текущую временную линию; renderer lifecycle не должен сбрасывать когнитивное состояние.
- Общие controls: outfit/prop, facial expression, pose/gaze, speaking/thinking, quality/performance profile, import/reset/fallback, accessibility/reduced motion.
- Визуальная обратная связь показывает настоящее состояние (speaking/listening/thinking/blocked/uncertain), а не рисует ложную активность.

**100% проверка**
- Таблица cross-renderer parity: одинаковый intent передан всем режимам; проверяются поддерживаемые/неподдерживаемые каналы.
- Переходы Live2D→2D SVG→2.5D→3D→Live2D без потери state, double audio, orphan RAF, stale messages и memory leaks.
- Desktop + mobile portrait/landscape + reduced motion + low-memory + WebGL/context-loss fallback.
- Скриншоты/видео и machine-readable E2E report привязаны к exact source SHA.

### A12 — Надёжность, сборка, безопасность, лицензии и Release

**Сделать**
- One-command clean install/configure/migrate/run/test/stop через документированный Compose/profile flow.
- Зафиксировать Node 24, app/runtime lockfiles, npm workflow flags, reproducible build, secret scanning, dependency/SBOM inventory и provenance.
- Exact-SHA test pyramid: unit/contract → runtime integration → app/runtime typecheck → production build → DB migrations → browser E2E → Android E2E → soak/recovery.
- Сделать backup/restore, crash during write, schema migration, duplicate event replay, data integrity и rollback drill.
- Закрыть каждый license/NOTICE/source archive/dependency review на конкретном hash и с реальным human decision; автоматический сканер только собирает evidence, он не утверждает право распространения.
- Сформировать Release ZIP из проверенного source SHA, сверить inventory, zip safety, no secrets/node_modules/cache, SBOM/provenance and SHA256; опубликовать GitHub Release asset и проверить его URL/size/digest после загрузки.

**100% проверка**
- Новый Release asset реально доступен в GitHub; его source SHA и checksum совпадают с отчётом.
- Чистая машина разворачивается по README и проходит критические use cases.
- 4–8 часов release soak на физическом Android и desktop/browser, restart/recovery, CPU/RAM/thermal/audio/render performance.
- Ни один license, browser/device, memory, soak или rollback gate не остаётся pending/unknown.
- Отчёт статусов не смешивает IMPLEMENTED, TESTED, INTEGRATED, MEASURED и RELEASED.

## 7. Этапы реализации — в правильном порядке

| Этап | Пакет работ | Зависимость | Выход |
|---:|---|---|---|
| 0 | Заморозить source baseline, карту веток и exact-SHA checks | Нет | Понятно, что canonical и что candidate |
| 1 | Исправить source/head CI failures и блокирующие ошибки branch candidates | 0 | Зелёные точные checks для переносимых изменений |
| 2 | Интегрировать 2D art contract, voice/prosody, user model и безопасные tool contracts | 1 | Общие интерфейсы, без новых владельцев состояния |
| 3 | Выборочно интегрировать learning/P23 и cognitive hardening | 2 | Целостная диагностика/обучение/approval/rollback |
| 4 | Закрыть memory holdout и world model grounding | 3 | Измеримое извлечение и calibrated beliefs |
| 5 | Закрыть initiative, personality continuity и emotion regulation | 4 | Устойчивое поведение в длинных сценариях |
| 6 | Собрать единый EmbodimentIntent/BodyRendererRegistry, закрыть 2D | 2, 5 | Два полноценных selectable 2D пути и корректный fallback |
| 7 | Создать реальные 2.5D art assets, rig, IK, garments и visual E2E | 6 | 2.5D capability реально доступна после validation |
| 8 | Закрыть 3D/VRM asset, retargeting, morphs, spring bones и E2E | 6 | 3D тело production-ready |
| 9 | Завершить embodied interaction с independent postconditions | 1, 5, 8 | Безопасная физическая/пространственная ветка либо честное ограничение |
| 10 | Свести все renderer, audio, memory и cognitive paths; perf/soak | 2–9 | Стабильная интегрированная система |
| 11 | Human license review, SBOM, provenance, clean build, Release ZIP | 10 | Реальная опубликованная и воспроизводимая версия |

Не начинать новый аспект, если его базовый owner/contract ещё нестабилен. Не объединять весь feature-branch history автоматически. Не расширять объём ради числа модулей; сначала добиваться реального результата на уже существующих owners.

## 8. Обязательные правила качества для каждого коммита

Каждая реализация проходит один и тот же цикл:

1. **Источник:** указать базовый source SHA и branch HEAD.
2. **Контракт:** описать owner, inputs/outputs, version, error/fallback semantics.
3. **Код:** изменить минимальное необходимое число существующих owners; не создать второй memory/goal/emotion/runtime authority.
4. **Регрессии:** положительные, отрицательные, corruption, restart, duplicate/out-of-order, boundary и cancellation cases по смыслу изменения.
5. **Интеграция:** проверить все вызывающие точки и обратную совместимость.
6. **Измерение:** latency, memory, error rate, quality uplift или другой показатель, который доказывает цель.
7. **Доказательство:** exact commit SHA, CI run URLs, logs, test counts, benchmark artifact.
8. **Поставка:** CHANGELOG, статус gate, обновление Release только после полного прохождения условий.

Статусы компонентов:
`PLANNED → IMPLEMENTED → TESTED → INTEGRATED → MEASURED → RELEASED`.

Нельзя:
- ставить PASS на основании наличия теста, если его не запускали;
- ссылаться на workflow старого SHA как доказательство нового;
- считать код в feature branch уже частью source;
- выдавать simulator outcome за реальное действие;
- активировать непроверенный skill;
- считать наличие 2.5D/3D пункта меню готовой моделью;
- публиковать ZIP без лицензий/проверки provenance;
- заменять независимые field/device measurements красивыми отчётами.

## 9. Критерий 100% и текущий остаток

Проект получает 100% **операционной готовности** только когда одновременно выполнено всё ниже:

- Все 12 аспектов достигли `MEASURED`; критические пользовательские сценарии проверены в target environments.
- Все candidate branches либо интегрированы выборочно, либо явно закрыты/отложены с обоснованием; нет скрытых зависимостей от feature-only кода.
- Память показывает независимый положительный recall uplift на holdout, с контролем ложных воспоминаний.
- Автономная инициатива и личностная непрерывность подтверждены длинными сценариями.
- Голос и аватар синхронизированы на реальном браузере и Android.
- Пользователь может переключать 2D/2.5D/3D, когда каждый renderer имеет валидный asset/capability; переключение не сбрасывает личность или ход диалога.
- Реальные внешние действия требуют authorization и независимых postconditions; неопределённость не превращается в ложный успех.
- Clean install, production build, database migration, backup/restore, soak, rollback и security gates завершены.
- Все human license/NOTICE/redistribution decisions завершены для точных hashes.
- Новый GitHub Release содержит ZIP, SBOM/provenance/report и SHA256, а проверка загруженного asset подтверждает source lineage.

**Текущая честная оценка:** когнитивная и прикладная основа проекта уже существенная, но продуктовая готовность ограничивается доказательствами работы на реальных устройствах, измерением памяти, незавершёнными branch integrations, настоящими 2.5D/VRM assets и правами на распространение. Рабочий фокус должен переместиться от добавления новых параллельных модулей к интеграции, устранению конкретных CI ошибок и проверке на реальном окружении.

