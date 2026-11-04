# NK1 — Мастер-план: тело (2D / 2.5D / 3D), моторика и полноценное взаимодействие с миром

**Дата:** 2026-11-03
**Рабочая исходная линия:** `workpass70-source` @ `608435493b4af3b4a222d385f1b77d978d18583b`
**Release-линия:** `main` @ `48dffbf4f5c9b5474c8baff61f40b8bf0c5828e8`
**Каноническая поставка:** GitHub Release ZIP (последний подтверждённый — WorkPass70 Hotfix 1, 2026-10-19)
**Область:** Аспект 11 (визуальное тело и переключение 2D/2.5D/3D) + Аспект 10 (пространственное/телесное взаимодействие) + моторика (A01/A07/A09 стыки)

> Этот документ — исполнительный план, а не отчёт о достижениях. Он не объявляет готовыми 2.5D/3D-тела, физическое взаимодействие или движение живого рига. Каждый пункт помечен уровнем доказанности из политики репозитория: `PLANNED`, `IMPLEMENTED`, `TESTED`, `INTEGRATED`, `MEASURED`, `RELEASED`, а для фактов — `PROVEN`, `OBSERVED`, `HYPOTHESIS`, `UNKNOWN`, `UNRESOLVED`, `FAILED`.

---

## 0. Как читать этот план

1. Разделы 1–3 фиксируют **цель и фактическую правду**. Разделы 4–6 — **архитектура и доноры**. Разделы 7–13 — **пошаговые этапы**, сгруппированные в независимо проверяемые переходы состояния.
2. Любое изменение проходит цикл: source SHA → контракт/владелец → минимальная правка → регрессия (падает до фикса, проходит после) → интеграция → измерение → evidence → CHANGELOG/handover.
3. **Один канонический владелец на способность.** Тело не владеет эмоциями, памятью или личностью; моторика не владеет целями; renderer не владеет когнитивным состоянием.
4. Никакой «fake success»: принятие команды адаптером ≠ выполнение движения. Для исполнения нужен receipt с измеренным результатом и независимой проверкой.
5. Не создавать placeholder-модули, вторые источники истины, фейковые метрики и неподключённые компоненты. Не заявлять сознание, автономию или «человеческую» моторику без внешнего доказательства.

---

## 1. Целевое состояние (Definition of Done для тела и взаимодействия)

Тело NK1 считается завершённым не тогда, когда есть пункт меню «3D», а когда подтверждено на конкретной сборке и устройстве:

1. **Единое семантическое тело.** `OrganismState + EmotionAppraisal + SpeechTimeline + ActionIntent` → один `EmbodimentIntent v1` → `MotorFrame` → renderer adapter. Ни один renderer не становится владельцем эмоций/памяти/личности.
2. **Несколько взаимозаменяемых тел.** Live2D, Original 2D, Legacy sprites, 2.5D depth-rig и VRM/3D работают через один версионированный `EmbodimentAdapter` lifecycle (`prepare → apply → verify → dispose`).
3. **Честные возможности.** Каждый режим публикует `RendererCapabilityManifest` из фактически найденных костей, morph targets, expressions, клипов, visemes, garment attach points. Неподдерживаемый канал явно помечается `unsupported`, а не имитируется.
4. **Непрерывность при переключении.** Переключение тела сохраняет эмоцию, речь (audio clock), взгляд, намерение, позу, гардероб и историю; устаревший handoff не перезаписывает более новый; при ошибке — rollback к прежнему телу.
5. **Полноценное тело с «любыми» движениями.** Полный humanoid-скелет: голова/шея/грудь/спина, руки (плечо→предплечье→кисть→пальцы), ноги (бедро→голень→стопа), таз; idle/дыхание/микродвижения; целенаправленные жесты; речь с co-speech жестикуляцией; переходы поз; безопасное прерывание и blend.
6. **Взаимодействие с миром.** Grounded-цели (позиция/фрейм/ревизия/уверенность/свежесть) → план look/inspect/reach/touch/grasp/release/press → независимый postcondition. Реальный контакт и манипуляция — только после hardware-backed проверки; иначе честный статус `simulated`/`uncertain`.
7. **Производительность и стабильность.** Desktop + mobile portrait/landscape, reduced motion, low-memory, WebGL context loss; frame budget, отсутствие утечек RAF/WebGL-контекстов/audio-сессий/IndexedDB-хендлов; soak ≥ 30–60 минут.
8. **Поставка.** Release ZIP собран из проверенного source SHA, с provenance/SBOM/checksum и закрытым human license review для всех art/model assets.

**Субъективное переживание и сознание — `UNKNOWN / UNRESOLVED`.** Тесты тела доказывают функцию и поведение, не переживание.

---

## 2. Фактическая исходная точка (что реально есть сейчас)

### 2.1 Что уже в source (`IMPLEMENTED`)

| Область | Факт | Уровень |
|---|---|---|
| Live2D | Cubism `Kurisu.moc3` (~6 MB), 4096×4096 текстура (~8.2 MB), mobile-профиль 2048×2048 (~1.6 MB), physics/CDI, 8 expressions, 5 клипов (`Idle`×1, `TapHead`×1, `TapBody`×1, `Special`×2) | `OBSERVED` (аудит 2026-10-29) |
| Live2D intent | `EmbodimentIntent v1`, viseme timeline, boundary-anchored clock, partial ACK (`complete:false`) | `IMPLEMENTED` |
| Original 2D | `KurisuOriginalStage.tsx` — SVG-концепт, 4 силуэта рук, 3 recolor-наряда, без слоёв/pivots | `IMPLEMENTED` |
| Legacy sprites | 32 PNG, детерминированный выбор, semantic remap после pixel-аудита | `IMPLEMENTED` |
| 2.5D foundation | `depthRig.ts`, `depthRigRendererAdapter.ts`, `embodimentIntentAdapter.ts`, `resolveDepthRigPoseFromMotorFrame` — контракт+transform bridge | `IMPLEMENTED` (не подключён к render-пути) |
| 3D | `Avatar3DStage.tsx` — Three.js процедурное тело + локальный импорт GLB/VRM, `@pixiv/three-vrm@3.5.5`, normalized humanoid drive, expressions, spring bones | `IMPLEMENTED` |
| 3D ассет | Закреплён hosted `NeuroKurisu_3D_v5.glb` (2 035 768 B, sha256 `4cc4c34a…`), опциональная загрузка пользователем в IndexedDB | `IMPLEMENTED` |
| Моторика | `MotorSchema`, `motorFrameMapper.ts`, `motorIntent.ts`, `planarArmIK.ts`, `vrmHumanoidRigAdapter.ts`, `vrmRigCalibrationProfile/Session` | `IMPLEMENTED` |
| Cross-renderer | `embodimentSwitch.ts`, `embodimentCoordinator.ts` (transactional lifecycle), `embodimentUiBridge.ts`, `AvatarStage` handoff | `IMPLEMENTED` (контракт/UI) |
| Взаимодействие | `EmbodiedInteractionController`, `GroundedInteractionBridge`, `ExternalPostconditionVerifier`, deny-by-default policy | `IMPLEMENTED` (планировщик) |
| Визуальное тело | Реальный browser/Android E2E не выполнен; 2.5D render не в UI; production VRM/2.5D art отсутствует | `UNRESOLVED` |

### 2.2 Оценка готовности (инженерная, не «процент файлов»)

| Режим тела | Оценка | Главный незакрытый критерий |
|---|---:|---|
| Live2D | 65–70% | Больше authored motions; browser/device E2E; стабильная синхронизация речи |
| Original 2D SVG | 60–65% | Production art master, expression atlas, независимые garments/props, mobile E2E |
| Legacy PNG | 60–65% | Это реакции, не анимируемое тело; семантика manifest |
| 2.5D depth rig | 20–25% | Нет layered PSD/Krita, hidden-area paint, calibrated pivots, authored GLB/IK, visual E2E |
| 3D / VRM | 25–30% | Нет подтверждённой production VRM-модели; retargeting/expressions/spring bones/calibration/E2E |
| Моторика (полное тело) | 15–20% | Нет full-body controller, walk/sit, co-speech gesture, live IK |
| Взаимодействие с миром | 25% | Нет живого camera pipeline, renderer/device adapter, независимого postcondition |

**Не усреднять эти числа.** Пользователь видит режим как доступный только при наличии реального renderer + валидного capability manifest.

### 2.3 Что мешает сегодня

1. Нет production art для 2.5D и нет лицензированной production VRM/GLB-модели Курису.
2. 2.5D depth-rig adapter не подключён к render-пути — в UI нет 2.5D-режима.
3. 3D-тело процедурное; загруженная VRM/GLB имеет ограниченный набор эвристик; IK не применяется к живым костям.
4. Моторика ограничена: головной наклон + несколько arm-офсетов; нет full-body skeleton controller.
5. Нет реального browser/Android E2E, soak и измерений latency/памяти/батареи.
6. Взаимодействие с миром: нет camera→hand actuation пути и hardware-backed postcondition.
7. License/human review art/model assets не закрыт → Release ZIP не обновляется.
8. Несколько крупных PR (695, 688, 641, 675, 654, 661) содержат альтернативные 3D/embodiment-реализации и документацию; их нельзя сливать пачкой.

---

## 3. Целевая архитектура тела и взаимодействия

### 3.1 Единый поток данных

```text
OrganismCore (single cognitive owner)
  OrganismState + EmotionAppraisal + SpeechTimeline + ActionIntent
                         |
                         v
              EmbodimentIntent v1   (semantic owner: app/src/components/avatar/embodimentTimeline.ts)
                         |
                         v
        Motor Intent / Motion Arbitration   (runtime: MotorSchema + motor controller)
                         |
                         v
                 MotorFrame v1  (measured joint state, tick/time, reached/blocked)
                         |
                         v
        BodyRendererRegistry  +  RendererCapabilityManifest
        /            |              |              \
     Live2D      Original 2D     Layered 2.5D     VRM / 3D
        \            |              |              /
         \------ EmbodimentAdapter lifecycle ------/
                prepare → apply → verify → dispose
                         |
                         v
        AdapterApplyReceipt + AdapterVerification (revision-bound)
                         |
                         v
              Renderer-local presentation (GPU frame)
```

### 3.2 Инварианты (не нарушать)

