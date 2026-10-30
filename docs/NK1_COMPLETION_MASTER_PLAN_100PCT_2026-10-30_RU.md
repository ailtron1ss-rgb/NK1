# NK1 — мастер-план завершения до 100%

**Дата среза:** 2026-10-30  
**Канонический исходный ref:** workpass70-source  
**Проверенный source SHA:** ad564d1879028f00549be41ec5172a2f72e25897  
**Плановая ветка:** planning/nk1-completion-100pct-2026-10-30

Документ является единым исполняемым backlog от текущего состояния до проверенного продукта. Перечисление незакрытой функции здесь не означает, что она уже реализована.

---

## 1. Что считать 100%

NK1 завершён, когда один и тот же организм непрерывно работает через runtime, приложение, память, речь и сменяемое тело; может самостоятельно инициировать ограниченные действия; учится только на проверяемых результатах; восстанавливается после перезапуска; а воспроизводимая сборка проверена на целевых устройствах и опубликована.

Для каждого аспекта ведутся два показателя:

- **Реализация** — код, контракты, интеграция и интерфейс присутствуют.
- **Доказанность** — тесты на конкретном SHA, работающий сквозной сценарий, полевое подтверждение там, где оно необходимо.

Критерий 100%: все P0/P1 требования имеют владельца состояния, сквозной acceptance-сценарий, воспроизводимую проверку и эксплуатационный fallback. Неподдерживаемые аппаратные возможности должны быть явно обозначены как unsupported, а не имитироваться.

Субъективное сознание не входит в проверяемые обещания: вопрос научно не разрешён. Проект оценивается по наблюдаемой памяти, непрерывности, инициативе, адаптации, поведению и надёжности.

## 2. Состояние исходной базы и ограничения

1. workpass70-source — актуальная рабочая кодовая база. main — линия публикации, отчётов и release workflow. Не переносить изменения между ними автоматически.
2. Последний найденный GitHub Release — workpass70-hotfix1-2026-10-19, ZIP Neuro_Kurisu_WORKPASS70_HOTFIX1_2026-10-19.zip, размер 136,354,713 байт, SHA-256 9effadfcf0d402b462dd9cf2fd5b5793742039c9260db80578be830952bf52eb. Он старше текущей исходной базы на 11 дней; не считать его текущей сборкой.
3. В дереве присутствуют единый когнитивный runtime, несколько уровней памяти, P23/P26 learning lifecycle, P41 world-perception, governed tool execution, voice/Live2D, Original SVG 2D и процедурный Three.js/VRM import.
4. Последние ветки содержат полезные, но не все интегрированные улучшения: body switching, 2.5D depth-rig, эмоциональный body language, модульный гардероб, моторный контроллер, unified voice prosody.
5. Ветка 2.5D добавляет программную/математическую основу, но в исходном дереве не найден готовый авторский комплект послойных PSD/Blender/GLB-ресурсов. Это не завершённая художественная 2.5D-модель.
6. Текущий 3D режим имеет процедурное тело-концепт и локальный импорт VRM/GLB. В дереве не найден лицензированно подтверждённый канонический Kurisu VRM/GLB. Наличие импортёра не равно готовому 3D-аватару.
7. contracts/RELEASE_LICENSE_REVIEW.json имеет статус pending. Worklist от 2026-10-28 содержит 135 незакрытых review-полей/решений. Это реальный блокер распространения; статусы не менять без подлинной человеческой проверки.
8. В В PR #406 и #411 были ошибки TypeScript; исправлены отдельными коммитами 2026-10-30. На новых SHA #406 core regression и остальные возвращённые проверки завершились успешно. #411 прошёл affective-expression validation и core regression; WorkPass110 metrics ещё выполнялся на момент последнего опроса. Эти результаты подтверждают устранение синтаксических блокеров, но не заменяют browser/Android visual E2E.

В проектном документе от 2026-10-29 указана внутренняя самооценка на тот момент: механизмы/интеграция 66.6%, автоматические проверки 72.4%, независимые полевые доказательства 17.4%, release readiness 34.9%. Это историческая самооценка проекта, не свежий независимый аудит.

## 3. Предварительная оценка аспектов

Это инженерная оценка по текущей базе, открытым PR, changelog и доступным CI evidence. Первая цифра — зрелость реализации; вторая — сквозная доказанность. Это не измеренная научная метрика.

