# NK1 / NeuroCore — мастер-план доведения до 100%

**Дата:** 2026-10-30
**Автор:** инженерный разбор по фактам репозитория `ailtron1ss-rgb/NK1` (не по отчётам)
**Каноническая кодовая линия:** `workpass70-source` @ `ad564d1879028f00549be41ec5172a2f72e25897`
**Назначение:** единый рабочий план до полного завершения: аспекты, фактическое состояние каждого, прогресс, разрывы, шаги, критерии приёмки. Отдельно — доведение смены тела **2D / 2.5D / 3D**.

> Документ намеренно без «воды». Каждый пункт — либо проверяемый факт, либо конкретное действие с критерием выхода. Оценки — инженерные (реализация / автопроверка / поле / релиз), а не «процент разума».

---

## 0. Что реально проверено в этой сессии (а не взято из отчётов)

Проверено запуском на чистой машине, в клоне `workpass70-source`:

| Проверка | Команда | Результат |
|---|---|---|
| Установка зависимостей app | `npm ci` (app) | **PASS** — 420 пакетов, 8 с |
| App TypeScript | `npm run typecheck` | **PASS** |
| App regression suite | `npm run test:scripts` | **PASS** — 254/254 |
| Production build + DB migrate | `npm run build` | **PASS** (Vite/rolldown, nitro; `DATABASE_URL` не задан → PGLite) |
| Runtime TypeScript | `npm --prefix runtime/neuro-kurisu run typecheck` | **PASS** — `TYPECHECK=PASS mode=tsc` |
| Memory retrieval experiment | `test:memory-retrieval-experiment` | **PASS**, но **`promotion: not-promoted`**, `recallDelta=0` |
| Финальный release gate | `node tools/verify-final-release.mjs` | **FAIL** — архитектурный сканер даёт ложный отказ (см. §1.3) |

**Ключевой факт:** база **собирается, проходит typecheck, 254 app-теста и production build с первого раза**. Это снимает главный миф «не запускается». Незакрытым остаётся не «работает/не работает», а **доказанность на реальном окружении и релизная чистота**.

---

## 1. Фактическое состояние

### 1.1 Масштаб и структура

| Область | Факт |
|---|---|
| Ветки на `origin` | **490** |
| Открытые PR | **≥100** (API-выборка ограничена 100; значительная часть — draft) |
| Аспект-ветки (2026-10-30) | **16** |
| GitHub Actions workflows | **30** в `workpass70-source` |
| Тесты runtime | **1349** файлов в `runtime/neuro-kurisu/tests` |
| Исходники ядра | 636 `.ts` в `runtime/neuro-kurisu/src` |
| `main` vs `workpass70-source` | **нет общего предка** (`git merge-base` пуст; main на 30 впереди / source на 2603 впереди в своей истории) |

### 1.2 Что подтверждено по аспектам (сильные места)

- Единый когнитивный цикл существует и трассируется: `OrganismRuntime.step()` → `OrganismCore.observe()/feedback()`; владельцы стадий зафиксированы (`CognitiveEventFabric`, `UnifiedCognitiveCycle`, `RealityEvidenceLedger`, `ActionGateway`).
- Память: `MemoryOS2` — канонический владелец; `MemoryFabric.retrieveForCognition`; отдельный retrieval benchmark/experiment.
- Обучение: P23/P26/P28/P29/P30, `IndependentSkillCandidateEvaluator`, `VersionedSkillCandidateStore`, подписанные promotion gates.
- Действия: `ActionGateway` (approval, идемпотентность, receipts, reconciliation), `OutcomeVerificationService` (non-forgeable in-process evidence identity), `ExternalPostconditionVerifier`.
- Личность: `IdentityContinuity`, `SelfModelV2`, `P78AutobiographicalSelfContinuity`, `P2702PersistentPersonalityDynamics`, `SocialMindKernel`.
- Воплощение: Live2D Cubism (`Kurisu.moc3` ~6 MB, 8 expressions, 5 motion clips), 32 PNG-спрайта, редактируемый SVG, Three.js 3D-режим, `kurisu_embodiment_intent` v1.
- Локальная модель: `OpenAICompatibleLocalChatProvider` (llama.cpp, только loopback), `LocalLanguageBackendPolicy` (cooldown/fallback), `LocalEmbeddingProvider`.

### 1.3 Незакрытые разрывы (то, что реально мешает «100%»)