- **I1.** `OrganismCore/OrganismSnapshot` — единственный владелец когнитивного состояния. Body/motor/renderer владеют только производным display/execution state.
- **I2.** `EmbodimentIntent v1` — единственный версионированный semantic control message. Новый renderer не вводит второй intent-тип.
- **I3.** `MotorFrame` — единственный joint-space substrate. `targetAngleRad` — цель; в renderer идёт измеренный `angleRad`. Не создавать второй arbiter/controller.
- **I4.** Источник позы — измеренное состояние сустава, а не команда. Принятие команды ≠ исполнение.
- **I5.** Capability manifest отражает фактический риг, а не желаемые возможности. Неподдерживаемое явно деградирует.
- **I6.** Монотонные revision/tick/time; дубли и опоздавшие кадры отбрасываются; устаревший handoff не перезаписывает новый.
- **I7.** Локальные модели пользователя не уходят на сервер без явного согласия; импорт с проверкой размера/MIME/hash/schema/budget/license.
- **I8.** Внешние действия — только через `ActionGateway`; реальный контакт требует независимого postcondition; иначе `uncertain`.

### 3.3 Обязательные контракты (целевые)

- `EmbodimentIntent v1` — уже есть; расширить: full-body channels (spine, hips, legs), posture/lean, ground contact, locomotion intent, priority/cancellation.
- `RendererCapabilityManifest` — facial channels, expressions, visemes, motion groups, joints, IK, garments, props, camera freedom, physics, quality profiles, memory budget, renderer version, asset fingerprint.
- `BodySelection` — `live2d | original-2d | legacy | 2.5d | 3d`; selected body id, asset fingerprint, version, last validation, fallback state; хранится в безопасном preference store, **не** в личностной памяти.
- `BodyTransition` — load → validate → prepare → align neutral pose → transfer current intent → crossfade (150–350 ms) → dispose previous. Ошибка → сохранить прежнее тело и явно сообщить fallback.
- `AdapterApplyReceipt` / `AdapterVerification` — уже есть; verification обязан покрыть все заявленные каналы той же revision, наблюдение не раньше receipt.
- `InteractionPlan` / `InteractionSafetyAuthorization` / postcondition evidence — уже есть; привязка к plan/target/entity/frame, TTL, trusted verifier.

---

## 4. Доноры из открытых проектов (интеграция, а не вендоринг)

Правило: изучить upstream (код, лицензия, revision, ресурсные требования), применить механизм к каноническому владельцу, изолировать несовместимое, измерить benefit против same-budget baseline. Не создавать вторую копию владельца.