| № | Аспект | Реализация | Доказанность | Основной остаток |
|---:|---|---:|---:|---|
| 01 | Единое когнитивное ядро и цикл | 80% | 55% | полный lifecycle, crash/restart, владение state |
| 02 | Память и автобиография | 75% | 35% | независимый RU/EN recall holdout, забывание, restore |
| 03 | Обучение и саморазвитие | 75% | 45% | measured uplift на paired seeds и внешнем holdout |
| 04 | Личность, SelfModel, UserModel | 60% | 25% | доказательная история, стабильность черт и ToM |
| 05 | Эмоции, мотивация, гомеостаз | 60% | 30% | appraisal→drive→action→outcome→learning |
| 06 | Восприятие мира | 75% | 30% | реальные сенсоры, размеченные данные, calibration |
| 07 | Инициатива и автономность | 60% | 25% | самостоятельные эпизоды и liveness на устройстве |
| 08 | Инструменты, безопасность и политика | 70% | 35% | gateway E2E, permission/receipt/rollback |
| 09 | Голос и диалог | 70% | 35% | Android voice E2E, interrupt/latency, acoustic alignment |
| 10 | Взаимодействие с внешним миром | 30% | 10% | capability adapters и independent postconditions |
| 11 | Общая архитектура тела и переключение | 55% | 15% | единый body-state, миграция и renderer handoff |
| 12 | Original 2D / Legacy sprites | 70% | 45% | визуальный QA, mobile/browser E2E, asset provenance |
| 13 | Live2D | 75% | 40% | exact-head typecheck, browser/Android playback, lip-sync |
| 14 | 2.5D | 35% | 5% | production depth-rig, оригинальные слои, art pipeline |
| 15 | 3D / VRM / GLB | 50% | 15% | канонический rigged model, retarget, facial rig, LOD |
| 16 | Моторика / IK | 45% | 15% | общий joint-space, IK adapters, motion receipt |
| 17 | Одежда / аксессуары | 35% | 5% | совместимые wardrobe packs для renderer types |
| 18 | Мобильный runtime и эксплуатация | 50% | 20% | Android soak, аудио, память, thermal/performance |
| 19 | Наблюдаемость, benchmark и качество | 60% | 25% | независимые оценки, dashboard и воспроизводимые отчёты |
| 20 | Сборка, лицензии и Release | 25% | 5% | human license review, clean build и новый ZIP |

Не складывать строки в общий средний балл: у аспектов разные веса и критичность. Для выпуска используются gates, а не среднее арифметическое.

## 4. Целевая архитектура: один мозг, сменяемое тело

### 4.1 Единственный источник состояния

- OrganismCore/OrganismSnapshot владеет когнитивным состоянием: цели, эмоции, внимание, действия, убеждения, память, речь, self/user model.
- EmbodimentRuntime владеет только производным состоянием исполнения: текущая поза, сглаженные каналы, активный renderer, физические ограничения, локальный rig state.
- UI не создаёт альтернативную эмоцию или личность. Он визуализирует состояние Core.
- OrganismBus/системные порты обеспечивают обмен событиями. Не добавлять прямые импорты независимых подсистем в обход контрактов.

### 4.2 Единый контракт тела

Развить существующий EmbodimentIntentV1 эволюционно, с миграцией и обратной совместимостью. Следующая версия должна покрывать:

- версию схемы, organism/session ID, monotonic sequence, timestamp и TTL;
- semantic intent: idle, attend, think, speak, explore, verify, rest, respond, interact;
- эмоциональные и лицевые каналы: expression, valence/arousal, brows, eyes, blink, cheeks, mouth;
- gaze target/direction, head/torso posture, gesture и body language;
- joint-space targets и ограничения суставов, когда renderer их поддерживает;
- viseme/phoneme timeline, speech phase, cancellation и emphasis;
- hair/cloth secondary motion и wardrobe layers;
- capabilities каждого renderer, unsupported channels и quality profile;
- confidence/provenance intent, acknowledgement и execution receipt.

Адаптер обязан вернуть фактическое принятие/отказ/частичную поддержку. При переключении нельзя обещать точное отображение каналов, которых целевой рендерер не поддерживает.

### 4.3 Режимы тела

| Режим | Технология | Реальная роль |
|---|---|---|
| 2D | Original SVG, Legacy sprites, Live2D Cubism | лёгкий режим, лицо/эмоции/простые жесты |
| 2.5D | слоистое изображение + depth-rig + pivots + parallax + spring dynamics | художественный гибрид, движение частей независимо |
| 3D | Three.js + VRM/GLB + humanoid rig + blendshapes + IK | полный скелет, позы, анимации и расширяемая моторика |

Все три режима читают одно состояние организма. Переключение меняет renderer и его capabilities, а не мозг, память, эмоции, текущую речь, личность или цель.