1. **Память не доказана:** `recallDelta=0`, `not-promoted` на независимом наборе. Это главный технический блокер (без памяти нет личности).
2. **Раздробленность веток:** 490 веток, `main` без общего предка с source, интеграционный стек (Hexis/PR #236) разошёлся (`mergeable_state=dirty`). Нет одного канонического SHA, на котором зелёный весь набор.
3. **Release gate падает:** `release:verify` → `ok:false`. Причина — ложный отказ архитектурного сканера: `world-perception-runtime-wiring.mjs` ссылается на `./WorldContextNormalizer.ts`, которого нет; это **отрицательные** assert'ы (проверка, что импорта НЕТ), но сканер трактует строку как требование импорта. Также `avatar-motor-intent.test.mjs` тянет `./embodiment-intent.mjs` из app-теста, а не из runtime.
4. **License gate:** `releaseRedistributionReady: false`, **135 незакрытых записей** (глобально 6, root 7, runtime 7, npm-инвентарь 5+1, 8 архивов ×7, 11 файлов лицензий). Это человеко-юридическое решение, не код.
5. **Нет релиза из текущего source:** последний опубликованный ZIP — `WorkPass70 Hotfix1` от **2026-10-19**. Исходники ушли на ~500+ workpass вперёд.
6. **Нет реального E2E:** браузер/Live2D/audio, физический Android/Termux, production build + миграция БД на staging, длительный soak (24–72 ч) — не подтверждены.
7. **Аспекты рассинхронизированы по номерам:** «Aspect 08» используют и tool-governance, и wardrobe; «Aspect 11» — и artwork-pipeline, и cross-renderer switching. «Аспект 14» = emotional body language, «аспект 16» = speech fanout, «аспект 06» = motor control, «аспект 13» = motor rig profiles. Нужна единая нумерация (§2).
8. **Embodiment честно недоделан:** истинный 2.5D depth-rig — **5/100** (нет production layered art), 3D skeleton/IK/cloth — **0–5/100** (нет легального VRM-рига), Live2D garment swap — **10/100**.

### 1.4 Самооценка проекта (12 направлений, tracker 2026-10-26, head `621864d0`)

| Направление | Вес | Реализ. | Автопров. | Поле | Релиз |
|---|---:|---:|---:|---:|---:|
| Когнитивное ядро и runtime | 15 | 72 | 76 | 20 | 42 |
| Модель мира/прогноз/маршрутизация | 10 | 64 | 67 | 15 | 32 |
| Память/консолидация/восстановление | 10 | 68 | 75 | 20 | 38 |
| Мотивация/гомеостаз/цели | 8 | 68 | 73 | 15 | 35 |
| Планирование/ActionGateway/идемпотентность | 10 | 72 | 85 | 20 | 42 |
| Обучение/replay/перенос | 10 | 74 | 86 | 18 | 38 |
| Навыки/рефлексия/промоушен | 10 | 82 | 92 | 20 | 42 |
| SelfModel/UserModel/ToM/этика | 5 | 42 | 41 | 8 | 20 |
| Воплощение Live2D/аватар | 5 | 62 | 54 | 8 | 18 |
| Голос/TTS/STT/мобильное аудио | 4 | 42 | 28 | 0 | 8 |
| App/зависимости/CI/установка | 8 | 70 | 86 | 35 | 48 |
| Внешняя проверка/лицензии/релиз | 5 | 38 | 38 | 5 | 10 |

**Сводно:** реализация **66,6%**, автопроверка **72,4%**, поле **17,4%**, релиз **34,9%**. Learning scorecard: 57/100, `measuredUpliftClaimed: false`.

**Вывод:** разрыв между 72% проверок и 17% поля — это и есть вся задача. Доведение до 100% = закрытие доказательных ворот, а не добавление модулей.

---

## 2. Единая каноническая нумерация аспектов (устраняет конфликт номеров)

Сейчас в ветках конфликтуют номера («Aspect 08» = и tool-governance, и wardrobe; «Aspect 11» = и artwork, и body-switching). Фиксирую одну таблицу. Она — источник истины для имён веток, PR, документов и CI.

| № | Аспект | Владелец в коде | Ветка-линия | Статус |
|---|---|---|---|---|
| 01 | Когнитивное ядро (единый цикл) | `OrganismCore`, `OrganismRuntime`, `UnifiedCognitiveCycle`, `UnifiedCognitiveSubstrate` | `work/nk1-aspect01-cognitive-core-hardening-2026-10-30` (PR #422) | code added, CI pending |
| 02 | Восприятие и модель мира | `PerceptionEngine`, `WorldContext*`, `RealityEvidenceLedger` | `aspect02-world-perception-deep-pass-2026-10-30` (PR #423) | code added |
| 03 | Обучение и саморазвитие | P23/P26/learners, `IndependentSkillCandidateEvaluator` | `aspect03-learning-self-development-2026-10-30` (PR #401) | code added |
| 04 | 2.5D depth-rig | `depthRig.ts`, `depthRigRendererAdapter.ts` | `work/nk1-aspect04-depth-rig-2026-10-30` (PR #409) | контракт готов, арт 5% |
| 05 | UserModel и grounding | `SelfModelV2`, user-model capture | `work/nk1-aspect05-user-model-grounding-2026-10-30` | code added |
| 06 | Мотивация и эмоции | `EmotionAppraisalEngine`, intrinsic motivation | `work/emotion-motivation-deep-pass-2026-10-30` (PR #400) | code added |
| 07 | Аффективное выражение (лицо) | `affectiveExpression.ts` | `work/aspect-07-affective-expression-2026-10-30` (PR #411) | code added |
| 08 | Tool governance (безопасное исполнение) | `ActionGateway`, tool input contracts | `aspect08-tool-governance-2026-10-30` (PR #424) | code added, CI pending |
| 09 | Голос/просодия | `VoiceEmbodiment`, browser prosody adapter | `work/nk1-aspect9-unified-voice-prosody-2026-10-30` (PR #413) | code added |
| 10 | Embodied world interaction | `EmbodiedInteractionController` | `aspect10-embodied-world-interaction-2026-10-30` (PR #414) | code added |
| 11 | Смена тела 2D/2.5D/3D | `embodimentSwitch.ts`, motor controller | `work/nk1-cross-renderer-body-switching-2026-10-30` (PR #415) | контракт готов |
| 12 | Производительность/релиз/надёжность | release tooling, license gate, CI | `aspect12-release-reliability-2026-10-30` | план + часть кода |
| 13 | Универсальные моторные профили | `MotorRigProfileV1`, `EmbodiedMotorController` | `work/nk1-autonomous-motor-control-2026-10-30` (PR #410) | code added |
| 14 | Эмоциональный язык тела | `affectiveArmPosture.ts`, `FacialMicrochannels` | `work/aspect-07-affective-expression-2026-10-30` | code added |
| 15 | Модульный гардероб | wardrobe domain, VRM garment adapter | `work/nk1-wardrobe-modular-clothing-pass-2026-10-30` (PR #412) | 60/100 |
| 16 | Fanout речевых событий | speech event fanout | `work/nk1-aspect9-unified-voice-prosody-2026-10-30` | code added |
| 17 | Original 2D арт-система | `KurisuOriginalStage.tsx` | `work/aspect-02-original-2d-art-system-2026-10-30` (PR #407) | контракт готов |

Правило: одна тема — один номер — одна линия веток. Дубликаты номеров переименовать при следующем проходе; старые ветки не удалять (сохранить как архив с манифестом).

---

## 3. Аспекты: состояние, прогресс, план до 100%

Формат: состояние → разрыв → шаги → критерий 100%. Оценки из §1.4, уточнены фактами сессии.

### Аспект 01 — Когнитивное ядро (вес 15)
**Состояние:** единый цикл существует и трассируется (11 стадий: perception → prediction → appraisal → attention → memory → goal → plan → action → outcome → learning → reflection). В `work/nk1-aspect01-*` добавлены: allow-list restore `UnifiedCognitiveSubstrate`, строгий restore `CanonicalMemoryLifecycleAuthority`, отказ duplicate/decreasing tick, overflow-guard счётчика цикла, требование полных 11 стадий при extended-cycle, регрессия `workpass617/618` и CI-шаг.
**Прогресс:** реализация ~72, автопроверка ~76, поле 20, релиз 42.
**Разрыв:**
- `OrganismCore.ts` ≈ 1,32 МБ — монолит; извлечение оркестрации рискованно и не завершено.
- Нет доказательства, что все 11 стадий связаны с точным tick/source identity в рантайме (сейчас в основном source-text тесты).
- Нет long-run детерминированного теста (10 000 тиков), нет restart-в-середине каждой фазы с проверкой lineage.
- Микроциклы могут не проходить через каноническую границу.

**Шаги:**
1. Зафиксировать и включить в CI `test:aspect01:unified-substrate-integrity` + `workpass618-canonical-memory-lifecycle-integrity` на exact HEAD (PR #422).
2. Аудит: каждый писатель canonical state → один владелец. Таблица «домен → единственный писатель → тест».
3. Runtime-тест «11 стадий на одном tick» с проверкой 11 различных event IDs и causal parent links.
4. Restart-in-the-middle для каждой из 11 фаз (SIGKILL между фазами) + проверка отсутствия дублей и потери lineage.
5. Инкрементальная модуляризация `OrganismCore`: observation assembly → appraisal/attention → memory/goal → plan/action → outcome/learning, узкие typed ports, каждый шаг под regression-набором.
6. Публиковать p50/p95/p99 tick latency, heap growth, checkpoint cost, cycle completeness, broken-lineage rate.

**Критерий 100%:** один владелец на каждый writable-домен; все пути (в т.ч. reduced-resolution) проходят явную границу; 11 стадий причинно полны на реальных прогонах; duplicate/stale/malformed/restored события не создают завершённость цикла или learning credit; restart сохраняет состояние и lineage; нет параллельного когнитивного runtime; модуляризация завершена настолько, что владение тестируемо; long-run и Android-гейты пройдены; exact SHA входит в проверенный Release ZIP.

### Аспект 02 — Восприятие и модель мира (вес 10)
**Состояние:** `WorldContext.objects`, `GroundedWorldState`, `PerceptionEngine`, `RealityEvidenceLedger`; добавлен guard пространственной неоднозначности; idempotency keys в camera runtime.
**Прогресс:** реализация ~64, автопроверка ~67, поле 15, релиз 32.
**Разрыв:** наблюдаемое/предсказанное/симулированное/выведенное недостаточно разведены в живом цикле; prediction error → appraisal → belief update не доказан на multi-step задачах; mock-наблюдение может неверно маркироваться как device-наблюдение.
**Шаги:**
1. Для каждого observation — источник, время, validity, schema, уровень доверия (единый контракт).
2. Тесты multi-step: правильный ответ зависит от нескольких состояний и времени.
3. Явно развести observed / predicted / simulated / derived; регрессия «simulation-evidence ≠ real-device-evidence».
4. Проверить цикл prediction error → appraisal → belief update/review → new plan на реальном событии.
5. Подключить реальные действия только через `ActionGateway` с корректным tool registry/permission scope.
**Критерий 100%:** модель мира используется в живом цикле и корректирует поведение по внешним проверенным последствиям; mock никогда не выдаётся за device evidence; latency perception→decision→action→verified result измерена.

### Аспект 03 — Обучение и саморазвитие (вес 10)
**Состояние:** replay, causal outcomes, P23/P26/P28/P29/P30, evaluation и promotion gates, `IndependentSkillCandidateEvaluator`, `VersionedSkillCandidateStore`, подписанные P23 evidence gates; hardening P23-журналов и recovery.
**Прогресс:** реализация ~74, автопроверка ~86, поле 18, релиз 38. Learning scorecard 57/100, uplift не заявлен.
**Разрыв:** нет независимого переноса; family gain исторически `memory=1, tool-use=0, transfer=0`; holdout-целостность восстанавливалась несколько раз (PR #420).
**Шаги:**
1. Развести наблюдение / гипотезу / reward / causal credit / подтверждённый outcome; неподтверждённое не обновляет веса.
2. Привязать credit к точному execution/evidence tuple; задержанное подтверждение продвигает запись идемпотентно.
3. Ablations: no-learning, replay-only, candidate, candidate+replay, policy-only — на одном task/seed/budget.
4. Метрики: task success, trajectory quality, regret, retention, transfer, calibration, safety violations, compute cost, negative transfer, catastrophic regression, skill expiry/decay.
5. Полный цикл: error → diagnosis → repair proposal → validation → holdout → verifier → approval → staged activation; создание ≠ проверка ≠ одобрение ≠ активация.
6. Signed evidence canonicalization, replay protection, durable candidate store CAS, restart, multi-process contention, rollback.
**Критерий 100%:** повторяемый выигрыш на независимых задачах, не объяснимый leakage/seed-selection; нет критической деградации старых навыков; кандидат не активируется без независимого evidence gate; улучшение сохраняется после restart.

### Аспект 04 — 2.5D depth-rig (входит в «Воплощение», 5)
**Состояние:** `depthRig.ts` — versioned rig-контракт (Y-down, pivots, parent hierarchy, depth order, rest transforms), валидатор (duplicate IDs, missing parents, root cardinality, cycles, finite transforms), bounded intent→pose mapper, Three.js transform adapter, face morph resolver, spring follow-through; `resolveDepthRigPoseFromMotorFrame` с explicit `DepthRigJointBinding`. Тест `depth-rig.test.mjs` — 16 тестов PASS (run 41017379416).
**Прогресс:** runtime foundation ~70, production layered art 5/100, полный 2.5D end-to-end 25/100.
**Разрыв:** нет production PSD/ORA/GLB с авторскими слоями, скрытыми областями, occlusion-масками и pivots; UI не передаёт живой `MotorFrame` через optional props.
**Шаги:** см. §4 (2.5D).
**Критерий 100%:** валидный авторский layered rig + GLB; независимое движение головы/торса/конечностей; лицо независимо от головы; IK без дрейфа сегментов >1%; вторичная физика затухающая и детерминированная; переключение одежды без смены тела; desktop+Android visual E2E.

### Аспект 05 — UserModel и grounding (входит в «SelfModel/UserModel», 5)
**Состояние:** explicit UserModel capture и prompt context подключены; SelfModelV2 и identity continuity существуют.
**Прогресс:** реализация ~42, автопроверка ~41, поле 8, релиз 20.
**Разрыв:** нет калиброванной уверенности на отдельном наборе; нет тестов «неподтверждённые предположения о пользователе не становятся фактами»; влияние на voice/avatar режимы не проверено.
**Шаги:**
1. Хранить у UserModel происхождение и confidence; запретить превращать гипотезу в факт.
2. Тесты: неверная уверенность, несогласие источников, ambiguity, stale facts, отсутствие информации.
3. Влияние UserModel на режимы (деловой/эмоциональный/инициативный/voice/avatar) — с регрессией.
4. Prompt-injection из памяти/документов/веб/tool-output/Hexis — red-team набор.
**Критерий 100%:** self/user модели реально влияют на выбор и калибровку, но не расширяют права и не подменяют доказательства; удалённые данные не воскресают при restore.

### Аспект 06 — Мотивация и эмоции (вес 8)
**Состояние:** `EmotionAppraisalEngine` (label, valence, arousal, dominance, confidence, причины), intrinsic motivation, endogenous goals, EILS/homeostasis, autonomous scheduler; mixed-affect motivation projection.
**Прогресс:** реализация ~68, автопроверка ~73, поле 15, релиз 35.
**Разрыв:** инициатива наблюдалась только на синтетике; нет длительного soak с измерением полезных действий; бюджет/stop/backoff не доказаны на реальном прогоне.
**Шаги:**
1. Привязать потребности/стресс/любопытство/уверенность к общему tick/state (без второй шкалы мотивации).
2. Для каждой инициативы логировать: trigger, observed state, chosen goal, rejected alternatives, budget, safety decision, outcome.
3. Проверить: без prompt система сама начинает допустимую работу (отдельно считать trigger и полезное действие).
4. Бюджеты по времени/CPU/RAM/токенам/числу действий/риску; stop/pause/rollback/audit trail/crash recovery.
5. Конкурирующие цели, конфликт с пользовательским запросом, смена приоритета после события.
6. Эмоциональная динамика на последовательностях событий; устойчивость к качелям и провокациям; запрет манипуляции пользователем.
7. 24–72 ч soak: restart, отказ провайдера, давление на хранилище, прерванные действия, latency/RAM/error/thermal.
**Критерий 100%:** воспроизводимая инициатива ≥ порога проекта; каждое решение объяснимо через реальный internal state и безопасный budget; нет бесконечных циклов и навязчивости.

### Аспект 07 / 14 — Аффективное выражение и язык тела (входит в «Воплощение», 5)
**Состояние:** `deriveAffectiveExpression()` (expression key, интенсивность, gaze, head tilt, gesture readiness, voice accent); `deriveAffectiveArmPosture()` (arm openness, shoulder tension, gesture amplitude, stillness, dominance); удалены жёсткие emotion→angle ветки в `Avatar3DStage`; общий `FacialMicrochannels`/`AffectiveBodyLanguage`.
**Прогресс:** реализация ~62, автопроверка ~54, поле 8, релиз 18.
**Разрыв:** нет реального browser/Live2D/3D E2E; нет замера непрерывности и отсутствия скачков на реальном аудио.
**Шаги:**
1. Тесты: emotion smoothing, interrupt severity, прекращение устаревшей анимации.
2. Инвариант: эмоция задаёт модуляцию, моторный планировщик остаётся владельцем выбора движения.
3. Browser E2E: выражение + жест + gaze во время речи и прерывания.
**Критерий 100%:** выражение — непрерывный выход канонического appraisal; нет жёстких «эмоция→клип» таблиц; синхронизация с голосом подтверждена на устройстве.

### Аспект 08 — Tool governance (вес 10)
**Состояние:** `ActionGateway` (approval, durable idempotency receipts, verification, audit); JSON-Schema-подобный subset для tool-входов, opt-in, валидация при регистрации и исполнении, bounded diagnostics, empty-object контракты для android listen/device status/world observation; регрессия и CI-шаг.
**Прогресс:** реализация ~72, автопроверка ~85, поле 20, релиз 42.
**Разрыв:** output schemas, provider timeouts, concurrency/rate budgets, catalog reachability — отдельная работа; timeout мутирующего провайдера должен оставаться ambiguous, не auto-retry.
**Шаги:**
1. Мигрировать все реальные адаптеры на строгие входные контракты; output-схемы — следующий шаг.
2. Provider timeouts и rate/concurrency budgets; ambiguous outcome при timeout мутирующего действия.
3. Матрица полномочий на каждом boundary, включая restore и retry.
4. Разделить request/intent/approval/action/external postcondition; output не сообщает несуществующий результат.
5. Real-device acceptance → lost ACK → SIGKILL → reconnect → duplicate replay → read-after-write → final outcome.
**Критерий 100%:** каждое заявленное действие подтверждено наблюдаемым результатом; запрещённые блокируются тестами; частичные успехи распознаются; права минимальны; есть журнал причин/подтверждений/отката; работа инструментов не обходит когнитивный цикл и этику.

### Аспект 09 / 16 — Голос, просодия, синхронизация (вес 4)
**Состояние:** браузерный TTS переведён на канонический `VoiceEmbodiment.buildVoicePlan`; устранён параллельный affect→prosody алгоритм; viseme-таймлайн по фактическому rate; `voiceEmphasis` через `EmbodimentIntentV1`; fanout речевых событий bounded.
**Прогресс:** реализация ~42, автопроверка ~28, поле 0, релиз 8.
**Разрыв:** нет реального аудио E2E; Web Speech boundary приблизительные; grapheme-viseme ≠ phoneme; Android/Termux не выдаёт авторитетный audio clock.
**Шаги:**
1. Проверить browser speech boundary в Chromium и Android WebView.
2. Termux TTS: потребляет тот же bounded prosody plan; исход воспроизведения отдельно от уверенности.
3. Acoustic/phoneme timestamps для провайдеров, которые их дают; не выдавать grapheme-viseme за phoneme ground truth.
4. Реальная аудио-запись + измерение lip-sync latency p50/p95 (цель drift ≤80 ms).
5. TTS cancellation по точному `speechEventId`; независимое подтверждение фактической тишины на устройстве.
**Критерий 100%:** реальный разговор начать/прервать/продолжить/завершить; голос и аватар по одной шкале; измеренная синхронизация на desktop и физическом Android.

### Аспект 10 — Embodied world interaction (входит в «Действия/поле»)
**Состояние:** `EmbodiedInteractionController` — grounded target identity/visibility/freshness/confidence, distance/reach checks, hand availability, deny-by-default contact policy, hazard denylist, plans (look/inspect/reach/touch/grasp/release/press), каждый план требует capability adapter и postcondition, unknown → `uncertain` (никогда success), привязка результата к plan+target ID.
**Разрыв:** реального `hand/object contact`/IK API нет (3D-аватар не предоставляет); физический Android не проверен.
**Шаги:**
1. Capability adapter с реальным readback и `executionStatus`.
2. Проверка postcondition через независимое наблюдение; ACK ≠ доказательство.
3. Матрица: lost ACK, partial side effect, spoofed/late/contradictory evidence, duplicate delivery, multi-step partial completion.
**Критерий 100%:** воспроизводимые E2E-трассы реального взаимодействия с измерением, а не изолированные unit-тесты.

### Аспект 11 — Смена тела 2D/2.5D/3D (входит в «Воплощение», 5)
**Состояние:** `embodimentSwitch.ts` — versioned semantic body snapshot, capability-aware switch plan, unsupported-channel list, общий pose blend, monotonic transition; `AvatarStage` уже выбирает `live2d | legacy | original | 3d` и сохраняет выбор; Live2D emit `live2d_intent_ack` (revision-bound, `complete:false`, `visualCompletionVerified:false`).
**Разрыв:** нет общего `EmbodimentAdapter` lifecycle (`prepare/capture/apply/verify/dispose`); нет транзакционного переключения (`stable→preparing→ready→crossfading→committed` / `rollback`); нет crossfade 150–350 ms с замером; нет round-trip browser/Android E2E.
**Шаги:** см. §4.
**Критерий 100%:** см. §4.5.

### Аспект 12 — Производительность/релиз/надёжность (вес 8 + 5)
**Состояние:** Node pin `.nvmrc=24`; app/runtime typecheck; production build + DB migrate (PGLite fallback) — PASS локально; release metadata, SBOM/provenance, source-hygiene, CI-reliability, license-readiness проверки существуют; `release:verify` — FAIL (ложный).
**Разрыв:** license gate 135 записей; нет browser/device E2E; нет soak; нет нового Release ZIP; arch-scanner false-positive.
**Шаги:** §5 и §6.

### Аспект 13 — Универсальные моторные профили (входит в «Воплощение»)
**Состояние:** `MotorRigProfileV1` (Live2D/2.5D/VRM), каталог 62 canonical joint roles, единицы/координаты/target/лимиты, валидация calibration metadata/topology/cycles/geometry/axes, Live2D честно `fidelity=approximate`, компиляция в `EmbodiedMotorController`/`SkeletalKinematics3D`, только production-calibrated профиль принимается; `solveTwoBoneIK`, `resolveMotorProposals`, `advanceJointPose`, `filterPoseForCapabilities`.
**Разрыв:** нет production-calibrated профилей конкретной Курису; нет renderer readback receipts; 3D IK adapter, баланс, contact/foot planting, collisions, grasp, autonomous MotorGoal genesis не подключены.
**Критерий 100%:** один моторный controller управляет всеми откалиброванными телами через валидированные профили; каждый renderer честно декларирует capabilities; каждая команда получает подтверждение наблюдаемого результата; недостижимое/неподдерживаемое возвращается в sensorimotor loop и не считается исполненным.

### Аспект 15 — Модульный гардероб (входит в «Воплощение»)
**Состояние:** домен гардероба, слоты, зависимости/исключения, выбор и закрепление; безопасность пакетов (manifest, MIME/path/size/hash, полная проверка payload); VRM multi-slot GLB, скелетная привязка, bind-pose gate, rollback, очистка; body+rig identity; IndexedDB (schema 1, лимит 128 MiB, повторная проверка байтов при restore); отмена устаревших загрузок. Инженерная готовность 60/100.
**Разрыв:** Live2D garment swap 10%; 2.5D swap 10%; реальных 3D garment assets 0%; visual E2E 0%; Release 0%.
**Шаги:**
1. Live2D: реальные drawable/part переключения (сейчас только capability inspection).
2. 2.5D: production layers/masks/deformation art.
3. Лицензированный набор одежды под целевое тело.
4. Визуальный E2E + Android.
**Критерий 100%:** переключение одежды в каждом renderer без смены тела/идентичности; лицензия/права подтверждены; visual E2E на desktop+Android.

### Аспект 17 — Original 2D арт-система (входит в «Воплощение»)
**Состояние:** `KurisuOriginalStage.tsx` — редактируемый SVG-концепт (голова/лицо/волосы/торс/ноги/4 силуэта рук), 3 outfit-режима, палитры, scale, motion style, 4 позы; `character-art-contract.json`; identity lock (медь/рыжие волосы, красная клипса, фиолетовые глаза, нейтральное лицо).
**Разрыв:** геометрия в одном React-компоненте; outfit = перекраска нескольких путей; нет полного expression sheet, turnarounds, hand/foot studies, layered source, named layer/pivot manifest.
**Критерий 100%:** layered master + named layers/pivots + 10 выражений × 3 интенсивности + 3 реальные одежды + hidden-area paint + legible at 128 px; человеческий visual review контактных листов.

---

## 4. Доведение смены тела 2D / 2.5D / 3D (главный запрос)

### 4.1 Принципы (инварианты, нарушать нельзя)
1. **Single source of truth:** `OrganismCore`/`OrganismSnapshot` владеет когнитивным/эмоциональным состоянием. Embodiment владеет только производным состоянием отображения/исполнения.
2. **Одно состояние — много renderer-адаптеров.** Смена тела меняет только представление; не сбрасывает эмоцию, внимание, речь, намерение, позу, гардероб, историю.
3. **Capability honesty:** адаптер декларирует реальные каналы/выражения/visemes/physics/targets/clothing layers; неподдерживаемое явно `unsupported`.
4. **No false success:** принятие команды ≠ выполнение движения. Нужен receipt с измеренным результатом.
5. **No hidden state transfer:** переносить семантические каналы, а не внутренние кости/Cubism parameter IDs.
6. **Safe handoff:** старый renderer активен до готовности нового; затем bounded crossfade; при ошибке — rollback.

### 4.2 Целевая архитектура

```
OrganismCore / OrganismSnapshot (единственный владелец состояния)
        |  (semantic channels: emotion, gaze, speech, intent, wardrobe, revision)
        v
EmbodimentRuntime  --  EmbodimentAdapter lifecycle: prepare -> capture -> apply -> verify -> dispose
        |                     |
        |  MotorFrame (canonical, renderer-independent, MotorRigProfileV1)
        v                     v
 +--------------+----------------------+-------------------------+
 | Live2DAdapter| Depth2DAdapter       | VRM3DAdapter            |
 | (Cubism)     | (layered 2.5D rig)   | (humanoid + IK)         |
 | fidelity~    | fidelity=layered     | fidelity=skeletal       |
 +--------------+----------------------+-------------------------+
        |                     |                     |
        +----- AdapterApplyReceipt (requestedPose, appliedPose, ------+
               unsupportedChannels, constraintsHit, executionStatus,
               profileId, modelGeneration, frameTick, measured joints)
```

### 4.3 Три тела: честное состояние и что нужно для 100%

| Тело | Что есть | Готовность | Что довести |
|---|---|---|---|
| **2D** | Live2D Cubism (moc3 ~6 MB, atlas 4096, physics 14 settings/41 inputs/33 outputs, 8 expressions, 5 clips), 32 PNG-спрайта (семантика перепроверена), Original SVG (4 силуэта рук, 3 outfit) | Live2D inventory 75; sprite 65; SVG 55; garments 10 | Больше motion/expression (listen/question/explain/delight/concern); реальные drawable/part переключения одежды; browser+Android E2E |
| **2.5D** | `depthRig.ts` контракт + валидатор + Three adapter + face morph resolver + springs + optional MotorFrame bridge; production layered art отсутствует | runtime 70; art 5; end-to-end 25 | Авторский layered master (PSD/ORA) с hidden areas, occlusion-маски, pivots; GLB + manifest (SHA-256, license); IK (2-bone), вторичная физика, garment slots; E2E |
| **3D** | Three.js stage, процедурное тело (литые меши), импорт VRM/GLB ≤90 MiB локально, GLTF clips, best-effort bones/morphs; `MotorRigProfileV1`; `solveTwoBoneIK`; adapter на тестовом скелете | skeleton/IK/cloth 0–5 | Легальный VRM/glTF риг Курису (humanoid, morphs, look-at, spring bones, IK, constraints); VRM runtime (spring physics, MToon, retargeting); реальный VRM E2E |

### 4.4 План по этапам (каждый этап даёт рабочий результат)

**Этап T0 — единый контракт и владение (P0, блокирующий)**
- Сопоставить `EmbodimentIntentV1`, `OrganismSnapshot`, motor goals (PR #410), capability map (PR #405).
- Устранить дублирующие источники позы; назначить единственного владельца revision и intent IDs.
- Ввести `EmbodimentAdapter` lifecycle: `prepare`, `capture`, `apply`, `verify`, `dispose`; согласовать renderer identity, capability fingerprint, model/rig identity.
- **Гейт T0:** unit-тесты schema/stale revision/capability filtering/rollback/no-NaN; ни один renderer не владеет копией личности/эмоции/речи.

**Этап T1 — транзакционное переключение (P0)**
- Состояния: `stable → preparing → ready → crossfading → committed`; ошибки: `rollback`.
- Не размонтировать источник до успешного `prepare` целевого.
- Сохранять: speech event/audio clock, expression, gaze target, motor intent, wardrobe ID, поддержанные pose channels.
- Monotonic revision; отмена устаревшего handoff; при несовместимости — безопасный neutral pose + показ ограничений (не выдумывать позу).
- **Гейт T1:** старый renderer доступен до готовности нового; rollback работает при загрузочной ошибке и WebGL loss; устаревший handoff не перезаписывает новое состояние.

**Этап T2 — три адаптера (P1)**
- **Live2D:** map semantic head/gaze/breath/gesture/expression/viseme → существующие Cubism параметры и клипы; читать `ParamAngleX/Y/Z`, `ParamBodyAngleX/Y/Z`, `ParamBreath`, eye/brow/mouth/cheek/tears/rage, hair/coat/tie/shirt/collar physics.
- **Depth2D:** map depth layers, pivots, deformation, limb targets, occlusion; IK elbow/wrist; depth/parallax.
- **VRM3D:** map normalized humanoid bones, expressions, look-at, spring bones, VRMA, IK; применять motor pose после AnimationMixer (bind-pose restore → mixer → motor overlay).
- Legacy/Original — совместимые fallback-режимы, не называть их 2.5D.
- **Гейт T2:** каждый адаптер возвращает `requestedPose`, `appliedPose`, `unsupportedChannels`, `constraintsHit`, `executionStatus`.

**Этап T3 — согласование моделей и capability manifest (P1)**
- На загрузке строить capability manifest из фактически найденных bones/morphs/expressions/clips/garment attachment points.
- Проверять required skeleton topology, rest pose, joint limits, scale, orientation, missing nodes, license metadata.
- Считать capability fingerprint; не переносить pose channels, если rig identity изменился.
- Хранить пользовательские модели локально; не грузить байты модели на сервер без явного согласия.
- **Гейт T3:** manifest отражает фактический rig, а не желаемые возможности; при смене rig — capability negotiation, не «тихая» подмена.

**Этап T4 — качество перехода (P1)**
- Crossfade 150–350 ms (начальный диапазон; измерить на desktop/Android).
- В момент передачи удерживать последнюю подтверждённую позу; не прыгать в rest pose.
- Синхронизировать viseme по единому speech clock: новый renderer получает текущую фазу и audio time, речь не запускается заново.
- Учитывать capability degradation (пальцы/ноги/контакты могут отсутствовать в 2D).
- Сохранять выбранный режим и модель; не сохранять временные animation handles.
- **Гейт T4:** handoff latency, dropped frames, pose discontinuity, speech-clock drift, rollback rate, unsupported-channel rate — измерены и в пределах бюджета.

**Этап T5 — верификация (P2)**
- Unit: schema, stale revisions, capability filtering, rollback, interpolation, no-NaN.
- Integration: Live2D ↔ 2.5D ↔ VRM round-trip с одним snapshot.
- Browser E2E: переключение во время речи, жеста, эмоции, загрузки модели.
- Device E2E: Android low-memory/WebGL loss, orientation change, background/foreground.
- Soak: ≥30 мин циклических переключений без утечек RAF/WebGL contexts/audio sessions/IndexedDB handles.
- **Гейт T5:** все метрики §4.5 в норме.

### 4.5 Критерий 100% для смены тела
1. Все renderer-режимы реализуют один versioned adapter contract.
2. Никакой renderer не владеет отдельной копией личности/эмоций/речи.
3. Switch snapshot не теряет revision, speech event, intent, emotion, gaze, wardrobe selection.
4. Устаревший handoff не может перезаписать более новое состояние.
5. Старый renderer остаётся доступен до успешной готовности нового.
6. Rollback работает при загрузочной ошибке и WebGL loss.
7. Capability manifest отражает фактический rig.
8. Поддержанные каналы достигают заданной точности; неподдержанные явно отчитываются.
9. 2D/2.5D/3D round-trip проходит browser E2E и Android E2E.
10. Выпущенный ZIP собран из проверенного Release source и имеет подтверждённый checksum.

---

## 5. Порядок исполнения и критический путь (до полного завершения)

### 5.1 Фаза 0 — Консолидация и остановка кровотечения (0–2 мес.) — блокирует всё
**Проблема:** 490 веток, `main` без общего предка, diverged интеграционный стек, падающий release gate, license gate 135 записей.

| Шаг | Действие | Критерий |
|---|---|---|
| 0.1 | Зафиксировать одну каноническую `workpass70-source` @ `ad564d18`. Все новые проходы — только от неё | один base SHA во всех PR |
| 0.2 | Собрать 17 аспект-веток (PR #401–424) в один интеграционный стек по зависимостям; снять конфликты номеров (§2) | один integration branch, граф PR без циклов |
| 0.3 | Исправить arch-scanner false-positive: `world-perception-runtime-wiring.mjs` (отрицательные assert'ы на `./WorldContextNormalizer.ts`) и импорт `./embodiment-intent.mjs` в app-тесте | `release:verify` → `ok:true` на CI-режиме |
| 0.4 | Добиться зелёного полного набора 30 workflows на одном SHA | один SHA, все required workflows success |
| 0.5 | Решить `main` ↔ `source`: release-only генерация из source **или** явный migration-план. Blind merge запрещён | документированное решение + скрипт синхронизации |
| 0.6 | Инвентаризация 490 веток → архив мёртвых (не удалять) с манифестом | manifest + список активных |
| 0.7 | Начать license-review (135 записей) как человеческое решение по конкретным хешам | `releaseRedistributionReady: true` |
| 0.8 | Пересобрать Release ZIP из текущего source (сейчас отстаёт на ~500 workpass) | ZIP + SHA-256 + manifest + clean install |

**Гейт Фазы 0:** один канонический SHA; зелёный полный CI на нём; release-архив соответствует этому SHA по manifest/SHA-256; license gate пройден.

### 5.2 Фаза 1 — Реальная модель в реальном цикле (2–5 мес.)
**Проблема:** нет доказательства, что настоящая LLM отвечает через продуктовый путь.

| Шаг | Действие |
|---|---|
| 1.1 | llama.cpp/Ollama отдельным процессом; модель/квантизация по измеренному VRAM/RAM/latency (GTX 1650 4 GB → компактная quantized, ограниченный контекст) |
| 1.2 | Единый typed `LanguageModelProvider`: streaming, cancellation, token accounting, timeout, health check, context budget, structured output, tool proposal, диагностика |
| 1.3 | Маршрут: `user → retrieval → evidence/conflict filter → bounded context → LLM → output validator → action proposal → policy/consent gateway → verified outcome → memory write` |
| 1.4 | LLM не имеет прямого права менять память/идентичность/цели/веса/shell |
| 1.5 | Матрица отказов: 503, timeout, malformed, cancellation, cooldown, fallback, recovery |
| 1.6 | Kill/restart на каждом переходе состояния запроса/действия; отсутствие дублирующих побочных эффектов |

**Гейт Фазы 1:** реальная модель отвечает через runtime; память влияет на ответы; cancellation и restart работают; измерены latency/RAM/VRAM/ошибки; матрица отказов пройдена.

### 5.3 Фаза 2 — Память, которая работает (5–10 мес.) — самое узкое место
**Проблема:** `recallDelta=0`, `not-promoted`. Без памяти нет личности.

| Шаг | Действие |
|---|---|
| 2.1 | Заморозить и захэшировать независимый RU/EN корпус: temporal revisions, парафразы, противоречия, дистракторы, privacy-классы, multi-hop. Train/holdout/temporal split зафиксировать ДО настройки; проверить leakage, дубликаты, обрезанные строки |
| 2.2 | Сравнить baseline (BM25/lexical) с кандидатом на одних и тех же строках: Recall@k, MRR, precision, false-recall, contradiction rate, stale-fact use, coverage, latency |
| 2.3 | Контроли: insertion-order/shuffle, duplicate/replay, cold-memory, no-leakage |
| 2.4 | Забывание/восстановление: supersession, time-valid facts, correction, user-approved deletion, restart, corrupted snapshot |
| 2.5 | p50/p95 latency, heap/RSS, vector count, стоимость индексирования; на мобильном — батарея/нагрев |
| 2.6 | Не повышать hash-projection до «semantic recall» без измеренной пользы (48-мерная hash-projection — не embedding) |

**Гейт Фазы 2:** устойчивый положительный uplift на независимом holdout без регрессии точности/приватности/памяти/задержки. Иначе кандидат остаётся `not-promoted`.

### 5.4 Фаза 3 — Реальное обучение и пластичность (10–18 мес.)
**Проблема:** learning credit существует, но независимый перенос не доказан.

| Шаг | Действие |
|---|---|
| 3.1 | Разделить наблюдение / гипотезу / reward / causal credit / подтверждённый outcome |
| 3.2 | Credit ↔ точный execution/evidence tuple; задержанное подтверждение продвигает запись идемпотентно |
| 3.3 | Для каждого learner: baseline, feature-on/off ablation, counterfactual, multi-seed, held-out задачи, forgetting/transfer/regret/calibration + ресурсная цена |
| 3.4 | Rollback/checkpoint и ограниченный learning rate; правило не подтверждает само себя |
| 3.5 | Раздельно измерять continual learning, retrieval quality и policy quality — не одной цифрой |

**Гейт Фазы 3:** повторяемый выигрыш на независимых задачах, не объяснимый leakage/seed selection; нет критической деградации старых навыков.

### 5.5 Фаза 4 — Реальное действие и внешние доказательства (параллельно 5–14 мес.)
**Проблема:** нет доказанного внешнего действия через ACK-gap/restart.

| Шаг | Действие |
|---|---|
| 4.1 | Состояния: `requested / accepted / observed / verified / contradicted / unknown`; UI и персона не изображают успех без подтверждения |
| 4.2 | Acceptance → ACK gap → SIGKILL/restart → reconnect → duplicate replay → read-after-write → final outcome |
| 4.3 | Внешнее последствие наблюдается независимо; ACK ≠ доказательство |
| 4.4 | Матрица: lost ACK, partial side effect, spoofed evidence, late evidence, contradictory evidence, duplicate delivery, multi-step partial completion |
| 4.5 | Reconciliation после restart: at-most-once где возможно, иначе идемпотентность |

**Гейт Фазы 4:** записанные воспроизводимые E2E-трассы реального действия с измерением, а не изолированные VM/unit-тесты.

### 5.6 Фаза 5 — Воплощение: тело, голос, лицо (параллельно 5–16 мес.)
**Проблема:** реальный browser/Live2D/audio и физический Android не проверены.

| Шаг | Действие |
|---|---|
| 5.1 | Production Vite build + миграция БД на staging + чистая установка зависимостей |
| 5.2 | Browser E2E: boot, reconnect, reload, permissions, API errors, offline, accessibility, desktop+mobile viewport |
| 5.3 | Live2D/TTS: прерывание во время синтеза/воспроизведения, устаревшие callbacks, монотонность audio clock, viseme-границы, focus/device routing |
| 5.4 | Измерить audio-to-mouth offset p50/p95 по реальному audio clock |
| 5.5 | Android/Termux: физическое воспроизведение через единый ActionGateway; прервать конкретный `speechEventId`; независимо доказать, что звук прекратился |
| 5.6 | Смена тела 2D/2.5D/3D по §4 (этапы T0–T5) |

**Гейт Фазы 5:** воспроизводимый E2E в целевых браузерах + физические тесты устройства + round-trip смены тела.

### 5.7 Фаза 6 — Автономия и длительная устойчивость (16–26 мес.)
**Проблема:** инициатива/интерес наблюдались только на синтетике.

| Шаг | Действие |
|---|---|
| 6.1 | Замкнуть цикл: observe → predict/appraise → goal → plan → cost/risk → authorize → execute → verify → credit → consolidate |
| 6.2 | Бюджеты времени/энергии/токенов/памяти; stop, pause, rollback, audit trail, crash recovery |
| 6.3 | Ранжировать цели по обязательствам, ценностям, неопределённости, пользе, стоимости |
| 6.4 | Автономность только в заранее очерченной области; деньги/внешние сообщения/удаление данных/установки — явное согласие |
| 6.5 | 24–72 ч soak: restart, отказы провайдера, давление на хранилище, прерванные действия, latency/RAM/error/thermal |

**Гейт Фазы 6:** длительный автономный прогон, где система сама инициирует, доводит, проверяет и не повторяет побочные эффекты.

### 5.8 Фаза 7 — Идентичность, самосознание-как-функция, выпуск (26–30 мес.)

| Шаг | Действие |
|---|---|
| 7.1 | Каноническое состояние личности: ценности, темперамент, границы, цели, отношения, история, confidence/provenance каждого факта |
| 7.2 | Разделить персону Kurisu (стиль/выражение/визуал) и модель себя NeuroCore (возможности/ограничения/история/неопределённость) |
| 7.3 | Изменения черт — событийные, ограниченные, объяснимые, обратимые |
| 7.4 | Тесты: restart, смена LLM, обновление модели, восстановление snapshot, противоречивые подсказки, adversarial prompt |
| 7.5 | Метрики: consistency, calibrated uncertainty, memory-grounded recall, stable preference under paraphrase, correction uptake, unwanted drift |
| 7.6 | Финальный release: clean-room, SBOM, лицензии, rollback, подписанный артефакт, known-limitations sheet |

**Гейт Фазы 7:** идентичность согласована через restart/model switch; корректно меняется при доказательствах; не маскирует неизвестное выдуманными воспоминаниями; все 8 критериев работают на независимых тестах.

### 5.9 Критический путь

```
Фаза 0 (свести ветки + зелёный CI + лицензии)
      |
      +--> Фаза 1 (реальная LLM в цикле) --> Фаза 2 (доказать память)
      |                                            |
      |                                            v
      +--> Фаза 4 (реальное действие) --> Фаза 3 (доказать обучение)
                                                   |
                        Фаза 5 (тело 2D/2.5D/3D) --+
                                                   v
                                        Фаза 6 (автономия + soak)
                                                   |
                                                   v
                                        Фаза 7 (идентичность + release)
```

**Самое узкое место — Фаза 2** (память): нечему учиться, нечего сохранять, не на чём строить идентичность. **Второе — Фаза 0**: раздробленность и license gate блокируют даже возможность проверить что-либо на одном SHA.

---

## 6. Панель прогресса аспектов (единая сводка)

| № | Аспект | Реализ. | Автопров. | Поле | Релиз | Блокер №1 |
|---|---|---:|---:|---:|---:|---|
| 01 | Когнитивное ядро | 72 | 76 | 20 | 42 | монолит `OrganismCore` + нет long-run/restart-фаз |
| 02 | Восприятие/мир | 64 | 67 | 15 | 32 | observed≠predicted≠simulated в живом цикле |
| 03 | Обучение | 74 | 86 | 18 | 38 | нет независимого переноса |
| 04 | 2.5D depth-rig | 70 | 70 | 5 | 25 | нет production layered art |
| 05 | UserModel | 42 | 41 | 8 | 20 | нет калибровки/red-team |
| 06 | Мотивация/эмоции | 68 | 73 | 15 | 35 | инициатива только на синтетике |
| 07/14 | Аффект/язык тела | 62 | 54 | 8 | 18 | нет реального E2E |
| 08 | Tool governance | 72 | 85 | 20 | 42 | output schemas/timeouts/budgets |
| 09/16 | Голос | 42 | 28 | 0 | 8 | нет реального аудио E2E |
| 10 | Embodied interaction | 60 | 60 | 10 | 25 | нет hand/contact API |
| 11 | Смена тела 2D/2.5D/3D | 55 | 45 | 5 | 15 | нет adapter lifecycle/transactional switch |
| 12 | Релиз/надёжность | 55 | 70 | 20 | 30 | license 135 + нет ZIP/soak/E2E |
| 13 | Моторные профили | 65 | 70 | 10 | 25 | нет production-калибровки/readback |
| 15 | Гардероб | 60 | 65 | 5 | 10 | нет real art/Live2D swap |
| 17 | Original 2D арт | 55 | 50 | 5 | 15 | нет layered master |

**Итог по проекту (взвешенно, из §1.4):** реализация **66,6%**, автопроверка **72,4%**, поле **17,4%**, релиз **34,9%**.

---

## 7. Definition of Done — глобальный (жёсткие финальные ворота)

1. Один канонический source SHA и чистая установка (проверено: install/typecheck/build/254 теста PASS).
2. Production build и миграции/restore/rollback пройдены.
3. Unified cognitive runtime проходит целевой цикл, interruption и process restart.
4. Память даёт независимый измеримый uplift (`recallDelta > 0`), корректное забывание, отсутствие неприемлемого unsupported retrieval.
5. Обучение показывает проверяемый transfer/retention gain; кандидаты не активируются без независимого evidence gate.
6. Hexis evidence сохраняется в единственной канонической памяти, не меняя доверие/убеждения самовольно.
7. SelfModel/UserModel/motivation/EthicalGate реально участвуют в живом runtime.
8. Реальные browser/Live2D/voice и Android/Termux E2E пройдены.
9. Смена тела 2D/2.5D/3D: round-trip без потери состояния, rollback, capability honesty (§4.5).
10. Независимый verifier/scanner и реальная OS/container sandbox проверены.
11. 24–72 ч soak, recovery, privacy, license/SBOM/security review закрыты.
12. Новый Release ZIP воспроизводимо собран, имеет manifest/SHA-256 и установлен на чистой машине.
13. README, CHANGELOG, tracker, release metadata и тестовая доказательная база совпадают.

---

## 8. Правила исполнения (не нарушать)

1. **Не имитировать готовность:** отчёт, заглушка, мок и существующий файл не доказывают работающую возможность.
2. **Не плодить мозги:** один авторитетный runtime, одно состояние, один жизненный цикл памяти; внешние проекты — через адаптеры.
3. **Один владелец на возможность.** Никаких вторых memory store / planner / action gateway / renderer-state owner.
4. **Гейт нельзя повысить тестом.** `IMPLEMENTED` ≠ `PROVEN`. Оценка растёт только по независимому внешнему измерению.
5. **Не объявлять успех без SHA и логов:** точная версия кода + тесты, реально запущенные на ней.
6. **Мораторий на новые подсистемы,** пока поле < 50%; исключение — компонент, снимающий конкретный незакрытый gate.
7. **Не выпускать неизвестное как готовое:** при непройденном обязательном gate — `BLOCKED` / `UNVERIFIED`.

---

## 9. Научная честность (чего нельзя обещать)

- **Субъективное сознание / «квалиа»** — нет проверяемого определения и теста; проект правильно помечает `UNKNOWN / UNRESOLVED`.
- **AGI уровня человека** — нет доказанного пути и сроков; планируем уровни автономии, не дату.
- **«Понимание» в философском смысле** — проверяем поведение, не внутренний опыт.
- **Биологическое соответствие** — «гиппокамп» в коде есть аналогия, не гиппокамп.

Что можно обещать и измерить: непрерывная память, инициатива, обучение на опыте, перенос, проверка последствий, устойчивая идентичность, выразительное тело и переключаемое 2D/2.5D/3D-тело.

---

## 10. Первые 90 дней (конкретно)

**Недели 1–3 — Фаза 0, часть 1**
- Инвентаризация 490 веток; определить каноническую `workpass70-source` @ `ad564d18`.
- Собрать 17 аспект-веток в один интеграционный стек; снять конфликты номеров (§2).
- Исправить arch-scanner false-positive → `release:verify ok:true`; получить зелёный полный CI на одном SHA.

**Недели 4–6 — Фаза 0, часть 2 + старт Фазы 1**
- Решение по `main` ↔ `source`; migration-план или release-only генерация.
- Начать license-review (135 пунктов): корень, runtime, npm-инвентарь, архивы.
- Поднять llama.cpp отдельным процессом; первые замеры latency/RAM/VRAM.

**Недели 7–10 — Фаза 1**
- Единый `LanguageModelProvider`; маршрут через retrieval/validator/gateway.
- Матрица отказов: 503/timeout/malformed/cancel/cooldown/fallback/recovery.
- Restart/kill на переходах; проверка отсутствия дублирующих эффектов.

**Недели 11–13 — старт Фазы 2**
- Заморозить независимый RU/EN корпус; зафиксировать split; проверить leakage.
- Первый честный замер baseline vs candidate с интервалами неопределённости.
- Отчёт по метрикам; ревизия плана.

**Definition of Done 90 дней:** один канонический SHA с зелёным CI; release-архив соответствует SHA; реальная LLM отвечает через runtime; замороженный holdout готов; license-review начат и не заблокирован неизвестностью; 2D/2.5D/3D adapter contract (T0) реализован и покрыт unit-тестами.

---

## 11. Итог одной фразой

NK1 нужно не строить заново и не расширять, а **довести до доказанности**: свести ветки и получить один зелёный SHA, подключить реальную модель, доказать память и обучение на независимых данных, подтвердить действие и тело (включая честную смену 2D/2.5D/3D) на реальном устройстве и держать идентичность через перезапуски. Каждый шаг закрывает измеримые ворота, а не добавляет красивый модуль.