| Донор | Механизм | Лицензия | Куда в NK1 | Решение | Граница |
|---|---|---|---|---|---|
| [@pixiv/three-vrm 3.5.5](https://github.com/pixiv/three-vrm) | VRM loader, humanoid normalized bones, expressions, look-at, spring bones | MIT | 3D adapter (`vrmRuntimeAdapter.ts`) | **УЖЕ ИСПОЛЬЗУЕТСЯ**; расширять, не дублировать | Не второй avatar runtime |
| [three.js](https://github.com/mrdoob/three.js) | WebGL renderer, AnimationMixer, SkeletonUtils | MIT | 2.5D/3D renderer | Используется | Один renderer ownership |
| [GMR — General Motion Retargeting](https://github.com/YanjieZe/GMR) | Human→humanoid retargeting, IK на CPU (mink/mujoco), BVH/SMPL-X/LAFAN1 | MIT | Motion retarget pipeline (offline/предобработка) | **ADAPT** как offline retargeter для библиотеки клипов | Не переносить mujoco-решатель в браузер; только результирующие клипы |
| [VRM Animation (.vrma), VRMC_vrm_animation](https://vrm.dev/en/vrma) | Кросс-модельный humanoid-клип + expression animation | Открытая спец. VRM Consortium | Формат библиотеки движений | **ADOPT формат** для клипов | Нужен runtime-импорт VRMA в adapter |
| [MediaPipe Tasks (face/pose/hand)](https://ai.google.dev/edge/mediapipe/solutions/vision) | Landmarks → rig (лицо/поза/руки) | Apache-2.0 | Future camera-tracking input (A10) | **RESEARCH/ADAPT** для opt-in захвата | Отдельный входной адаптер, не владелец состояния |
| [Kalidokit](https://github.com/yeemachine/kalidokit) | Blendshape/kinematics solver для MediaPipe→VRM/Live2D | MIT (deprecated) | Reference для solver-логики | **REFERENCE ONLY** (официально deprecated, уходит в MediaPipe) | Не вендорить |
| [SentiAvatar](https://github.com/) (2026, open source) | Streaming co-speech motion (6 s за 0.3 s), infinite-turn | Проверить LICENSE upstream | Research-кандидат co-speech gesture | **RESEARCH-ONLY** до проверки лицензии/repro | Не в production без воспроизведения |
| [LiveGesture (CVPR 2026)](https://openaccess.thecvf.com/) | Streamable zero-look-ahead full-body gesture из речи | Paper; код/лицензия — проверить | Research-кандидат realtime gesture | **RESEARCH-ONLY** | Сначала offline-сравнение на своей библиотеке |
| [EMAGE (CVPR 2024)](https://pantomatrix.github.io/EMAGE) | Audio→holistic gesture (body+face+hands), SMPL-X/BEAT2 | Проверить license (dataset отдельно) | Research-кандидат | **RESEARCH-ONLY**; BEAT2 dataset license отдельно | Не обучать на неразрешённых данных |
| [Meta MHR](https://github.com/facebookresearch/MHR) | Параметрическое тело: decoupled skeleton/shape, pose correctives, face blendshapes | Apache-2.0 (проверить model weights) | Reference для rig/retarget, offline | **RESEARCH/ADAPT** offline | Не вендорить в runtime; проверить weight license |
| [SMPL-X](https://smpl-x.is.tue.mpg.de/) | Body+face+hands параметрическая модель | CC-BY-4.0 для SMPL-X **Body**; mesh/software — non-commercial | Reference topology для retarget | **REFERENCE ONLY** (commercial-ограничение) | Не шипить mesh без разрешения |
| [whisper.cpp](https://github.com/ggml-org/whisper.cpp) | Offline STT (Android/WASM) | MIT | STT backend за speech boundary (A09) | **ADAPT** как opt-in backend | Не второй transcript owner; не bundle weights |
| [Inspect AI](https://github.com/UKGovernmentBEIS/inspect_ai) | External evaluation harness | MIT | Independent evaluator | **ADAPT** (уже запланирован) | Не второй skill lifecycle |
| [3D Gaussian Splatting / Spark](https://github.com/sparkjsdev/spark) | Realtime splat render; `KHR_gaussian_splatting` в glTF | MIT/проверить | Future photoreal head/avatar | **RESEARCH-ONLY** | Отдельный renderer, не замена rig |
| [SPZ (Niantic)](https://github.com/nianticlabs/spz) | 90% сжатие splat | MIT | Future asset compression | **RESEARCH-ONLY** | Только при наличии 3DGS-кандидата |

Все донорские решения фиксировать в `docs/RESEARCH_INTAKE_LEDGER.md` с URL/revision/license/mechanism/benefit/downside/boundary/test/cost/result/decision.

---

## 5. Исследовательские входы (последние работы) и как их адаптировать

| Работа | Идея | Адаптация в NK1 | Статус |
|---|---|---|---|
| LiveGesture (CVPR 2026) | Полностью streamable, zero-look-ahead co-speech full-body gesture; SVQ tokenizer + hierarchical AR | Цель: realtime gesture без ожидания конца фразы. Сначала offline-сравнение с текущим clip-based подходом | `HYPOTHESIS` |
| CoordSpeaker (CVPR 2026) | Caption-empowered coordinated gesture; ритм+семантика | Использовать semantic cue из текста ответа для выбора жеста (уже частично есть в `motorIntent.ts`) | `HYPOTHESIS` |
| EMAGE / BEAT2 (CVPR 2024) | Audio→holistic (body+face+hands) | Reference для качества; проверить лицензию датасета | `RESEARCH-ONLY` |
| SentiAvatar (2026) | Streaming expressive 3D digital human, infinite-turn | Reference для streaming-архитектуры | `RESEARCH-ONLY` |
| GMR / Retargeting Matters (ICRA 2026) | Качество retargeting влияет на downstream | Offline retarget библиотеки клипов в VRMA для рига NK1 | `ADAPT` |
| MHR (2025) | Decoupled skeleton/shape, pose correctives, 60 Hz | Reference для rig/поза-коррекции | `RESEARCH-ONLY` |
| MediaPipe holistic tracking | Face/pose/hand landmarks | Opt-in camera-tracking для A10 | `ADAPT` |
| 3DGS head avatars (2025–2026) | Photoreal realtime head | Future fidelity-путь, отдельный renderer | `RESEARCH-ONLY` |
| Objective gesture evaluation (2026) | Метрики human-likeness | Метрики качества жестов в E2E | `ADAPT` (метрики) |

**Translation gate для каждой идеи:** какой конкретный провал канонического владельца она устраняет; что её фальсифицирует; baseline и same-budget кандидат; holdout; побочные эффекты (latency/RAM/VRAM/forgetting/privacy); что ведёт к rollback.

---

## 6. Порядок интеграции веток/PR (не сливать пачкой)

Протокол для каждого кандидата: зафиксировать head SHA и базу → сравнить с `workpass70-source` (ancestry/ahead-behind/diff) → найти PR и merge outcome → классифицировать (`CANONICAL/INTEGRATED/READY/NEEDS_REBASE/DRAFT/SUPERSEDED/EXPERIMENT/REVIEW_REQUIRED`) → перенести только нужные коммиты на свежую ветку → прогнать профильные тесты на точном SHA → PR/merge → не удалять ветки без доказательства.

Приоритетные кандидаты для тела/embodiment:

| PR | Содержание | Действие |
|---|---|---|
| #654 | Cross-fade cognitive 3D action clips | Проверить как источник `animation resolver`; не создавать второй mixer owner |
| #661 | Strict GLB gate для Kurisu v7 | Использовать как валидатор hosted-кандидата, не промоутить в catalog |
| #675 | Renderer-neutral brain→avatar affect bridge | Stacked; интегрировать только отсутствующие части, один emotion owner |
| #688 / #695 | 3D embodiment + ecosystem analysis | File-level review; альтернативные реализации — не whole-branch merge |
| #641 | Embodiment spec + ecosystem audit | Документация/спека — сверить с этим планом, не дублировать |
| #409/#408/#431 | 2.5D depth-rig | #409 в source как foundation; #408/#431 — единый canonical 2.5D |
| #410/#405 | Motor | #410 — единственный joint-space owner; #405 — только alias/mapping |

---

## 7. Этапы (пошагово, с воротами)

Порядок обязателен: не начинать этап, пока базовый owner/contract нестабилен.

### Этап 0 — Заморозка baseline и инвентаризация тела

**Цель:** понять, что canonical, что candidate, что уже интегрировано.

Шаги:
1. Зафиксировать source SHA и карту веток/PR по протоколу §6.
2. Сгенерировать манифест body-файлов: `app/src/components/avatar/**`, `app/src/components/Avatar*`, `runtime/neuro-kurisu/src/organism/body/**`, `runtime/neuro-kurisu/src/organism/system/MotorSchema.ts`, тесты и workflows.
3. Инвентаризация assets: Live2D (moc3/textures/physics/expressions/motions), sprites manifest, SVG, hosted GLB, `depthRig` контракты — с hash/size/license/provenance.
4. Зафиксировать capability-таблицу «что реально поддерживает каждый режим сегодня».

Ворота: точный SHA; манифест сгенерирован; ни один asset не помечен production без license record.

### Этап 1 — Единый body-контракт и консолидация владения

**Цель:** один owner на позу/intent/revision; никаких дублей.

Шаги:
1. Сопоставить `EmbodimentIntentV1`, `OrganismSnapshot`, `MotorFrame`, capability map.
2. Утвердить единственного владельца revision/intent ID и единый clock.
3. Добавить versioned `EmbodimentAdapter` lifecycle (`prepare/capture/apply/verify/dispose`) — базовый интерфейс уже есть в `embodimentCoordinator.ts`; довести до всех адаптеров.
4. Устранить конкурирующие источники позы (проверить `motorIntent.ts`, `motorFrameMapper.ts`, `embodimentIntentAdapter.ts` на пересечение).
5. Реализовать `BodyRendererRegistry` + `RendererCapabilityManifest` как целевой реестр (не считать готовым, пока адаптеры не зарегистрированы).

Ворота: unit-тесты ownership/revision/stale-отбрасывания; нет двух владельцев одной сущности; typecheck.

### Этап 2 — Завершение 2D-тела (Live2D + Original 2D + Legacy)

**Цель:** качественное полноценное 2D-представление как честный selectable режим.

Шаги:
- **2A. Live2D:**
  1. Расширить библиотеку осмысленных клипов: idle/listen/think/explain/comfort/surprised/concern/response (не «эмоция = один клип»).
  2. Связать клипы с `EmbodimentIntent` через capability-aware selection.
  3. Реализовать `beforeModelUpdate`-финализацию (уже есть) + измерить реальную задержку mouth/audio.
  4. Собрать browser E2E desktop/mobile.
- **2B. Original 2D art:**
  1. Создать editable master + turnaround (front/¾/профиль/back), expression atlas, руки/кисти, обувь, независимые garments/props, named layers/pivots.
  2. Использовать `asset-manifest.json`, `character-art-contract.json`, `layered-art-manifest.schema.json`, validator — только после проверки на текущем SHA.
  3. Связать с `EmbodimentIntent` (gaze/expression/pose).
- **2C. Legacy sprites:** сохранить как fallback, удерживать semantic manifest (уже remapped).

Ворота: узнаваемость при 128 px; neutral-лицо без drift; mobile E2E; latency mouth/audio измерена.

### Этап 3 — Производственное 2.5D-тело (layered puppet)

**Цель:** реальная многослойная управляемая кукла, а не SVG/PNG под вывеской 2.5D.

Шаги:
1. Editable layered master (PSD/Krita) с hidden-area paint за перекрытиями.
2. Разделение слоёв: hair (back/front/side), head/neck/face, eyes/iris/pupils/lids/brows/mouth/jaw/visemes, torso/body, coat/shirt/tie, upper/lower arms, hands/fingers, pelvis/legs/feet, outfit layers, props.
3. Для каждого слоя: stable id, parent, pivot, rest transform, z-depth, mask/occlusion group, bounds, material/texture, source hash.
4. Blender scene → GLB + `nk1DepthRigManifest`; проверить, что все manifest node IDs совпадают с реальными Three.js `Object3D` IDs.
5. Подключить `depthRigRendererAdapter` к render-пути (сейчас не подключён).
6. Двухкостный IK после калибровки фактических длин сегментов.
7. Secondary motion волос/ткани на fixed timestep, ограниченные spring/damping, reset при смене модели.
8. Калибровка face rig, eye gaze, visemes, garment attach points.
9. Пункт 2.5D в UI активен только при валидном depth manifest. Обычный GLB ≠ 2.5D.
10. Сравнить render quality/frame time/memory/battery с Live2D на одном устройстве.

Ворота: нет видимых дыр на целевых углах; IK drift < 1% на fixtures; secondary motion без unbounded oscillation; browser+Android visual E2E; license art закрыт.

### Этап 4 — Производственное 3D/VRM-тело

**Цель:** полноценное гуманоидное тело, а не процедурная mesh-сцена.

Шаги:
1. Выбрать production-quality VRM/glTF asset с подтверждённым правом использования; сохранить fingerprint + license record.
2. Валидация humanoid bones, rest pose, scale/axis, hierarchy, morph targets, expressions, visemes, textures/materials, animation clips.
3. Подключить настоящий VRM runtime (`@pixiv/three-vrm@3.5.5` уже есть): spring bones, look-at, humanoid retargeting, material semantics (MToon/fallback).
4. Связать motor intent с neck/head/spine/shoulder/elbow/wrist/hip/knee/ankle; IK/constraints ограничить возможностями модели.
5. Emotion blendshapes, blink, gaze, jaw/mouth/viseme, micro-expression, breath, secondary hair/cloth.
6. Сохранять импортированную анимацию, не затирать после AnimationMixer update; применять NK1 intent в согласованной final update phase.
7. Валидировать frame budget, disposal геометрий/материалов/текстур, context loss, mobile low-memory fallback.
8. Не встраивать фанатскую модель в Release без письменного/лицензионного подтверждения.

Ворота: capability map из фактического рига; нет drift IK; browser/Android E2E; переключение назад на 2D/2.5D без потери continuity; license закрыт.

### Этап 5 — Полноценная моторика «любые движения»

**Цель:** тело, которым мозг управляет через один joint-space substrate, а не 2–3 оффсета.

Шаги:
1. Расширить `MotorFrame`: full-body joints (spine/chest/hips, обе руки, обе ноги), posture/lean, ground contact, locomotion intent.
2. Реализовать motion arbitration: idle/breath + gesture blend поверх idle, безопасное прерывание, blend weights.
3. Библиотека движений: idle, listen, think, explain, comfort, surprised, concern, respond, walk, turn, sit, stand, reach, point, wave, hold.
4. Co-speech жестикуляция: сначала deterministic clip+blend, затем (research gate) streaming gesture-модель.
5. Retarget pipeline: offline GMR/BVH/SMPL-X → VRMA-клипы для рига NK1 (с license-проверкой данных).
6. Двухкостный/полный IK для рук и ног с joint limits и collision-aware траекториями.
7. Deterministic fixed timestep, no NaN, no drift; reduced-motion aware.

Ворота: одинаковый intent даёт семантически эквивалентный результат в 2D/2.5D/3D в пределах возможностей; нет segment stretch > 1%; прерывание безопасно; soak без накопления ошибок.

### Этап 6 — Взаимодействие с миром (embodiment)

**Цель:** grounded-взаимодействие с честным postcondition.

Шаги:
1. Подключить реальные camera/object detections к `InteractionTarget` с calibrated 3D-координатами и uncertainty (сейчас — только planner).
2. Renderer adapters для gaze/pointing (Live2D), depth-rig, VRM humanoid IK.
3. Collision-aware hand trajectories + contact sensors/visual postconditions.
4. Persistent interaction episodes + causal learning из verified outcomes.
5. Explicit safety authorization, target binding, TTL, trusted verifier — для reach/touch/grasp/release/press.
6. Симулятор — только `simulated`; не доказательство реального контакта.
7. Desktop + Android валидация; физическая манипуляция — только после hardware-backed тестов.

Ворота: stale/moved target, wrong frame, substitution, missing sensor, unsafe label, expiry, retry, interrupted plan, false-positive postcondition — все отрицательные сценарии fail-closed; без evidence → `uncertain`.

### Этап 7 — Транзакционное переключение тел и верификация

**Цель:** непрерывность и честные receipts.

Шаги:
1. Состояния: `stable → preparing → ready → crossfading → committed`; ошибка → `rollback`.
2. Не размонтировать источник до успешного `prepare` цели.
3. Сохранять speech event/audio clock, expression, gaze target, motor intent, wardrobe ID, pose channels.
4. Monotonic revision; отмена устаревшего handoff.
5. Capability degradation: пальцы/ноги/контакты могут отсутствовать в 2D.
6. Crossfade 150–350 ms; удерживать последнюю подтверждённую позу, не прыгать в rest.
7. `AdapterApplyReceipt` + независимая `AdapterVerification` (revision-bound, покрывает заявленные каналы).
8. Live2D ACK остаётся диагностическим (`complete:false`), не становится receipt.

Ворота: round-trip Live2D↔2D↔2.5D↔3D с одним snapshot; rollback при загрузочной ошибке и WebGL loss; метрики handoff latency/dropped frames/pose discontinuity/clock drift/rollback rate.

### Этап 8 — Реальная проверка на устройствах, производительность, soak

Шаги:
1. Desktop + mobile portrait/landscape + reduced motion + low-memory + WebGL context-loss fallback.
2. Скриншоты/видео + machine-readable E2E report, привязанные к exact source SHA.
3. Метрики: handoff latency, frame time, CPU/RAM/VRAM, battery/thermal, audio latency, pose discontinuity.
4. Soak ≥ 30–60 минут циклических переключений и речи: без утечек RAF, WebGL contexts, audio sessions, IndexedDB handles.
5. Android device E2E (Termux/browser), permissions, restart/recovery.

Ворота: ни один из перечисленных gate не остаётся pending/unknown; evidence привязан к SHA.

### Этап 9 — Поставка на GitHub (CI, release, license)

Шаги:
1. Профильные CI workflows: `nk1-embodiment-switch`, VRM/depth-rig/motor/adapter suites, aspect10 interaction; плюс cross-cutting gates.
2. Exact-SHA test pyramid: unit/contract → runtime integration → app typecheck → production build → browser E2E → device E2E → soak.
3. Human license/NOTICE review для art/model/dependency/archive на точных hash.
4. Release ZIP из проверенного source SHA: inventory, zip safety, no secrets/node_modules/cache, SBOM/provenance/SHA256.
5. Проверить загруженный asset: URL/size/digest/source lineage.
6. Обновить CHANGELOG, handover, `Список дел.md`, статус-страницы. Различать `IMPLEMENTED/TESTED/INTEGRATED/MEASURED/RELEASED`.

Ворота: новый Release asset доступен; checksum совпадает; чистая машина разворачивается по README; ни один gate не pending.

---

## 8. Результаты на GitHub (deliverables и evidence)

| Артефакт | Что доказывает | Как проверяется |
|---|---|---|
| `BodyRendererRegistry` + capability manifests | Единый реестр тел | unit/contract tests; typecheck |
| `EmbodimentAdapter` реализации (live2d/original/2.5d/vrm) | Единый lifecycle | focused CI + integration |
| 2.5D layered asset + GLB + manifest | Реальное 2.5D-тело | GLB validator; browser visual E2E |
| Production VRM/GLB + license record | Реальное 3D-тело | preflight/fingerprint; device E2E |
| Motion library (VRMA/clips) + retarget pipeline | Полноценная моторика | motion tests; gesture metrics |
| Camera→hand adapter + postcondition verifier | Взаимодействие с миром | negative scenarios; hardware E2E |
| Machine-readable E2E report | Реальная проверка | привязан к SHA; скриншоты/видео |
| Release ZIP + SBOM + provenance | Воспроизводимая поставка | checksum; license gate |

Каждый PR: описать owner/contract/inputs-outputs/version/error-fallback; регрессии (positive/negative/corruption/restart/duplicate/out-of-order/boundary/cancellation); evidence (SHA, CI runs, logs, counts, artifact).

---

## 9. Метрики и критерии приёмки

| Метрика | Ориентир | Тип |
|---|---|---|
| Speech→mouth offset | ≤ 80 ms | target (измерять) |
| Interruption latency | ≤ 200 ms | target |
| Crossfade handoff | 150–350 ms | range |
| Tick p95 (Android) | ≤ 50 ms | ориентир проекта |
| IK segment drift | < 1% | gate |
| Memory retrieval p50 | ≤ 30 ms на 10k | ориентир |
| Frame budget | стабильно на целевой модели | gate |
| Rollback rate | 0 при штатной работе | gate |
| Unsupported-channel rate | явный, не скрытый | honesty gate |

Не заявлять достижение ориентира без benchmark evidence на exact SHA.

---

## 10. Риск-регистр

| Риск | Вероятность | Влияние | Митигация |
|---|---|---|---|
| Нет лицензированной production VRM/2.5D art | Высокая | Блокер 3D/2.5D | Приоритет: legal asset или собственный rig; fallback честно в UI |
| Art/model license не закрыт | Высокая | Блокер Release | Human review на точных hash; не публиковать ZIP |
| 2.5D adapter не подключён | Уже есть | 2.5D недоступен | Этап 3 шаг 5 |
| Второй owner позы/motion | Средняя | Расхождение состояния | I1–I4; code review; ownership tests |
| Fake success (ACK = движение) | Средняя | Ложные выводы | I4, I8; receipts/verification |
| Нет device E2E/soak | Высокая | Не доказана готовность | Этап 8 |
| Распухание PR-очереди | Высокая | Запутанность | Протокол §6; не сливать пачкой |
| Дрейф моторики на длинных сессиях | Средняя | Визуальные артефакты | fixed timestep; bind-pose snapshots; soak |

---

## 11. Правила качества для каждого коммита

1. **Источник:** указать базовый source SHA и branch HEAD.
2. **Контракт:** owner, inputs/outputs, version, error/fallback semantics.
3. **Код:** минимальная правка существующих owners; не создавать второй memory/goal/emotion/runtime/motor owner.
4. **Регрессии:** positive, negative, corruption, restart, duplicate/out-of-order, boundary, cancellation.
5. **Интеграция:** проверить все вызывающие точки и обратную совместимость.
6. **Измерение:** latency/memory/error rate/quality uplift, доказывающий цель.
7. **Доказательство:** exact SHA, CI run URLs, logs, test counts, benchmark artifact.
8. **Поставка:** CHANGELOG, статус gate, обновление Release только после полного прохождения.

Статусы: `PLANNED → IMPLEMENTED → TESTED → INTEGRATED → MEASURED → RELEASED`.

**Нельзя:** ставить PASS без запуска теста; ссылаться на workflow старого SHA; считать feature-branch код частью source; выдавать simulator outcome за реальное действие; активировать непроверенный skill; считать наличие пункта меню 2.5D/3D готовой моделью; публиковать ZIP без лицензий/provenance; заменять независимые device-измерения красивыми отчётами.

---

## 12. Ближайшие 12 задач (порядок важен)

1. Заморозить source SHA `6084354…`, сгенерировать body-манифест и карту PR (§6).
2. Зафиксировать единого owner intent/revision/motor (Этап 1) и убрать дубли позы.
3. Добавить `RendererCapabilityManifest` для 4 существующих режимов из фактических данных.
4. Подключить `depthRigRendererAdapter` к render-пути за feature-gate (только при валидном manifest).
5. Расширить Live2D motion library и связать с intent; измерить mouth/audio latency.
6. Создать `BodyRendererRegistry` + `EmbodimentAdapter` интерфейс для всех режимов.
7. Реализовать 2D↔3D round-trip с receipts и rollback (Этап 7).
8. Расширить `MotorFrame` до full-body joints + posture (Этап 5 шаг 1).
9. Реализовать motion arbitration + библиотеку клипов (idle/walk/sit/reach).
10. Подключить camera→target bridge и независимый postcondition (Этап 6).
11. Собрать browser E2E report (desktop+mobile) на exact SHA.
12. Обновить CHANGELOG/handover/`Список дел.md` и зафиксировать, что осталось `UNRESOLVED`.

---

## 13. Критерий 100% для тела и взаимодействия

Одновременно выполнено:

- Все 5 режимов тела реализуют один версионированный adapter contract; ни один не владеет отдельной копией личности/эмоций/речи.
- Switch snapshot не теряет revision, speech event, intent, emotion, gaze, wardrobe; устаревший handoff не перезаписывает новый; rollback работает.
- Capability manifest отражает фактический риг; поддержанные каналы достигают точности, неподдержанные явно отчитываются.
- Полное тело: голова/шея/спина/руки/кисти/пальцы/ноги/таз; idle/жесты/co-speech/переходы; безопасное прерывание.
- 2D/2.5D/3D round-trip проходит browser E2E и Android E2E; soak без утечек.
- Реальное взаимодействие требует authorization + независимого postcondition; неопределённость не превращается в ложный успех.
- Все art/model/dependency licenses закрыты human review на точных hash.
- Release ZIP собран из проверенного source SHA, проверен по checksum и source lineage.

**Честная оценка на 2026-11-03:** архитектурный фундамент тела (контракты, intent, motor mapper, cross-renderer coordinator, interaction planner) уже существенный, но продуктовая готовность ограничена отсутствием production art/VRM-модели, неподключённым 2.5D-рендером, неполной моторикой, отсутствием device E2E/soak и незакрытыми лицензиями. Рабочий фокус — интеграция, конкретные фиксы и проверка на реальном устройстве, а не новые параллельные модули.

---

## 14. Прогресс WorkPass71 (2026-11-03) — что реально изменилось

База: `workpass70-source` @ `608435493b4af3b4a222d385f1b77d978d18583b`. Все утверждения ниже — по факту прогонов в этом проходе.

### 14.1 Добавлено (IMPLEMENTED + FUNCTIONAL INDICATOR)

| Артефакт | Что делает | Файл | Тест |
|---|---|---|---|
| Capability manifest + registry | Единый версионированный источник правды о каналах/выражениях/физике каждого рендера; регистрация fail-closed | `app/src/components/avatar/rendererCapabilityManifest.ts` | `app/scripts/body-systems.test.mjs` |
| Канонические манифесты 4 режимов | Опиcывают фактическую поддержку; switch-таблица выводится из них, дрейф каналов невозможен | `app/src/components/avatar/rendererRegistryDefaults.ts` | то же |
| Motion library | 16 именованных программ (idle/listen/think/explain/comfort/walk/turn/sit/stand/reach/point/wave/hold и др.), валидация seam для loop, интерполяция | `app/src/components/avatar/motionLibrary.ts` | то же |
| Motion arbitration | intent→primary, bounded cross-fade, additive idle-breath overlay, энергия масштабирует амплитуду, лимит слоёв | `app/src/components/avatar/motionArbitration.ts` | то же |
| Интеграция в UI-мост | `projectSemanticBodyState` принимает arbiter-каналы, ограничивает их и не даёт переопределить производные каналы | `embodimentUiBridge.ts` | `embodiment-ui-bridge.test.mjs` |
| Интеграция в stage | `AvatarStage` держит arbiter в refs, питает им handoff-снимок, не ломает существующий rAF | `AvatarStage.tsx` | typecheck + build |

### 14.2 Прогоны (OBSERVED)

- `npm run typecheck` (app + runtime) — PASS.
- `npm run build` (app) — PASS.
- `npm --prefix app run test:scripts` — 447/447 PASS.
- `test:body-systems` — 17/17 PASS.
- `test:embodiment-ui-bridge`, `test:depth-rig`, `test:aspect10:interaction` — PASS.
- `audit:integrity` runtime — PASS, files=4383.
- Новый агрегат: `npm run test:workpass71`.

### 14.3 Уточнённая оценка готовности (после WorkPass71)

| Аспект | Было | Стало | Что изменилось / что ещё нужно |
|---|---:|---:|---|
| Моторика (полное тело) | 15–20% | 30% | Появились библиотека движений и арбитр с безопасным прерыванием; **ещё не подключены к 2D/3D рендерам**, нет live-IK, нет device E2E |
| Capability/контракт тела | — | 80% | Manifest+registry сделаны и проверены; осталось вывести каналы манифеста из реального рига на лету |
| 2.5D depth rig | 20–25% | 20–25% | Без изменений: нет production layered art и render-пути |
| 3D / VRM | 25–30% | 25–30% | Без изменений: нет production VRM-модели |
| Live2D / Original 2D / Legacy | 60–70% | 60–70% | Без изменений: нужен authored motion и device E2E |
| Взаимодействие с миром | 25% | 25% | Без изменений: нет camera→actuation и hardware postcondition |

### 14.4 Честная граница (UNRESOLVED / не заявлять)

- Арбитр движений **не** доказывает визуальное качество: он выдаёт целевые каналы, а не подтверждённую позу рендера.
- Новые тесты — поведенческие и синтетические; они **не** являются device E2E, soak или измерением latency/памяти/батареи.
- Ни один донорский код/веса/датасет не подключён; intake-запись в `RESEARCH_INTAKE_LEDGER.md` — очередь кандидатов, а не интеграция и не license approval.
- Оценки процентов — инженерные прокси, не доказательство пользовательской ценности.

### 14.5 Следующие задачи (порядок)

1. Проход B: подключить 2.5D depth-rig adapter к render-пути за feature-gate + readback.
2. Подключить arbiter-каналы к реальным 2D/3D рендерам (сейчас только handoff-снимок).
3. Проход C+: live-IK для рук/ног в 3D adapter.
4. Проход E: первый изолированный адаптер из доноров (VRMA-импорт клипов).
5. Проход F: обновить handover, зафиксировать SHA и evidence-метки.

---

## 15. Обновление прогресса после подключения 2D/3D (2026-11-03, PR #697)

Все три коммита находятся в ветке `workpass71-body-systems` и открыты как [PR #697](https://github.com/ailtron1ss-rgb/NK1/pull/697) (base `workpass70-source`, head `0649eb7`).

| Аспект | §14 | §15 | Причина изменения |
|---|---:|---:|---|
| Моторика (полное тело) | 30% | 45% | Арбитр-каналы теперь реально подключены к 3D (spine/elbow/hip/knee через normalized humanoid proxy) и к Original 2D (yaw/pitch→перенос, roll→поворот, breath→масштаб). Ещё нет live-IK, walk/sit фаз, device E2E |
| Capability/контракт тела | 80% | 85% | Единая таблица выводится из реестра; осталось выводить каналы манифеста из фактического рига на лету |
| 3D / VRM | 25–30% | 32% | Нижние конечности и спина получили канал; нет production VRM-модели и визуальной проверки |
| Live2D / Original 2D | 60–70% | 68% | Original 2D реагирует на общий motion-канал; Live2D без изменений (нужен authored motion) |
| 2.5D depth rig | 20–25% | 20–25% | Без изменений: render-путь всё ещё не подключён |
| Взаимодействие с миром | 25% | 25% | Без изменений |

**Ограничение:** это инженерные прокси на синтетических поведенческих тестах. Ни одна строка выше не является device E2E, soak или измерением производительности, и ни один донорский код/вес/датасет не подключён.

### Следующий проход (по приоритету)

1. 2.5D depth-rig adapter → render-путь за feature-gate + readback (это единственный режим тела без рендера).
2. Визуальная проверка (Playwright-скриншот) для 2D/3D с ненулевыми arbiter-каналами.
3. Live-IK рук/ног в 3D adapter; walk/sit фазы в motion library.
4. Первый изолированный донорский адаптер (импорт `.vrma` клипов).

---

## 16. Прогресс-проход (2026-11-03, ветка `workpass71-body-systems`, head `516ce72`)

Этот проход — исправление **дефекта честности контракта**, а не косметика. Манифест заявлен как
«единственное машинночитаемое описание того, что рендер реально применяет сегодня», и switch-контракт
именно из него выводит деградацию неподдерживаемых каналов. Три манифеста занижали возможности
рендеров, поэтому реальные каналы помечались как неподдерживаемые.

### 16.1 Что исправлено (`IMPLEMENTED`, доказано регрессией)

| Рендер | Было заявлено | Фактически применяет | Источник факта |
|---|---|---|---|
| Original 2D (`nk1-original-svg-2d`) | `gazeX`, `gazeY` | + `torsoYaw`, `torsoPitch`, `headYaw`, `headPitch`, `headRoll`, `breath` | `originalStageChannelOffsets()` |
| Three.js VRM (`nk1-three-vrm3d`) | `gazeX`, `gazeY` | + `torsoPitch`, `leftElbow`, `rightElbow`, `leftHip`, `rightHip`, `leftKnee`, `rightKnee` | `applyVrmFullBodyChannels()` |
| Live2D (`nk1-live2d-cubism`) | `headRoll`, `gazeX`, `gazeY`, `breath` | `headRoll`, `gazeX`, `gazeY` (у viewer нет параметра breath) | `viewer.html` (нет `ParamBreath`) |

Также синхронизированы `joints` и `notes` 3D-манифеста (spine/elbows/hips/knees добавлены, wrists/hands/ankles
явно помечены как неподключённые).

### 16.2 Регрессии (fail-before / pass-after — `PROVEN`)

Три новых теста в `app/scripts/body-systems.test.mjs` выводят ожидаемый набор каналов **из самих адаптеров**,
а не из манифеста, поэтому дрейф в любую сторону снова уронит сборку:

- `declared Original 2D channels match the flat-SVG channel mapper`
- `declared VRM 3D channels match the full-body bone applier`
- `declared Live2D channels match what the viewer can actually drive`

Проверено: на старых манифестах все три падают (`3 fail`), на исправленных — `25/25 pass`.
`embodiment-ui-bridge.test.mjs` обновлён: его прежний allow-list (`headRoll/gazeX/gazeY/breath`) сам
был устаревшим допущением; теперь он выводится из того же источника и дополнительно запрещает
скелетные каналы у плоских 2D-рендеров.

### 16.2a Дополнительные дефекты, исправленные в том же проходе

| Дефект | Причина | Исправление | Регрессия |
|---|---|---|---|
| `curiosity` не даёт мимики в 3D | `EMOTION_PRESETS` покрывал 7 из 8 меток | добавлен preset `curiosity → surprised` (2D рисует «thinking») | `every NK1 emotion label maps to a VRM expression preset` (fail-before: `curiosity must set…`) |
| Дублирование словаря выражений | `EXPR` в `AvatarStage.tsx` копировал `EXPRESSION_TEXT` из моста; viewer отвергает весь intent-фрейм при неизвестном имени | экспортирован `EXPRESSION_TEXT`, stage использует его | guard в `test-live2d-expression-cache.mjs` (проверка, что каждое отправляемое имя есть в `EXPR_MAP`) |

### 16.3 Прогоны (OBSERVED, exact-head `4f71e42`)

- `npm --prefix app run test:body-systems` — 25/25 PASS.
- `npm --prefix app run test:scripts` — 456/456 PASS.
- `npm --prefix app run typecheck` — PASS (`tsc --noEmit`).
- `npm --prefix app run build:dev` — PASS (nitro output сгенерирован).
- `npm run test:workpass71` (агрегат тела) — все под-наборы PASS.
- GitHub Actions — 16/16 `success` на `516ce72`; повторная проверка на `4f71e42` (в т.ч.
  `normalized-vrm`, `validate-original-2d-contract`, `deterministic-interaction-contract`).

### 16.4 Уточнённая оценка готовности (после §16)

| Аспект | §15 | §16 | Причина |
|---|---:|---:|---|
| Capability/контракт тела | 85% | 88% | Каналы манифеста теперь сверены с адаптерами и защищены регрессией; осталось выводить их из рига на лету |
| Моторика (полное тело) | 45% | 45% | Без изменений: каналы идут в рендер, но нет live-IK и device E2E |
| 3D / VRM | 32% | 33% | Манифест больше не занижает 3D; production VRM-модели и визуальной проверки по-прежнему нет |
| Live2D / Original 2D | 68% | 69% | Контракт стал честнее; authored motion и device E2E всё ещё нужны |
| 2.5D depth rig | 20–25% | 20–25% | Без изменений: render-путь не подключён |
| Взаимодействие с миром | 25% | 25% | Без изменений |

### 16.5 Честная граница (`UNRESOLVED`)

- Исправление контракта **не** меняет визуальное качество и **не** является device E2E.
- Проценты — инженерные прокси, не доказательство пользовательской ценности.
- Live2D `expressions` по-прежнему заявляет 8 каналов; viewer понимает их через `EXPR_MAP`
  (`happy/sad/angry/surprised/flustered/embarrassed/thinking/...`), но stage шлёт другой словарь
  (`thinking/happy/sad/angry/focused/neutral`). Оба словаря совместимы по значениям, однако
  **автоматической сверки словарей пока нет** — вынести в отдельную задачу (§17, проход 1.3).

---

## 17. Расширенный многоэтапный план: тела (2D / 2.5D / 3D), моторика, взаимодействие с миром

Раздел уточняет §7 конкретными шагами, артефактами, воротами и evidence-метками для аспектов
**2 (2D-тело), 2.5 (2.5D-тело), 3 (3D-тело)** и сквозных направлений **моторика** и **взаимодействие с миром**.
Каждый шаг формулируется как независимо проверяемый переход состояния. Метки: `IMPLEMENTED`,
`FUNCTIONAL INDICATOR`, `OBSERVED`, `PROVEN`, `HYPOTHESIS`, `UNRESOLVED`.

### Проход 1 — Заморозка и честность контракта (текущий + ближайший)

| # | Задача | Артефакт / владелец | Ворота приёмки | Статус |
|---|---|---|---|---|
| 1.1 | Заморозить source SHA, собрать body-manifest и PR-map | `docs/…MASTER_PLAN…` §16 | SHA записан, ветки/PR классифицированы | `IMPLEMENTED` |
| 1.2 | Сверить каналы манифеста с адаптерами (2D/3D/Live2D) | `rendererRegistryDefaults.ts` + `body-systems.test.mjs` | fail-before/pass-after регрессия | `PROVEN` (§16) |
| 1.3 | Сверить словарь выражений Live2D (`EXPR` stage ↔ `EXPR_MAP` viewer) | `AvatarStage.tsx`, `viewer.html` | тест, что каждое отправляемое значение есть в `EXPR_MAP` | `PROVEN` (§16.2a) |
| 1.4 | Выводить каналы манифеста из фактического рига на лету (readback), а не хардкодить | `rendererCapabilityManifest.ts` | рантайм-сверка, расхождение → предупреждение/ошибка | TODO |

### Проход 2 — Производственное 2.5D-тело (layered puppet) — единственный режим без рендера

| # | Задача | Артефакт | Ворота | Риск |
|---|---|---|---|---|
| 2.1 | Завести `depth2d`-манифест и режим в UI (5-я кнопка) за feature-gate | `rendererRegistryDefaults.ts`, `AvatarStage.tsx` | режим появляется только при валидном риге | UI-регрессия |
| 2.2 | Production layered-art: слои (волосы/лицо/тело/руки) с pivot-offset, лицензия подтверждена | `app/public/depth-rig/…` + `site.json`-провенанс | asset-hash + license в манифесте | **нет арта** (блокер) |
| 2.3 | Подключить `applyDepthRigWorldPoseToLayers` к render-пути (сейчас не вызывается) | `depthRigRendererAdapter.ts` → stage | поза пишется в матрицы слоёв, readback `renderedNodeIds` | двойной scene graph |
| 2.4 | Связать `resolveDepthRigPoseFromEmbodimentIntent` с arbiter-каналами | `embodimentIntentAdapter.ts` | те же каналы, что у 2D/3D | рассинхрон словаря |
| 2.5 | Жёсткая граница: без подтверждённого арта режим остаётся `productionReady:false` | manifest | `selectable()` не отдаёт плейсхолдер | — |

**Правило:** пока нет реального layered-арта с проверенной лицензией, режим не публикуется как
production-ready. Рисовать плейсхолдер и заявлять готовность запрещено (см. §1, §11).

### Проход 3 — Производственное 3D/VRM-тело

| # | Задача | Артефакт | Ворота |
|---|---|---|---|
| 3.1 | Подключить проверенный VRM (hosted или bundled) с license/credit в манифесте | `avatarModelCatalog.ts` | модель проходит strict GLB gate (#661) |
| 3.2 | Live-IK рук: цель → CCD/FABRIK в плоскости, поверх клипа | `planarArmIK.ts` (есть) + adapter | тест IK на достижимость/пределы |
| 3.3 | Live-IK ног + фазы walk/sit/stand | `motionLibrary.ts` + adapter | клипы не конфликтуют с arbiter |
| 3.4 | Губные морфы и visemes связать с audio clock (latency-бюджет) | `glbMouthMorphAdapter.ts` | измеренная задержка ≤ бюджета (`OBSERVED`) |
| 3.5 | Spring bones / физика волос и одежды | three-vrm spring bones | канал `supportsPhysics` подтверждён визуально |

### Проход 4 — Полноценная моторика («любые движения»)

| # | Задача | Артефакт | Ворота |
|---|---|---|---|
| 4.1 | Расширить motion library фазами (reach/point/wave/hold/step) | `motionLibrary.ts` | валидация seam, loop-safe |
| 4.2 | Offline-retarget донорских клипов (GMR / `.vrma`) в риг NK1 | pipeline вне runtime | клип воспроизводится, лицензия записана |
| 4.3 | Live-IK поверх клиповой анимации без рывков | adapter | cross-fade + приоритеты каналов |
| 4.4 | Приоритеты: производные каналы не переопределяются arbiter-ом | `embodimentUiBridge.ts` | регрессия уже есть; расширить |

### Проход 5 — Взаимодействие с миром (embodiment)

| # | Задача | Артефакт | Ворота |
|---|---|---|---|
| 5.1 | Взгляд/поворот к мировым целям (world targets) | `supportsWorldTargets` путь | цель приходит из canonical owner |
| 5.2 | Опциональный захват камеры (MediaPipe face/pose/hand) | отдельный входной адаптер | opt-in, приватность: локально, без утечек |
| 5.3 | Реакция на реальные события среды (не только чат) | через существующий action gateway | postcondition-верификация |
| 5.4 | Верификация действий: `OutcomeVerificationService` как единственный источник правды | governance | regression на spoofed ACK (есть) |

### Проход 6 — Транзакционное переключение тел и визуальная верификация

| # | Задача | Артефакт | Ворота |
|---|---|---|---|
| 6.1 | Cross-fade при смене рендера без потери состояния | `embodimentSwitch.ts` | handoff сохраняет pose/gaze/speech |
| 6.2 | Playwright-скриншоты 2D/3D/2.5D с ненулевыми arbiter-каналами | `app/screenshots/` | визуально видна реакция, консоль чистая |
| 6.3 | Откат к предыдущему телу при сбое инициализации | switch contract | fail-closed, без белого экрана |

### Проход 7 — Реальная проверка на устройствах, производительность, soak

| # | Задача | Ворота |
|---|---|---|
| 7.1 | Измерить latency (STT→LLM→TTS→viseme) на целевом устройстве | `OBSERVED`, бюджет зафиксирован |
| 7.2 | FPS/память/батарея при долгом прогоне | soak ≥ N часов |
| 7.3 | Проверка на мобильном viewport и слабом GPU | деградация с честным сообщением |

### Проход 8 — Поставка на GitHub (deliverables и evidence)

| # | Задача | Артефакт |
|---|---|---|
| 8.1 | Каждый проход = отдельный PR на свежую ветку от `workpass70-source` | PR с exact-SHA |
| 8.2 | Exact-head CI зелёный на каждом PR | ссылки на runs |
| 8.3 | Обновлять handover/changelog и `RESEARCH_INTAKE_LEDGER.md` | запись донора/результата/решения |
| 8.4 | Не сливать пачкой; не удалять ветки без доказательства | протокол §6 |

**Сквозные инварианты (не нарушать):** один владелец на capability; каналы не переопределяют
производные; неподдерживаемое репортится, а не выдумывается; никаких плейсхолдеров вместо арта;
никаких заявлений о device-производительности/recall/autonomy без независимого доказательства.

---

## 18. Прогресс-проход (2026-11-03, ветка `workpass71-body-systems`, head `963fa54`)

### 18.1 Что исправлено (`IMPLEMENTED`, доказано регрессией)

| Дефект | Причина | Исправление | Регрессия |
|---|---|---|---|
| Накопление костей полного тела VRM | `applyVrmFullBodyChannels` писало spine/локти/бёдра/колени через `+=`, но, в отличие от прохода взгляда (который сбрасывает head/neck/плечи каждый кадр), **не сбрасывало свои кости** | сброс всех «своих» костей в identity перед записью; `=` вместо `+=` | `full-body apply is idempotent across frames and returns bones to rest` (fail-before: spine.x рос `0.04 → 0.08 → 0.12`) |
| Триммер слоёв арбитра срезал primary | компаратор `MAX_LAYERS` сортировал primary **последним** (`? 1 : 0`), т.е. выбрасывал его как «наименее важный» — вопреки собственному комментарию | primary сортируется первым (`? 0 : 1`) | `rapid intent changes never trim the primary program away` (fail-before) |
| Оверлей дыхания игнорировал реальный вес | наложение idle-слоя использовало сырую константу веса и игнорировало масштаб энергии | масштаб `weight * energyScale` | `idle breath overlay is scaled by its real blend weight` (fail-before) |

### 18.2 Прогоны (OBSERVED, exact-head `963fa54`)

- `npm --prefix app run test:body-systems` — 28/28 PASS (3 новые регрессии падают до фикса).
- `npm --prefix app run test:scripts` — 459/459 PASS.
- `npm --prefix app run typecheck` — PASS.
- GitHub Actions — 16/16 `success` на `963fa54`.

### 18.3 Уточнённая оценка готовности (после §18)

| Аспект | §16 | §18 | Причина |
|---|---:|---:|---|
| Capability/контракт тела | 88% | 88% | Без изменений |
| Моторика (полное тело) | 45% | 46% | Арбитр стал корректным (не теряет primary, дыхание затухает); live-IK и device E2E всё ещё нет |
| 3D / VRM | 33% | 34% | Устранён дрейф костей полного тела (реальный визуальный дефект в покадровом цикле); production-модели и визуальной проверки по-прежнему нет |
| Live2D / Original 2D | 69% | 69% | Без изменений |
| 2.5D depth rig | 20–25% | 20–25% | Без изменений |
| Взаимодействие с миром | 25% | 25% | Без изменений |

### 18.4 Честная граница (`UNRESOLVED`)

- Исправления **повышают корректность моторики/3D-рендера**, но это по-прежнему unit-уровень,
  не device E2E и не визуальная приёмка.
- Проценты — инженерные прокси.
- Новый кандидат из исследования (StreamTalk / key-pose anchoring для подавления long-horizon
  drift в streaming-жестах) записан в `docs/RESEARCH_INTAKE_LEDGER.md` как `RESEARCH-ONLY`:
  механизм «anchor key pose» может укрепить §17/проход 4.3 (live-IK поверх клипов без рывков),
  но требует отдельного изолированного эксперимента и проверки лицензии до интеграции.

## 19. Прогресс-проход (2026-11-03, ветка `workpass71-body-systems`)

### 19.1 Что исправлено (`IMPLEMENTED`, доказано регрессией)

| Дефект | Причина | Исправление | Регрессия |
|---|---|---|---|
| 2.5D depth-rig гнал риг от **целевого** угла | `resolveDepthRigPoseFromMotorFrame` вычислял дельту из `targetAngleRad` (куда контроллер *хочет* повернуть сустав), а не из `angleRad` (где сустав *фактически* находится). Это противоречит инварианту I3 мастер-плана и поведению родственного `motorFrameMapper` («maps measured motor angles, not target intent») | дельта и валидация строятся на измеренном `angleRad` | `maps measured motor joint state through explicit bounded rig bindings, never the target intent` + `a joint already at rest emits no rotation even when its target is far away` (fail-before: 2 падения) |
| 3D-риг: reset костей гасил клип | (перенесено из §18.1; подтверждено как закрытый) | — | — |
| Кроссфейд переключения тела никогда не завершался | `AvatarStage` передавал в `advanceBodySwitch` покадровую дельту `now - lastAt`, тогда как функция ожидает **накопленное** время от старта. Прогресс рос на ~16/220 за кадр и `committed` не наступал: прозрачность замирала на ~0.40 и переход не фиксировался | добавлен `advanceBodySwitchFromStart(previous, startMs, nowMs, durationMs)` (якорь на `performance.now()` старта перехода); компонент использует его | `a requestAnimationFrame loop driven by per-frame deltas still commits within the duration` + `start-anchored crossfade stays monotonic, bounded and robust to invalid clocks` (fail-before: без якоря `committed=false` даже после 40 кадров) |

### 19.2 Дополнительно в этом проходе (`IMPLEMENTED`, доказано регрессией)

| Дефект | Причина | Исправление | Регрессия |
|---|---|---|---|
| Счётчики маршрутизации восприятия терялись при рестарте | `restoreFromPersisted` персистил и публиковал `facets.embodiment.perceptionRouting` (routedCount/droppedCount/lastRoute), но **никогда не восстанавливал** его в живое состояние — после рестарта счётчики сбрасывались в дефолт | добавлен `sanitizePerceptionRoutingState` (отвергает не-целые счётчики, неизвестный маршрут, чужую версию) и восстановление в `EmbodimentSubsystemRuntime` | `embodiment-perception-routing-restore-integrity.mjs` (fail-before: «persisted routing counters must survive restore») |

### 19.3 Прогоны (OBSERVED)

- `node --experimental-strip-types --test app/scripts/depth-rig.test.mjs` — 19/19 PASS (2 новые регрессии падают до фикса).
- `node --experimental-strip-types --test app/scripts/embodiment-ui-bridge.test.mjs` — 16/16 PASS (2 новые регрессии кроссфейда).
- `npm --prefix app run test:body-systems` — 32/32 PASS.
- PR [#764](https://github.com/ailtron1ss-rgb/NK1/pull/764) (base `workpass70-source`): exact-head `de31bb387` — 44/45 check-runs success; единственный `cancelled` — суперседированный дубликат `push`-прогона, чей `pull_request`-аналог зелёный. Ветка перебазирована мержем на двинувшийся `workpass70-source`.
- `npm --prefix app run test:scripts` — 466/466 PASS (2 новые регрессии кроссфейда).
- `npm --prefix app run typecheck` — PASS.
- `npm --prefix runtime/neuro-kurisu run test:aspect10:interaction` — 47/47 PASS.
- `npm --prefix runtime/neuro-kurisu run test:embodiment-perception-routing-restore` — PASS.
- `npm --prefix runtime/neuro-kurisu run typecheck` — PASS (`TYPECHECK=PASS mode=tsc compiler=app-lock`).
- `node tools/audit-runtime-test-coverage.mjs` — `status: PASS`.

### 19.4 Уточнённая оценка готовности (после §19)

| Аспект | §18 | §19 | Причина |
|---|---:|---:|---|
| Capability/контракт тела | 88% | 88% | Без изменений |
| Моторика (полное тело) | 46% | 47% | 2.5D-путь моторики теперь соответствует измеренному состоянию сустава; live-IK и device E2E всё ещё нет |
| 2.5D depth rig | 20–25% | 21–26% | Исправлен реальный семантический дефект в transform-мосте (measured vs target); остаются production art, pivots, визуальный E2E |
| 3D / VRM | 34% | 34% | Без изменений |
| Live2D / Original 2D | 69% | 70% | Устранён реальный дефект переключения тела: кроссфейд теперь действительно завершается (виден конечный кадр тела, а не замороженные ~40%); device E2E по-прежнему нет |
| Взаимодействие с миром | 25% | 25% | Без изменений |
| Континуальность состояния тела | — | + | Маршрутизация восприятия теперь переживает рестарт (evidence-counters не теряются) |

### 19.5 Честная граница (`UNRESOLVED`)

- Дефект measured/target был **реальным семантическим рассогласованием** в моторике, но
  он в 2.5D-контракте, который ещё не подключён к render-пути; визуального E2E по-прежнему нет.
- Проценты — инженерные прокси, не «процент файлов».
- Восстановление `perceptionRouting` повышает континуальность, но не является доказательством
  качества восприятия на независимом holdout.

---

## 20. Супердетальный поэтапный план доведения до работоспособности: аспекты 2 / 2.5 / 3 (тела), моторика, полноценное взаимодействие с миром

Раздел превращает §17 в исполнимую декомпозицию: каждый шаг — **независимо проверяемый переход
состояния** с конкретным артефактом, владельцем, минимальной правкой, воротами приёмки, меткой
доказанности, зависимостями и определением «готово». Правила §3.2 (один владелец на способность,
непереопределение производных каналов, честный `unsupported`, запрет плейсхолдеров вместо арта)
действуют на каждом шаге.

Легенда метки «готово»: **DoD** — что должно быть верно, чтобы шаг считался закрытым.
Метки доказанности: `PLANNED` → `IMPLEMENTED` → `TESTED` → `INTEGRATED` → `MEASURED` → `RELEASED`.

### Фаза A — Аспект 2: 2D-тела (Live2D / Original SVG / Legacy sprites)

| # | Задача | Артефакт / владелец | Минимальная правка | Ворота приёмки | DoD |
|---|---|---|---|---|---|
| A1 | Инвентаризация реальных каналов каждого 2D-адаптера | `rendererRegistryDefaults.ts` + `body-systems.test.mjs` | список каналов выводится из фактических записей адаптера | fail-before/pass-after тест | `PROVEN` (§16) |
| A2 | Словарь выражений stage ↔ viewer | `AvatarStage.tsx`, `viewer.html` | каждое отправляемое значение обязано быть в `EXPR_MAP` | тест на полноту словаря | `PROVEN` (§16.2a) |
| A3 | Авторинг дополнительных Live2D-движений (Idle/TapHead/TapBody/Special+) | `runtime/…/public/live2d/` | новые `.motion3.json` без разрыва физики | клип загружается, не ломает `physics` | `IMPLEMENTED` → нужен визуальный E2E |
| A4 | Синхронизация губ с audio clock Live2D | `embodimentTimeline.ts` + viewer | viseme-таймлайн от аудио-часов, не от кадров | измеренная задержка ≤ бюджета | `MEASURED` |
| A5 | Production-мастер Original 2D: слои, выражение-атлас, независимые garments/props | `app/public/…` + провенанс в `site.json` | реальный арт с подтверждённой лицензией | asset-hash + license в манифесте | `RELEASED` (арт отсутствует — блокер) |
| A6 | Честная семантика Legacy sprites (это реакции, не тело) | манифест `nk1-legacy-sprites-2d` | `channels: []`, `productionReady` по факту | манифест не заявляет лишнего | `PROVEN` |
| A7 | Browser/device E2E для 2D | Playwright + реальный рендер | скриншоты с ненулевыми каналами, чистая консоль | визуальная приёмка | `MEASURED` |

### Фаза B — Аспект 2.5: производственное 2.5D-тело (layered puppet) — единственный режим без рендера

| # | Задача | Артефакт / владелец | Минимальная правка | Ворота приёмки | DoD |
|---|---|---|---|---|---|
| B1 | Завести `depth2d`-манифест и 5-й режим UI за feature-gate | `rendererRegistryDefaults.ts`, `AvatarStage.tsx` | режим виден только при валидном риге | регрессия UI, `selectable()` не отдаёт плейсхолдер | `INTEGRATED` |
| B2 | Production layered-art: слои (волосы/лицо/тело/руки) с pivot-offset и закрашенными скрытыми зонами | `app/public/depth-rig/…` + провенанс | реальный PSD/Krita-экспорт | asset-hash + license в манифесте | **блокер: нет арта** |
| B3 | Подключить `applyDepthRigWorldPoseToLayers` к render-пути | `depthRigRendererAdapter.ts` → stage | поза пишется в матрицы слоёв | readback `renderedNodeIds`, нет второго scene graph | `INTEGRATED` |
| B4 | Связать `resolveDepthRigPoseFromEmbodimentIntent` и `…FromMotorFrame` с arbiter-каналами | `embodimentIntentAdapter.ts` | **измеренный** `angleRad` (исправлено, §19), единый словарь каналов с 2D/3D | тест на совпадение словаря каналов | `TESTED` (§19) |
| B5 | Калибровка pivots и rest-поз под арт | данные рига | числовая калибровка по факту арта | визуальная сверка поз | `MEASURED` |
| B6 | Жёсткая граница: без подтверждённого арта `productionReady:false` | манифест | запрет публикации плейсхолдера | `selectable()` не отдаёт | `PROVEN` |

### Фаза C — Аспект 3: производственное 3D/VRM-тело

| # | Задача | Артефакт / владелец | Минимальная правка | Ворота приёмки | DoD |
|---|---|---|---|---|---|
| C1 | Подключить проверенный VRM (hosted/bundled) с license/credit | `avatarModelCatalog.ts` | строгий GLB/VRM-gate, fingerprint | модель проходит preflight | `INTEGRATED` |
| C2 | Устранить накопление костей полного тела | `vrmRuntimeAdapter.ts` | reset «своих» костей перед записью (§18) | fail-before/pass-after | `PROVEN` (§18) |
| C3 | Live-IK рук поверх клипа (CCD/FABRIK в плоскости) | `planarArmIK.ts` + adapter | IK поверх `AnimationMixer`, приоритет каналов | тест достижимости/пределов + отсутствие рывков | `MEASURED` |
| C4 | Live-IK ног + фазы walk/sit/stand без конфликта с arbiter | `motionLibrary.ts` + adapter | клипы согласованы с приоритетами | клип не переопределяет производные каналы | `MEASURED` |
| C5 | Губные морфы/visemes ↔ audio clock (latency-бюджет) | `glbMouthMorphAdapter.ts` | виземы от аудио-часов | измеренная задержка ≤ бюджета | `MEASURED` |
| C6 | Spring bones / физика волос и одежды | three-vrm spring bones | канал `supportsPhysics` подтверждён | визуальная сверка | `MEASURED` |
| C7 | Calibration profile/session для IK | `vrmRigCalibrationProfile.ts` | профиль валидируется против рига | экспорт/импорт только валидного профиля | `TESTED` |

### Фаза D — Полноценная моторика («любые движения»)

| # | Задача | Артефакт / владелец | Минимальная правка | Ворота приёмки | DoD |
|---|---|---|---|---|---|
| D1 | Корректный арбитр слоёв (primary не теряется, дыхание затухает) | `motionArbitration.ts` | сортировка primary первым, `weight*energyScale` (§18) | fail-before/pass-after | `PROVEN` (§18) |
| D2 | Расширить motion library фазами reach/point/wave/hold/step | `motionLibrary.ts` | новые программы loop-safe, seam-валидация | `validateMotionProgram` без issues | `TESTED` |
| D3 | Offline-retarget донорских клипов (GMR / `.vrma`) в риг NK1 | pipeline вне runtime | клип воспроизводится в риге | лицензия записана, клип валиден | `INTEGRATED` |
| D4 | Live-IK поверх клиповой анимации без рывков | adapter | cross-fade + приоритеты каналов | отсутствие визуальных разрывов | `MEASURED` |
| D5 | Co-speech жестикуляция (streamable) — изолированный кандидат | адаптер поверх арбитра | сравнение с clip-baseline на замороженном корпусе | побеждает baseline при равном бюджете | `RESEARCH-ONLY` (LiveGesture) |
| D6 | Приоритеты каналов: производные не переопределяются arbiter-ом | `embodimentUiBridge.ts` | merge с приоритетом производных | регрессия расширена | `TESTED` |

### Фаза E — Взаимодействие с миром (embodiment)

| # | Задача | Артефакт / владелец | Минимальная правка | Ворота приёмки | DoD |
|---|---|---|---|---|---|
| E1 | Взгляд/поворот к мировым целям | `supportsWorldTargets` путь | цель из canonical owner | цель приходит из единого владельца | `INTEGRATED` |
| E2 | Опциональный захват камеры (MediaPipe face/pose/hand) | отдельный входной адаптер | opt-in, локально, без утечек | приватность-регрессия | `INTEGRATED` |
| E3 | Grounded-цель: камера ↔ семантический мир | `GroundedInteractionBridge.ts` | соединение по метке, отказ при неоднозначности | 13/13 тестов (§E evidence) | `TESTED` |
| E4 | План look/inspect/reach/touch/grasp/release/press | `EmbodiedInteractionController.ts` | deny-by-default, safety-authorization | 47/47 тестов | `TESTED` |
| E5 | Независимый postcondition | `OutcomeVerificationService` | единственный источник правды, spoofed ACK отвергается | регрессия на подделку | `TESTED` |
| E6 | Реальный контакт/манипуляция | hardware-backed adapter | только после независимой проверки | `realityClass:'device-observation'` | `UNRESOLVED` (нет железа) |

### Фаза F — Транзакционное переключение тел и визуальная верификация

| # | Задача | Артефакт / владелец | Минимальная правка | Ворота приёмки | DoD |
|---|---|---|---|---|---|
| F1 | Cross-fade без потери состояния | `embodimentSwitch.ts` | handoff сохраняет pose/gaze/speech | handoff-тест | `TESTED` |
| F2 | Завершение cross-fade (не застревает на ~40%) | `embodimentUiBridge.ts` + `AvatarStage.tsx` | якорь на старт перехода (§19) | fail-before/pass-after | `PROVEN` (§19) |
| F3 | Playwright-скриншоты 2D/2.5D/3D с ненулевыми каналами | `app/screenshots/` | реальный рендер, чистая консоль | визуальная приёмка | `MEASURED` |
| F4 | Откат к прежнему телу при сбое | switch contract | fail-closed, без белого экрана | rollback-тест | `TESTED` |

### Фаза G — Реальная проверка на устройствах, производительность, soak

| # | Задача | Ворота | DoD |
|---|---|---|---|
| G1 | Latency STT→LLM→TTS→viseme на целевом устройстве | бюджет зафиксирован | `MEASURED` |
| G2 | FPS/память/батарея при долгом прогоне | soak ≥ 30–60 мин | `MEASURED` |
| G3 | Мобильный viewport и слабый GPU | деградация с честным сообщением | `MEASURED` |
| G4 | WebGL context loss / reduced motion / low-memory | восстановление без утечек RAF/контекстов/audio | `TESTED` |

### Фаза H — Поставка на GitHub (deliverables и evidence)

| # | Задача | Артефакт | DoD |
|---|---|---|---|
| H1 | Каждый проход = отдельный PR от `workpass70-source` (не пачкой) | PR с exact-SHA | §6 соблюдён |
| H2 | Exact-head CI зелёный на каждом PR | ссылки на runs | `OBSERVED` |
| H3 | Обновлять handover/changelog и `RESEARCH_INTAKE_LEDGER.md` | запись донора/результата/решения | документировано |
| H4 | Release ZIP из проверенного source SHA + provenance/SBOM/checksum | артефакт релиза | `RELEASED` (лицензия — блокер) |
| H5 | Human license review для всех art/model assets | подписанный чек-лист | `RELEASED` |

### Порядок исполнения и зависимости

1. **Сначала контракт и честность** (A1, A2, A6, B4, B6, C2, D1, D6, F2) — уже закрыты в §16–§19.
2. **Затем блокеры арта/модели** (A5, B2, C1) — внешняя зависимость: production-art и
   лицензированная VRM. Без них аспекты 2.5 и 3 не могут стать `RELEASED`.
3. **Затем интеграция рендер-путей** (B3, B5, C3–C7, D2–D4).
4. **Затем E2E и мир** (A7, E1–E5, F3, G1–G4).
5. **В конце поставка** (H1–H5).

### Честная граница §20

- Это исполнимый план, а не отчёт о достижениях. Большинство строк — `PLANNED`/`UNRESOLVED`.
- Проценты готовности — инженерные прокси, не «процент файлов».
- Субъективное переживание/сознание — `UNKNOWN / UNRESOLVED`.
- Ни один шаг не считается `RELEASED` без exact-SHA CI, независимого доказательства и
  закрытого license-review.

## 21. Прогресс-проход 2 (2026-11-03, ветка `workpass71-body-systems`, после §20)

Продолжение по плану §20, итеративное исправление дефектов того же класса, что и в §19.

### 21.1 Что исправлено (`IMPLEMENTED`, доказано регрессией)

- **Счётчики маршрутизации восприятия обнулялись каждый тик.** `routePerception` возвращал
  литеральные `routedCount:1` / `droppedCount:1`, но результат пишется в `facets.embodiment.perceptionRouting`
  каждый тик. Значит, уже на следующем событии накопленные значения стирались, и восстановление из
  персиста (§19.1) фактически теряло смысл. Теперь функция сворачивает событие в санитизированное
  предыдущее состояние (`previous`), а подсистема передаёт своё живое состояние как приор.
  - Регрессия: `tests/embodiment-perception-routing-restore-integrity.mjs` — два события дают
    `routedCount===2` (до фикса — `1`), сон-дроп даёт `droppedCount===1`.

### 21.2 Прогоны (OBSERVED)

- `npm --prefix runtime/neuro-kurisu run test:embodiment-perception-routing-restore` — PASS.
- `npm --prefix runtime/neuro-kurisu run typecheck` — PASS (`TYPECHECK=PASS mode=tsc compiler=app-lock`).
- `node --experimental-strip-types runtime/neuro-kurisu/tests/function-contract-public-utilities.mjs` — PASS.
- `npm --prefix runtime/neuro-kurisu run test:aspect10:interaction` — 47/47 + 13/13 PASS.
- `npm --prefix app run test:body-systems` — 32/32 PASS; `npm --prefix app run test:scripts` — 466/466 PASS; `npm --prefix app run typecheck` — PASS.

### 21.3 Остаточный аудит (`HYPOTHESIS`/`UNRESOLVED`)

- Прочие счётчики сущностей (`mentionCount`, `seenCount`, `observationCount`) инкрементируются
  корректно; класса «литерал вместо инкремента» больше не найдено в `runtime/.../body/`.
- Следующий приоритет по §20: `B3` (2.5D рендер-путь, блокер — production-арт), `C3` (live-IK рук,
  `planarArmIK` пока только типизирован, не вызывается), `F3`/`G1` (визуальная E2E и soak).

### 21.4 Дефект 2: 2.5D-поза терялась для id-узлов, совпадающих с ключами `Object.prototype`

- `resolveDepthRigPose`, `resolveDepthRigWorldPose` и `resolveDepthRigPoseFromMotorFrame`
  накапливали дельты в обычном `{}`. Легальный id узла вида `__proto__` или `constructor`
  записывался в прототип, а не как собственный ключ: дельта исчезала и слой не двигался.
- Исправление: аккумуляторы на `Object.create(null)`; чтение `pose.deltas[node.id]` и
  `world.transforms[node.id]` теперь находит такие узлы.
- Регрессия: `app/scripts/depth-rig.test.mjs` — узлы `__proto__`/`constructor` сохраняют позу,
  мировой трансформ и поворот мотор-кадра. Fail-before: 19/20; pass-after: 20/20.

### 21.5 Дефект 3: IK сообщал недостижимую цель как достигнутую

- `solvePlanarArmIK` возвращал запрошенную `target` даже после того, как ограничения
  плеча/локтя урезали углы: связанное (недостижимое) решение выглядело как полное.
- Исправление: возвращаются `endEffector` (прямая кинематика по фактическим углам) и флаг
  `limitsApplied`; `target` сохраняется как исходный запрос.
- Регрессия: `app/scripts/planar-arm-ik.test.mjs` — без урезания `endEffector` совпадает с
  целью и `limitsApplied=false`; при узком лимите `limitsApplied=true` и промах > 5 см.

### 21.6 Прогоны после дефектов 2–3 (OBSERVED)

- `node --test app/scripts/depth-rig.test.mjs` — 20/20 PASS.
- `node --test app/scripts/planar-arm-ik.test.mjs` — 8/8 PASS; `vrm-humanoid-rig-adapter` — 11/11 PASS.
- `npm --prefix app run test:body-systems` — 32/32; `test:embodiment-ui-bridge` — 16/16;
  `test:scripts` — 468/468; `app typecheck` — PASS.
- `runtime/neuro-kurisu` typecheck и routing/aspect10-наборы остаются зелёными (см. §21.2).