### 4.4 Транзакция переключения

1. Сохранить canonical BodyState и текущий speech/gesture timeline.
2. Проверить, что новый renderer загружен и прошёл capability validation.
3. Получить профиль соответствия каналов; unsupported каналы явно отметить.
4. Передать snapshot и sequence watermark новому renderer.
5. Принять acknowledgement только после фактического применения state.
6. Коротко синхронизировать старый и новый renderer, затем атомарно переключить active renderer.
7. При ошибке сохранить старый renderer; не сбрасывать организм и не подтверждать переход.
8. Записать receipt с renderer ID, rig fingerprint, channel coverage, latency и причиной fallback.

Цели тестов: не терять состояние при переключении; не принимать устаревшие sequence; не дублировать речь/жесты; уметь восстановить предыдущий renderer; не сообщать об успешном движении без подтверждённого исполнения.

## 5. План по аспектам и Definition of Done

### A01. Когнитивное ядро и единый жизненный цикл — P0

**Работы**
- Завершить единый OrganismRuntime → Perceive → Appraise → Plan → Act → Reflect → Consolidate цикл.
- У каждого persisted state — единственный владелец и единый projection/restore path.
- Закрыть atomicity/idempotency между Core, event fabric, outcome/evidence, learning journals и snapshots.
- Все event envelopes ограничены схемой, временем, размером и происхождением.
- Проверить migration whitelist, восстановление после прерывания на каждом участке цикла и повторный callback.
- Свести duplicate engines и обходные импорты; карта зависимости должна соответствовать реальным call paths.

**Готово, когда**
- 10,000 deterministic ticks на фиксированных seeds без нарушения инвариантов.
- Crash injection на каждом этапе: восстановление без потери подтверждённого опыта и без повторного side effect.
- Tick performance соответствует бюджету на Android; degraded mode не блокирует основной диалог.
- Один end-to-end trace связывает входное событие, решение, действие, outcome, consolidation и следующий цикл.

**Кандидаты:** PR #422, включённые ownership/restart изменения, архитектурный контракт и workflow.

### A02. Память, recall и непрерывность — P0

**Работы**
- Сохранить 4 уровня: рабочая, эпизодическая, семантическая, процедурная; связать с MemFS и consolidation.
- Единая память опыта, фактов, отношений, предпочтений и навыков; источники/время/уверенность/срок годности обязательны.
- Mem0/Letta/Hermes/Hexis использовать через адаптеры в канонический memory ingress, без параллельных автономных хранилищ.
- Поддержать retrieval по смыслу, времени, сущности, причинной связи и цели.
- Добавить явное забывание, supersession, conflict quarantine, correction, privacy export/delete.
- Исправить stale index, semantic vector mismatch, duplicate evidence ID и restore identity.
- Встроить autobiographical recall так, чтобы неподтверждённое событие не становилось проверенным фактом.

**Готово, когда**
- Не менее 5 paired seeds на неизменяемом RU/EN holdout; отдельные наборы seen/novel/unanswerable.
- Recall uplift над baseline practically значим; нет ухудшения abstention/false memories.
- recallDelta > 0 на независимом holdout; публикуются raw results, cost/latency, forgetting и failure cases.
- Restore/restart и multi-session recall сохраняют lineage.

**Кандидаты:** PR #389, #388/#397, memory restore/retrieval fixes, текущая canonical Hexis/Mem0 интеграция.

### A03. Обучение и саморазвитие — P0

**Работы**
- Один canonical P23 lifecycle: verified outcome → diagnosis → curriculum → candidate → isolated run → independent evaluation → approval → activation → post-activation monitoring/rollback.
- Разделить создание, тестирование, human approval и активацию навыка.
- Сохранить holdout blindness: оптимизатор не получает holdout scores/labels/direction.
- Включить GEPA/DSPy/Hermes-подобную ревизию как генератор кандидатов, а не отдельного агента.
- Оценивать task success, trajectory, skill quality, transfer, robustness, forgetting, cost.
- Строгая provenance, source fingerprint, signed evidence, rollback и quarantine.
- Учиться только на допустимых outcome receipts; model output или непроверенный feedback не считается истинным результатом.

**Готово, когда**
- 5+ paired seeds, независимые verifier/scanner, неизменяемый holdout.
- Есть прирост на unseen задачах и cross-context transfer без ухудшения safety.
- Ошибка вызывает diagnosis → кандидат → shadow run → независимую оценку → staged promotion или отказ.
- Проверены forgetting, negative transfer, rollback и recovery после рестарта.

**Кандидаты:** PR #401 и #403, PR #420 — восстановление holdout integrity; точный CI повторить на последнем HEAD.

### A04. Личность, SelfModel и UserModel — P0

**Работы**
- Стабильное ядро черт: сарказм, самостоятельность, воля, интеллектуальная любознательность, осторожность/забота; это параметры поведения, не фиксированные сценарии реплик.
- Разделить trait, mood, emotion, role, relationship state и временный стиль общения.
- SelfModel хранит возможности, ограничения, цели, ошибки, историю решений и уверенность.
- UserModel/ToM содержит только обоснованные предпочтения/контекст; гипотезы помечаются как гипотезы и могут быть исправлены пользователем.
- Автобиографические turning points создаются только из доказанного опыта; авторство user-directed/self-initiated различается.
- Модель отношений меняется медленно, с доказательствами и возможностью пересмотра.

**Готово, когда**
- Профиль сохраняется после restart/migration и не дрейфует от случайного prompt.
- Однотипные ситуации дают узнаваемый характер, но содержательно адаптивные ответы.
- Неверная гипотеза о пользователе корректируется, а отсутствие данных приводит к уточнению/неуверенности.
- Все autobiographical claims трассируются до episode/evidence IDs.

**Кандидаты:** PR #399 и #394; rebase/merge только после проверки lineage и актуальных regression.

### A05. Эмоции, мотивация и гомеостаз — P0

**Работы**
- Свести affect appraisal, mood dynamics, interoception/homeostasis, intrinsic motivation и goal ecology.
- Закрыть причинную трассу: appraisal до действия → drive → goal candidate → selected action → measured consequence → credit assignment в тот же emotion/episode ID.
- Состояния: valence/arousal, curiosity, frustration, confidence, stress/load, fatigue/energy, social need; добавить hysteresis, decay, bounded ranges.
- Эмоция меняет внимание, стоимость/приоритет действий, память, речь и экспрессию, но не отменяет правила безопасности.
- Ввести recovery/rest/homeostasis, чтобы система не застревала в стрессе/бесконечной активности.

**Готово, когда**
- Контролируемые сценарии показывают разные реакции, корректное затухание и восстановление.
- Outcome учит только исходный appraisal ID, а не постфактум созданное состояние.
- Сильное возбуждение не вызывает эскалации risky tools или принудительного действия.
- Состояние сохраняется и правильно восстанавливается после сна/restart.

**Кандидаты:** PR #400 + affective expression PR #411; требуется синхронизация divergent branches.

### A06. Восприятие мира и grounding — P0

**Работы**
- Канонический P41 ingress для camera/audio/sensors/user input; timestamp, frame, modality, source ID и provenance обязательны.
- Отдельно хранить observation, interpretation, claim, corroboration и verified fact.
- Стабильные object IDs, coordinate frames, scene graph, tracking, freshness and confidence.
- Слияние модальностей только при доказуемом временном/пространственном соответствии.
- Unknown/occluded/stale/malformed sensor input — неизвестно, не домысливать нулём.
- Active perception выбирает следующий безопасный взгляд/запрос по information gain.
- Калибровка только по human/independent outcome evidence, с replay protection.

**Готово, когда**
- Browser/device camera E2E на размеченных наборах, known/unknown/occluded, identity continuity, timestamp drift и ambiguous tracks.
- Точность и calibration публикуются отдельно от заявленной моделью уверенности.
- Отсутствующий сенсор не симулируется как успешное наблюдение.

**Кандидаты:** P41 уже включён; PR #423 и world-perception tests; физический labelled dataset остаётся обязательным.

### A07. Инициатива и автономность — P0

**Работы**
- Внутренние imperatives из незакрытых целей, интереса, новизны, uncertainty, prediction error и homeostasis.
- Scheduler с quiet hours, cadence, resource budget, backoff, cooldown и user attention budget.
- До инициативы — policy appraisal: есть ли ценность, разрешено ли прерывать, есть ли достаточная уверенность.
- Сохранять объяснение «почему сейчас», выбранные альтернативы и ожидаемый результат.
- Вводить инициативы в очередь; пользователь может отключить/ограничить/отложить их.

**Готово, когда**
- На длительном soak инициатива возникает без входного prompt, но не спамит и не прерывает ограничения.
- На каждом инициированном эпизоде есть цель/причина/отмена/результат.
- Невыполненная цель возобновляется после restart без дублирования.

### A08. Инструменты, безопасность и управляемое действие — P0

**Работы**
- Все tool calls только через ActionGateway и ToolInputContract; строгая schema validation, size/time limits, allowlist и capability.
- Разделить propose/authorize/execute/verify; доверие к tool output не автоматическое.
- Permission scopes: read/write/network/device/physical; least privilege и явное подтверждение опасных действий.
- Idempotency keys, action receipts, preconditions/postconditions, timeout/cancel/rollback.
- Safe mode при неизвестном происхождении, conflicting signals, повреждённом restore или отсутствующей capability.
- PEA/EthicalGate/semantic output gate должны быть одним рабочим предикатом и логироваться без чувствительных payloads.

**Готово, когда**
- Negative tests на injection, malformed input, stale approval, replay, cross-user context, tool spoofing и privilege escalation.
- Никакой план/симуляция не выдаётся за выполненное физическое действие.
- Отмена и rollback доказаны для каждого поддерживаемого класса действий.

**Кандидаты:** PR #424, #414, существующий ActionGateway и evidence receipt work.

### A09. Голос, диалог и аудиосинхронизация — P1

**Работы**
- Единый VoicePlan для runtime, browser и Android: язык, темп, pitch, prosody, pauses, emotion, voice register, fatigue/load.
- Профили голоса Курису (обычный, научный, саркастичный, мягкий, раздражённый, задумчивый) — как параметры исполнения, без подмены личности.
- Speech timeline с utterance ID, token/phoneme/viseme events, pause, interrupt/cancel и renderer sequence.
- TTS backend adapters: основной provider/локальный provider и fallback, ясно обозначая качество и latency.
- Не выдавать grapheme-derived visemes за точную phoneme/acoustic alignment.

**Готово, когда**
- Android и browser проходят одни и те же voice-plan fixtures.
- Interrupt <200 ms target; mouth/audio drift ≤80 ms target на поддерживаемом backend.
- Проверены RU/EN, длинная речь, паузы, смена языка, cancel, background/foreground и восстановление.

**Кандидаты:** PR #413 и текущий Live2D voice pipeline.

### A10. Интеракция с внешним миром — P1

**Работы**
- Planner преобразует grounded object/scene target в look/inspect/reach/touch/grasp/release/press.
- Перед планированием проверять confidence, freshness, affordance, distance/reach, availability of effector and hazard policy.
- На каждый physical action нужен реальный device/robot adapter и независимый postcondition verifier.
- Simulator — только тест планирования, никогда доказательство действия в реальном мире.

**Готово, когда**
- Все действия проходят end-to-end через разрешённый adapter, с наблюдаемой постусловной проверкой.
- Неизвестный объект/опасная affordance/нет адаптера → abstain.
- Receipt связан с первоначальным plan ID и target ID.

**Кандидат:** PR #414; текущая реализация — planner/assessment, не полный физический исполнитель.

### A11. Общая архитектура тела и renderer switching — P0

**Работы**
- Утвердить versioned BodyState/EmbodimentIntent contract.
- Единые capability profiles: Original SVG, sprites, Live2D, DepthRig 2.5D, Three.js procedural, VRM/GLB.
- Свести AvatarStage к orchestration и адаптерам; renderer не владеет эмоциями/памятью/речью.
- Атомарная смена renderer с handoff snapshot, sequence watermark, capability mapping, ack, rollback.
- Сохранять одежду, масштаб, позу, gaze, эмоцию, действие и речь; несовместимое состояние отображать как degraded capability.

**Готово, когда**
- Тесты переключают все поддерживаемые пары renderer туда-обратно без утраты canonical state.
- Устаревшие события после switch игнорируются.
- Падение нового renderer возвращает старый режим; организм продолжает работу.

**Кандидаты:** PR #415, #405 и #410. Это не один merge: выбрать согласованную последовательность.

### A12. Original 2D / Legacy sprites — P1

**Работы**
- Сохранить режимы как лёгкий fallback.
- Авторский SVG разбить на управляемые facial/clothing/pose channels, проверить clipping/masks/responsiveness.
- Исправить соответствие sprite manifest реальным картинкам; семантические позы для think/rest/explore/verify/respond/wait.
- Модульные expression/pose/outfit packs с проверкой размеров, hashes и license provenance.
- UI controls: выбрать тело/выражение/позу/одежду, сброс, сохранить per-device.

**Готово, когда**
- Все manifests имеют визуально проверенные assets; отсутствие asset не приводит к ложному успеху.
- Browser/mobile screenshot and interaction matrix проходит.

**Кандидаты:** PR #407, включённые WorkPass618/620/622, artwork pipeline.

### A13. Live2D — P1

**Работы**
- Закрыть protocol mismatch между AvatarStage и viewer; monotonic state version, validated motion/parameter groups.
- Все параметры применять на правильной Cubism update boundary, не перетирая authored motion/physics.
- Эмоции → face parameters, head/eye gaze, mouth visemes, breath, hair/clothes physics.
- Новые motion clips добавлять только после проверки фактического model inventory; не выдумывать отсутствующие анимации.
- Проверить FORCE priority на speech cancel, reconnect, reload, mobile lifecycle.
- Добавить visual regression snapshots по выражениям и позам.

**Готово, когда**
- Реальная модель стабильно отображает эмоцию/речь/взгляд и action intent; нет скачков/застревания.
- Speech cancellation, lip-sync, DPR/performance и touch controls проходят browser + Android.

**Кандидат:** PR #406 после исправления TS, актуальные Live2D fixes и CI.

### A14. 2.5D Depth Rig — P1

**Работы**
1. Зафиксировать art specification: фронтальный/3/4 angle, scale, pivot convention, texture resolution, masks и naming.
2. Создать авторские слои: rear hair, face/back hair, face base, eyes, brows, mouth, neck, torso, upper/lower arms, hands, front hair, coat, shirt/tie, accessories.
3. Для каждого узла задать stable ID, parent, pivot, rest transform, z/depth, parallax limits и visibility/mask.
4. Blender/GLB export pipeline с deterministic naming, texture packing и metadata.
5. Подключить validated depthRig.ts и Three.js adapter, не дублируя canonical BodyState.
6. Реализовать head/eye/torso/arm IK, gaze, breathing, blink, face morph, hair/cloth springs и occlusion.
7. Добавить mobile LOD/texture budgets, asset cache, graceful fallback to Live2D/2D.
8. Проверить исходные artwork/asset licenses до Release.

**Готово, когда**
- Есть реальная авторская слоистая модель, не только rig schema или демо.
- Любая поза/движение выдерживает occlusion, pivots и допустимые деформации.
- Результат выглядит непрерывным при gaze, torso, limb, breathing и secondary motion.
- Отсутствующий/невалидный слой отвергается атомарно.

**Кандидаты:** PR #408 — единственный canonical 2.5D runtime по архитектурному решению, зафиксированному в PR #415. PR #409 использовать только как источник выборочного переноса требований (например, pivot/rest-transform), не выпускать его параллельную схему. Подключить PR #407/artwork pipeline. Не объединять альтернативные depth-rig ветки вслепую.

### A15. 3D / VRM / GLB — P1

**Работы**
- Определить авторский/лицензированный Kurisu-compatible VRM/GLB master asset.
- Humanoid bone map, bind-pose/scale normalization, retarget, root motion, clips, facial morphs/expressions.
- Добавить rig validation: required bones, duplicate IDs, rest pose, limits, mesh/material/textures, missing morph targets, animation compatibility.
- Renderer-neutral motor controller + joint-space/IK adapters, constraints и retarget profiles.
- LOD, frustum culling, texture compression, mobile GPU caps, WebGL loss/reload recovery.
- Local model vault (IndexedDB) с fingerprint, size budget, validation, delete/reset и no server upload by default.
- Регистрировать provenance/permissions каждого внешнего VRM/GLB.

**Готово, когда**
- Реальная модель с humanoid rig/face morphs корректно импортируется, сохраняется, проигрывает motions и отражает canonical state.
- Проверены низкопроизводительные Android devices, WebGL context loss и invalid model cases.
- Процедурная модель остаётся честным preview/fallback, не выдаётся за production Kurisu avatar.

### A16. Моторика, body language и гардероб — P1

**Работы**
- Общий joint-space motor planner, goal arbitration и constraints, renderer adapters per capability.
- Проверить joint bounds, velocity/acceleration/jerk, collision proxies, reachable workspace, stop/cancel.
- Body language: stance, arm openness, shoulder tension, torso lean/roll, head micro-motion, gaze engagement, stillness/tempo.
- Отдельная expressive layer additive over authored animation; предотвращать накопление transforms.
- Wardrobe packs для Live2D/2.5D/3D: capability manifest, rig binding, texture/morph compatibility, layers, colorways, authoring preflight, safe fallback.
- Одежда и аксессуары не должны менять canonical motor state.

**Готово, когда**
- Один gesture intent даёт безопасно сопоставимое движение во всех поддерживаемых renderer.
- Невозможные суставы/клипы/одежда корректно отклоняются, а не ломают renderer.
- Garment swaps сохраняют pose/identity и не нарушают skinning/occlusion.

**Кандидаты:** PR #410, #405, #411 и #412.

### A17. Mobile runtime и эксплуатация — P0

**Работы**
- Один воспроизводимый Docker Compose local stack + documented Android/Termux install/start/doctor/backup/restore.
- Node pin 24, locked dependencies; не допускать root vs app/runtime lockfile mismatch.
- Lifecycle: foreground/background, sleep/wake, network loss, TTS interruptions, app process kill, restart.
- Resource budgets: memory, CPU, GPU, battery, thermal, storage, local model limits; scheduler адаптирует нагрузку.
- Crash report / redacted logs / telemetry opt-out / export and delete.
- SQLite/file persistence, schema migrations, backup rotation and recovery validation.

**Готово, когда**
- Чистая установка с нуля поднимается одной documented command.
- Android soak 24h+ с restart, background, speech, memory retrieval, body switching; нет потери подтверждённого состояния.
- При offline/low-memory работает degraded mode и корректное восстановление.

### A18. Валидация, метрики и safety — P0

**Работы**
- Разделить unit, contract, integration, browser E2E, Android/device E2E, soak, performance, security, independent holdout.
- Каждый тест/артефакт привязан к exact source SHA, Node pin, lockfile fingerprint, device/browser profile.
- Dashboard: initiative rate, memory recall/abstention, retrieval latency/cost, learning uplift/forgetting/transfer, cycle tick latency, crash/recovery, speech interrupt/lip drift, renderer channel coverage.
- Deterministic replay + paired seeds; независимый verifier/scanner и immutable receipts.
- Safety: policy coverage, permissions, tool denials, unsafe output, false claim of action, user override.
- Никакого self-reported model confidence вместо ground truth; отдельно отчёт model/service success и empirically verified accuracy.

**Готово, когда**
- Полный CI на release candidate exact SHA, затем browser and Android E2E + soak.
- Пороговые метрики определены заранее; regressions блокируют release.
- Для каждого fail есть воспроизводимый artifact/log и owner.

### A19. Релиз, лицензии и provenance — P0 блокер выпуска

**Работы**
1. Обновить SOURCE_PROVENANCE, SBOM, dependency fingerprints, repository LICENSE/NOTICE inventory на exact source SHA.
2. Получить настоящие human review решения по root/runtime license, locked dependencies, source archives, vendored licenses и assets.
3. Для каждого решения записать reviewer, date, evidenceRef, expression, approved/denied and exact hash.
4. Не принимать automated scanner hit как legal approval и не ставить approved без фактического review.
5. Запустить npm run test:provenance-current, npm run audit:release-license-readiness и production build.
6. Сформировать ZIP из проверенного source ref; включить manifest, changelog, build metadata, SHA256SUMS, SBOM/provenance and user instructions.
7. Проверить архив: clean extraction, install, launch, health check, update/restore, asset integrity, no missing secrets.
8. Только после этих gate создать новый Release; отдельно проверить asset URL, digest и опубликованный SHA.

**Готово, когда**
- License gate passed по реальному человеческому review.
- Release ZIP построен из того же exact SHA, что прошёл tests and build.
- SHA256 совпадает при повторном скачивании и распаковке; опубликованный release содержит полный manifest.
- Не писать «Release updated», пока asset появился в Releases и digest проверен.

## 6. Очерёдность интеграции открытых изменений

Порядок — зависимости, не механическое слияние всех PR:

1. **Стабилизировать когнитивную основу:** PR #422 и текущие ownership/restart regressions; проверить holdout integrity #420.
2. **Память и outcome provenance:** #389, #388/#397, связанные retrieval/restore fixes.
3. **Learning:** #401/#403 после rebase на текущий source, exact-head CI, затем paired-seed/holdout evidence.
4. **World grounding и tool governance:** #423 и #424, затем #414 planner.
5. **Personality + emotion:** #399/#400 — divergent branches, rebase/cherry-pick по функциональным единицам, не whole-branch merge.
6. **Renderer contract + motor:** #405 и #410 вместе с #415; один владелец motor state, capabilities и handoff receipts.
7. **2D/Live2D:** #407, #406 и #411 после exact-head typecheck/browser E2E.
8. **2.5D:** сравнить #408 и #409; выбрать один основной depth-rig путь; подключить artwork pipeline.
9. **3D + wardrobe:** текущий 3D base, #412 и 3D artwork/rig after compatibility + licensing.
10. **Voice:** #413; unified prosody and speech timeline across browser/Android/renderers.
11. **Release reliability:** aspect12 release gates; license review не обходить.
12. **Release packaging:** ZIP, checksum, smoke, publish.

PR #406 и #411 получили точечные TypeScript fixes 2026-10-30: в #406 восстановлен b.head.rotation.z; в #411 исправлено вычисление условной скорости animation clip. После этих fixes #406 core regression завершился success; #411 affective-expression validation и core regression завершились success, WorkPass110 metrics оставался in_progress на последнем опросе. Не считать аспект полностью закрытым до завершения всех exact-head jobs и browser/Android E2E.

## 7. Критические зависимости и запреты

- Нельзя считать 2.5D готовым, пока нет настоящего послойного artwork и проверенного rig; runtime math сам по себе не производит художественные слои.
- Нельзя считать 3D готовым, пока нет канонической лицензированной humanoid model и проверенного bone/morph mapping.
- Нельзя считать моторное действие исполненным по созданному плану, отправленной команде или симуляции; нужен независимый receipt.
- Нельзя считать обучение успешным по тому, что candidate generated/approved; требуется независимый uplift на holdout.
- Нельзя смешивать эмоцию, настроение и личностные черты в одной переменной.
- Нельзя делать отдельный источник истины для аватара, голоса, памяти или пользовательской модели.
- Нельзя вливать все 488 веток. Сначала сравнить с актуальной базой, определить ancestry, выделить полезные коммиты, прогнать точные тесты и устранить file-level conflicts.
- Не изменять release license manifest для «зелёного» статуса без подлинных решений.
- Не публиковать новый Release на устаревшем SHA или без обновления ZIP.

## 8. Общие release gates — чек-лист 100%

### G1 — архитектура
- [ ] Один canonical OrganismCore/OrganismSnapshot.
- [ ] Единственный владелец каждого persisted state.
- [ ] Цикл Perceive→Appraise→Plan→Act→Reflect→Consolidate реально замкнут.
- [ ] Все межсистемные контракты версионированы и мигрируют.

### G2 — непрерывность и познание
- [ ] RU/EN autobiographical recall holdout проходит.
- [ ] Memory restore/restart and forgetting pass.
- [ ] Independent learning uplift / transfer / no-regression pass.
- [ ] SelfModel/UserModel/relationship state восстановимы и evidence-grounded.
- [ ] Emotion-to-action credit assignment подтверждён.

### G3 — автономность и безопасность
- [ ] Инициатива возникает без user prompt и соблюдает cadence/quiet hours.
- [ ] Tools имеют policy, permission, receipt, verification and rollback.
- [ ] Unknown evidence/capability вызывает abstain.
- [ ] Никакая симуляция не считается реальным действием.

### G4 — тело и речь
- [ ] Original 2D/Legacy работает.
- [ ] Live2D expression, motion, gaze and speech E2E проходят.
- [ ] 2.5D имеет реальные layered artwork, rig, springs/occlusion и mobile QA.
- [ ] 3D имеет canonical humanoid asset, retarget, morphs, LOD и mobile QA.
- [ ] Переключение 2D↔2.5D↔3D сохраняет organism state.
- [ ] Голос/viseme/interrupt проходят browser и Android.
- [ ] Wardrobe profiles проходят на поддерживаемых телах.

### G5 — эксплуатация
- [ ] Clean install/Compose and Android/Termux startup pass.
- [ ] Crash/restart/backup/restore pass.
- [ ] Performance/thermal/memory/battery limits pass.
- [ ] 24h+ device soak без потери подтверждённого state.

### G6 — выпуск
- [ ] Exact-head CI and typecheck green.
- [ ] Production app + runtime build green.
- [ ] Browser and real-device E2E green.
- [ ] SBOM/provenance current and complete.
- [ ] Human license review complete; release audit green.
- [ ] ZIP rebuilt from validated source SHA and extraction smoke green.
- [ ] Release asset URL, size and SHA256 verified.

## 9. Следующий рабочий пакет

1. Дождаться и проверить повторные Actions #406/#411; исправить все новые TS/runtime regressions.
2. Выделить единый cross-renderer BodyState contract как интеграционную точку PR #405/#410/#415.
3. Выбрать один depth-rig branch (#408 vs #409), второй использовать только как source of cherry-picks.
4. Rebase #399/#400/#401 на текущий source и прогнать полные targeted checks на новых SHA.
5. Закрыть recall/learning paired-seed holdout; текущие тесты не заменяют независимые данные.
6. После стабилизации объединить тело/голос/эмоции через один snapshot и сделать browser/Android E2E.
7. Параллельно начать человеческий license review по текущему fingerprint и asset inventory.
8. Только затем собирать release candidate ZIP.

**Definition of completion:** ни один аспект не считается 100% завершённым, пока его acceptance tests и необходимые полевые проверки не привязаны к текущему Release Candidate SHA.
