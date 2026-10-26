## WorkPass393 — каноническая привязка Hexis review и восстановление после рестарта (2026-10-26)

- **Код/тесты до tracker-коммита:** `1d0b208d2d74e27d51997d8f53a7b191873eb0f3` в ветке `fix/hexis-review-digest-binding-live-2026-10-26`, поверх актуального на тот момент integration head `b25b6b572f4f0366fd3b23f795763e921bf84f7f`.
- В каноническом bridge общий digest используется при ingress, создании review и проверке решения. Перед одобрением payload повторно проходит strict adapter и сверяется с точной записью MemoryOS2 по evidence ID, digest, stance, source kind/reference, label, author, note, confidence, timestamp и protected-memory flag.
- Для старых pending reviews с `observedAtOrigin=server-receipt` сохранена ограниченная совместимость со старым raw digest. Она разрешена только при совпадении полной канонической записи и служебной метки; изменение любого evidence-поля по-прежнему отклоняется.
- Регрессии: шесть tampering-сценариев; старый receipt-time digest; smoke сверяет результат с сохранённой confidence без предположения, что значение обязано расти у policy ceiling; отдельный процессный restart smoke проверяет восстановление точного pending review из прежнего `STATE_DIR` перед одобрением.
- **Валидация:** PENDING exact-head typecheck, focused Hexis tests, серверный smoke и Unified integration. GitHub Actions на последнем head завершились до получения шагов/журналов; такие запуски не считаются ни доказанным code failure, ни PASS.
- Проценты готовности, recall и learning uplift не изменены. `main` и canonical Release ZIP не менялись.

---

## WorkPass390 — безопасная обработка null-envelope в Hexis HTTP API (2026-10-26)

- **Коммиты кода/теста:** `f7dab0d78bd33ede255c04ff5a37c2f635dd4f6e`, `9d00c3001a97d5551145cf0bb2c51fcdfebe7424`.
- Guard внутреннего `observedAtOrigin` сначала проверяет, что тело — ненулевой объект. Невалидное тело доходит до schema validation вместо того, чтобы вызвать route-level `TypeError`.
- Smoke требует HTTP 400 для JSON `null` и для попытки передать внутренний timestamp marker.
- **Валидация:** точный head ожидает проверки. Предыдущие Actions по исправлению generic review завершались без шагов/логов, поэтому WorkPass389/390 пока не подтверждены. Прогресс не увеличен; `main` и Release ZIP не менялись.

---

## WorkPass389 — канонический gate для общего review endpoint (2026-10-26)

- **Коммит исправления:** `7c22337ae263f68c568ac398c9af1d68a6af2bf0`; диагностический тест — `62871903fad4f9d19c9235fb061e1f37f010a7cc`.
- Общий `/reviews/decide` больше не выбирает путь по наличию служебного `pipeline` в публичной review-проекции. Сначала вызывается `decideHexisEvidenceReview`; legacy fallback разрешён только при точном ответе `not-a-valid-hexis-evidence-review`. Прочие отказы закрываются HTTP 409.
- Smoke-тест печатает результат canonical gate в сообщении об ошибке, чтобы не скрывать причину отказа.
- Предыдущий Unified run на `ac6d07607977b2280b6d924e0c13dd7c6b332e90` падал на generic-review проверке. Запуски для `62871903fad4f9d19c9235fb061e1f37f010a7cc` и `7c22337ae263f68c568ac398c9af1d68a6af2bf0` завершились до появления шагов и журналов; проверка точного head пока не подтверждена.
- Метрики готовности/recall не повышались. `main` и Release ZIP не изменялись.

---

## WorkPass387 — стойкая идемпотентность Hexis receipt-time (2026-10-26)

- Код/тесты: `cf79d537ce44e9bed1bfe3a07001d17f3097d06b`, `67fd5cc3e28c351c5264bf88d6427828eeda8cc6`, `7f7d5f0aae1b2b3e782202d281c0fb25ceed9943`, `b55c45ce65e6a6375ad8b90a55059340b852b900`, `c9e53030623fba87037460c2a3202c9a89ab324f`, `843964cdf0f5b2dc9d770b9fa60c5d294b0f2bad`.
- Сгенерированное сервером время помечено внутренним origin; digest нормализует только эту метку. Остальные поля evidence остаются digest-bound. Публичный endpoint отклоняет маркер.
- Тесты проверяют duplicate на повторе, conflict при реальном изменении payload и отклонение поддельного маркера. Предыдущая попытка поиска времени через read-only проекцию не прошла smoke; эта замена не зависит от неё.
- Exact-head validation ожидается. `main` и Release ZIP не изменялись.

---

## WorkPass386 — идемпотентность повторного legacy-запроса Hexis (2026-10-26)

- Коммит кода: `287f312aa982863f10f60cfd6a42db69dd8d97d1`.
- Smoke выявил дефект: при пропущенном `observedAt` сервер создавал новую временную метку на каждый повтор, хотя evidence ID оставался тем же; identical payload получал конфликт.
- При повторе маршрут теперь берёт время из канонически сохранённого evidence; первое принятие сохраняет серверное время, заданный клиентом timestamp не переписывается.
- Валидация точного head ожидается. `main` и Release ZIP не менялись.

---

## WorkPass385 — детерминированная очистка Hexis smoke-теста (2026-10-26)

- Коммит исправления: `a9f741deb4cece36459f121f9064cf6cf99069d0`.
- Unified integration прошёл typecheck и Hexis adapter/bridge/review/MemoryFabric ingress; следующий отказ — `ENOTEMPTY` при удалении временного каталога до завершения дочернего сервера.
- Smoke-тест теперь ждёт завершения процесса перед очисткой и использует ограниченный аварийный выход; проверки маршрутов не ослаблены.
- Проверка нового точного head ожидается. Готовность и recall-uplift не повышены. `main` и Release ZIP не менялись.

---

## WorkPass383 — keep Hexis lifecycle events on logical organism ticks (2026-10-26)

- **Code/test head:** `7c62bebea1564b067f31343914c40004dc87d28e` on `work/hexis-evidence-adapter-2026-10-26`; bridge implementation commit `26837c72cece9145bbcce864949e2922b4d42f21`.
- **Defect:** the approval path used `Date.parse(observedAt)` (epoch milliseconds) as `MemoryFabric`'s logical event tick. That mixed wall-clock time with the organism-cycle counter and could make later events appear chronologically out of scale.
- **Fix:** external Hexis ingress and approval now reuse the latest non-negative logical tick from the canonical event log; missing or timestamp-like values fail closed to zero. Event wall-clock time remains the separate event `at` field.
- **Regression:** the production integration test runs through `OrganismSystemFabric`, seeds logical tick 27, and checks evidence and approved-confidence events both retain tick 27 and never record epoch milliseconds.
- **Validation:** fresh exact-head typecheck, focused tests, unified integration and release gates are **pending**. No retrieval/readiness score increase claimed. `main` and the canonical Release ZIP are unchanged.

---
## WorkPass381 — make Hexis rollback assertions schema-safe (2026-10-26)

- **Code/test commit:** `d6fbf28a61024f6739bcf4dfe1be58627cdf0da6`; branch `work/hexis-evidence-adapter-2026-10-26`.
- The previous run reached the rollback regression and showed that pre-evidence snapshots may omit the optional `evidenceRecords` and evidence-trail fields entirely. Normalized those optional-field checks to booleans rather than confusing an absent property (`undefined`) with a retained receipt.
- Assertions still verify that the failed receipt, replay identity and source trail are absent, confidence and review state are unchanged, and the exact same evidence ID can be retried successfully after the injected review-store failure is removed.
- **Validation:** exact-head typecheck, focused regressions and unified integration must pass on the updated code/test head; prior unified run failed on this assertion, so it is not counted as validation of this fix. No readiness/recall uplift claimed; `main` and Release ZIP unchanged.

---
## WorkPass380 — исправление регрессии отката Hexis и повторной попытки (2026-10-26)

- **Коммит кода/теста:** `90f8b111d3e1d5b6b6e7b82f187eaf9ddb365e28`, ветка `work/hexis-evidence-adapter-2026-10-26`.
- Убраны ошибочные ссылки теста на неопределённые `target` и `rollbackEvidence`; проверки обращаются к канонической записи MemoryOS2 и подтверждают, что отклонённый receipt, replay ID и источник не остались в журнале.
- Добавлен тест восстановления работоспособности: после искусственного сбоя очереди review повтор того же evidence ID должен пройти до `review-pending`, а не блокироваться ложным дублем.
- **Валидация:** точный head после этого коммита ещё ожидает typecheck и Unified project integration. Предыдущий запуск относился к более раннему SHA; PASS не заявляется. Метрики прогресса не повышаются, улучшение recall и готовность к production не доказаны.
- `main` и канонический Release ZIP не изменялись.

---

## WorkPass375 — Hexis evidence routed into canonical MemoryOS2 (2026-10-26)

- **Source branch:** `work/hexis-evidence-adapter-2026-10-26`.
- **Code/test head before documentation:** `61fdb0ad6b098f91bd3b0884bf3b209f4ee514dc`.
- **Implementation:** `MemoryOS2` now owns the canonical evidence record trail and exposes duplicate-aware evidence ingress. The Hexis bridge maps the validated envelope into this store without creating a second memory/database.
- **Stored lineage:** evidence ID, SHA-256 digest, stance, source kind/reference, optional label/author/note, evidence confidence and observed time. The memory's own belief confidence remains unchanged on ingress.
- **Replay integrity:** exact replay is a no-op; a reused visible evidence ID with changed digest is a conflict. After the 64-record detail trail rotates, a Bloom lineage filter blocks retired IDs from voting again. Source independence is represented separately from evidence identity.
- **Safety/authority:** protected-memory ingress is blocked and must use the existing review path. This pass only records evidence; it does not automatically revise beliefs, approve reviews, promote skills or bypass independent evaluation.
- **Regression:** `tests/cognitive-hexis-memory-bridge.mjs` checks accepted evidence, supports/contradicts/contextualizes metadata, preserved confidence, exact retry, conflicting digest, protected-memory refusal, missing memory, snapshot/restore and 90-entry rollover replay.
- **Validation:** **PENDING** exact-head typecheck, bridge test, unified integration and final release gate. Do not infer PASS from a successful commit. Progress percentages remain unchanged.
- **Next dependency:** connect this canonical evidence trail to the existing Hexis belief appraisal/review route after confirming its current active API and approval boundary. `main` and the canonical Release ZIP are unchanged.

---
## WorkPass376 — strict Hexis ingress schema and dedupe-index isolation (2026-10-26)

- **Branch:** `work/hexis-evidence-adapter-2026-10-26`; stacked Hexis integration PR #217.
- **Implementation:** `HexisEvidenceAdapter.ts` rejects unknown/symbol keys and accessor properties at both envelope levels; exceptions from caller-provided dedupe index access become a fail-closed `invalid-evidence-dedupe-index` result.
- **Regression:** added unknown-key, symbol-key, nested source schema, and throwing dedupe-index cases to `cognitive-hexis-evidence-adapter.mjs`.
- **Validation:** **PENDING** exact-head test/typecheck/unified suite. No benchmark or readiness score uplift claimed. No `main` or Release ZIP change.

---

## WorkPass374 — Hexis provenance ingress vertical slice (2026-10-26)

- **Branch:** `work/hexis-evidence-adapter-2026-10-26`.
- **Code/test:** `runtime/neuro-kurisu/src/organism/memory/HexisEvidenceAdapter.ts` and `runtime/neuro-kurisu/tests/cognitive-hexis-evidence-adapter.mjs`.
- **Integration:** registered `test:cognitive-hexis-evidence-adapter` in `runtime/neuro-kurisu/package.json` and in `test:cognitive-integration-suite`. Test filename uses the existing `cognitive-*.mjs` convention so the focused workflow path filter can detect it.
- **Contract:** canonical evidence provenance + source identity + stance + timestamp + confidence; idempotent duplicate detection; protected-memory marker preserved; accessor/proxy-safe fail-closed validation. No persistence adapter or confidence-revision policy is silently substituted.
- **Validation:** **PENDING** exact-head CI. Required: runtime typecheck, focused adapter regression, unified cognitive integration suite and release verification. No score increase and no claim of memory-retrieval uplift.
- **Scope guard:** source ideas are adapted; no Hexis service, database, credentials, or runtime dependency is added. `main` and the latest Release ZIP remain unchanged.

---

## WorkPass373 — aggregate payload text budget (2026-10-26)

- **Implementation commit:** `390093223cdb38114827a27beb62d60fb897ac67`.
- **Regression test commits:** `b98a9f3b364b72c96dfc35cdc0ba29087974243b`, `b2f66402b116362e6a1022b54136dea6ae9c8073`, `2d2ed2eaa6f8335b7c90dd3917f805383e8deafb`.
- **Documentation commits:** `95681efe30691f7d5752f02abbf4e753e8413cf1` plus subsequent tracker/changelog correction.
- **Numbering note:** implementation commit subject used provisional WorkPass357; that number is already used by an independent branch. Canonical tracking for this follow-up is WorkPass373; commits were not rewritten.
- **Change:** count UTF-16 code units across string values and object keys in `CognitiveEventFabric.cleanPayload`; reject payloads exceeding 131,072 units. The existing `test:cognitive-event-payload-envelope` integration gate now tests a single oversized string, aggregate overflow, unchanged ledger state after rejected appends, and restore-time rejection.
- **Validation status:** **PENDING** for the expanded boundary/key test head. The prior code/test head passed unified integration, WorkPass110, WorkPass108, P26 and progress-ledger integrity; these results do not validate the newly expanded tests. Run runtime typecheck, the focused payload-envelope test, full cognitive integration suite and release gate on the exact latest SHA.
- **Progress:** implementation and expanded regression coverage committed; no learning score or readiness score increased. Not merged into `main`; no new release ZIP published.

---

## WorkPass356 — strict CEF tool receipt ingress (2026-10-26)

- **Code/test checkpoint:** `c6845a5258a2c3bcdccce1089615cfabbfd4b750`; stacked on WorkPass355 branch head `fce603ecc674887d20ebb2da187103ddce43171a`.
- **Defect:** public CEF receipt methods read caller input directly; revision/external-observation ingress could stringify values, trim/truncate IDs, coerce booleans and clamp confidence, allowing invalid evidence to alias valid idempotency keys.
- **Fix:** descriptor-only reads on `appendToolReceiptTrace()`, `appendToolReceiptRevision()` and `appendToolExternalObservation()`; canonical IDs; strict booleans, numeric clocks/counters, valid confidence range and hash/text types; rejected inputs do not enter replay lookup or mutate the event/replay ledgers.
- **Regression:** `runtime/neuro-kurisu/tests/cognitive-tool-receipt-input-boundary.mjs` covers accessor getters, padding/truncation collisions, invalid flags/confidence/counters, non-string hash and evidence text objects with hostile `toString()`, state preservation and valid revision idempotency. Wired into `test:cognitive-integration-suite`.
- **Exact-head CI PASS:** PR head `d4ddbbe2495ca6523d4b2c4f04129bf487ab189b` passed Unified project integration [#40290594913](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40290594913), progress-ledger integrity [#40290595259](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40290595259), WorkPass110 [#40290594892](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40290594892), P26 validation [#40290594766](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40290594766) and nine additional focused workflows. The unified run passed cognitive integration contracts, governed approval E2E, public-gateway/service startup, runtime/research bridge smoke and final release gates without publishing an archive. Code/test checkpoint `c6845a5258a2c3bcdccce1089615cfabbfd4b750`; later PR commit `d4ddbbe2495ca6523d4b2c4f04129bf487ab189b` contains the same validated code/test with checkpoint documentation. Scores and historical `ciSnapshot` rows remain unchanged.

---

## WorkPass355 — safe and transactional CognitiveEventFabric snapshot restore (2026-10-26)

- **Code/test checkpoint:** `38b17bf610c06de1a23ba5e54d21cb4a1b7ac905`; based on target checkpoint `18afd253dcd7413c02136537ea1acc10b7764768`.
- **Defect:** `restore()` read untrusted snapshot fields directly and expanded arrays through iteration, which could invoke getters from the snapshot envelope, event records, parent arrays or receipt replay index. An exception late in restoration could leave the live event list changed before replay-index restoration completed.
- **Fix:** own-data-descriptor readers for envelope/event/receipt records; slot-by-slot bounded array inspection; strict canonical receipt IDs and numeric timestamps; local construction of restored event list and replay index followed by a single commit.
- **Regression:** `runtime/neuro-kurisu/tests/cognitive-event-restore-envelope.mjs` verifies no getter execution on envelope/event/array/parent/receipt paths, preservation of live state when the envelope is rejected, and recovery after malformed duplicate rows. Wired into `test:cognitive-integration-suite`.
- **Exact-head CI PASS:** PR head `0ad66d5519aedbadc317684504ed0e5a8e79412c` passed Unified project integration [#40289492932](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40289492932), progress-ledger integrity [#40289492966](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40289492966), WorkPass110 [#40289492891](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40289492891), P26 validation [#40289492875](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40289492875), and nine additional focused workflows. Cognitive contracts, approval gateway E2E, public gateway/service startup, runtime/research smoke and final release gate all passed. Later commits after that validated PR head changed only changelog/tracker documentation; code/test checkpoint remains `38b17bf610c06de1a23ba5e54d21cb4a1b7ac905`. Historical CI rows and readiness scores remain unchanged.

---

# NK1 — общая панель инженерного прогресса (2026-10-26)

**Источник:** `ailtron1ss-rgb/NK1`, combined source branch `fix/mega-cognitive-progress-tracking-2026-10-26-r3`. Точный проверенный code/test head: `621864d0d7f2676245383adab86f1dcc6d0f741f`, merged into the source branch as `39af7eb67c9ab05efd45d01cbd4b4d1d44751454`. На HEAD 621864d0d7f2676245383adab86f1dcc6d0f741f успешно прошли Unified project integration suite [#40257525157](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40257525157), WorkPass110 [#40257525071](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40257525071), WorkPass108 [#40257525093](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40257525093), P26 Learning Validation [#40257525095](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40257525095), progress-ledger integrity [#40257525008](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40257525008), plus outcome-ledger, replay, cognitive-contract, verified-experience, reflection and postcondition suites.

**Что реально проверено:** чистая установка app/runtime с Node.js 24; Python 3.12 + CPU PyTorch для research probes; doctor и installer lockfile contracts; UI build/typecheck; runtime typecheck; strict Unified Cognitive Substrate и 30-цикловое restore/restart; owner-approval E2E; NeuroCore/NOMEGA/DeepCode после явного одобрения; per-family distinct holdout-task gate; полный финальный smoke после устранения 8-секундного таймаута клиента.

**Новый WorkPass343:** исправляет future `lastTick` в derived cognitive-substrate sidecar, добавляет unit + restart-E2E регрессии и явные CI path-фильтры, но его новый code/test head `8b38a354e7a32ea8822e4cd44866c73f00ce0d1c` ожидает exact-head CI. Последний подтверждённый набор 13 workflows относится к `621864d0d7f2676245383adab86f1dcc6d0f741f`; проценты и CI evidence ниже к нему привязаны и не заявляются как доказательство WorkPass343.

**Оценки не повышены:** это подтверждает интеграцию и корректность защитных ворот, но не доказывает увеличение внешней успешности обучения или переноса навыков. Открыты реальные Android/Termux audio и датчики, browser/Live2D hardware E2E, длительный soak, license review и воспроизводимая замена большого GitHub Release ZIP.

**Машиночитаемый источник процентов:** [PROJECT_PROGRESS_TRACKER_2026-10-26_RU.json](PROJECT_PROGRESS_TRACKER_2026-10-26_RU.json).  
**Проверка таблицы:** `npm run test:progress-ledger`; **сводный отчёт:** `npm run progress:report`.

## WorkPass344 — final release gate (pending exact-head CI)

- `release:verify` requires UI wiring, architecture and metadata checks; JSON summary includes filesystem/tree failures.
- Default operator mode remains strict. After research smoke, CI mode allows only untracked `.pyc` files below `__pycache__`, reports warnings, and still rejects tracked bytecode, stray bytecode and non-bytecode files in cache directories.
- Eight regression cases cover metadata, CLI, strict/CI cache policies and attempts to bypass those policies.
- Current code/test checkpoint `064a7ac8f2cd91e692d7e7d3905a8a608a6a92b6` includes the final tracked-bytecode guard. New exact-head CI is pending; scores remain unchanged.

## WorkPass344 — fail-closed final release verification (pending current-head CI)

- `npm run release:verify` now requires UI wiring, architecture and metadata checks. The summary counts tree hygiene failures separately so a failed gate cannot report `failed: 0`.
- Six tests cover metadata pass/fail/missing-validator, unknown CLI args, strict Python cache rejection, and an explicit cache-tolerant CI mode.
- The integration workflow runs `release:verify:ci` only after research smoke. The normal operator `release:verify` remains strict and does not silently ignore bytecode.
- The first runs found and corrected two real pipeline issues: architecture scanner false-positive from an import assertion string and transient `__pycache__` from research smoke. Current code/test checkpoint `71176fa2275149a726a3aadeec827866d88a0cc0` needs new CI.
- WorkPass343 substrate tick reconciliation is preserved from the freshest source base. Scores remain unchanged; prior CI evidence is still anchored to `621864d0d7f2676245383adab86f1dcc6d0f741f`.

## Как читать проценты

Это начальная инженерная оценка по 12 направлениям, а не измерение «разума». Веса суммируются до 100%; скрипт считает четыре раздельных взвешенных показателя:

- **Реализация** — насколько много из нужного механизма уже реализовано и связано с runtime.
- **Автоматическая проверка** — насколько разработаны тестовые/контрактные проверки. Это не означает, что такой процент тестов прошёл на последнем commit.
- **Внешние доказательства** — насколько есть независимые результаты на реалистичных задачах; внутренние синтетические тесты сами по себе не повышают этот показатель.
- **Готовность релиза** — чистая установка, сборка, реальные провайдеры/устройства, UI/аватар/голос, продолжительный прогон, лицензии и воспроизводимый главный архив.

Сырые оценки и препятствия для каждого направления хранятся в JSON. Проценты — экспертный baseline для планирования; обновлять их можно лишь вместе с конкретными новыми source/CI/benchmark свидетельствами. Нельзя повышать реальную эффективность обучения только потому, что написан новый тест.

## Сводка текущего прогресса

| Измерение | Взвешенная оценка |
|---|---:|
| Реализация и интеграция механизмов | **66,6%** |
| Покрытие автоматическими проверками | **72,4%** |
| Независимые полевые доказательства | **17,4%** |
| Готовность к релизу | **34,9%** |

Это взвешенные инженерные оценки по 12 направлениям. Они не измеряют интеллект, сознание или автономность; процент автоматической проверки означает широту контрактов/регрессий, а не долю тестов, прошедших на текущем commit. Небольшой рост оценок implementation/validation связан с добавлением общего deadline в learning evaluator и успешной проверкой его интеграционных контрактов. Внешние данные об эффективности обучения и release readiness не увеличены.

## Что включено в панель

Взвешенно отслеживаются когнитивный цикл; модель мира и маршрутизация; память и непрерывность; внутренняя мотивация; планирование/действия/проверка последствий; continual learning/replay; создание и продвижение навыков; self/user model, ToM и этические ограничения; Live2D/avatar; голос и аудио; installer/build/CI; внешняя оценка, лицензии и главный релизный архив.

## Текущее доказательное состояние

- WorkPass331 добавил **подписанную per-family политику** для P23 promotion: явно заданные обязательные минимумы семейства входят в identity proposal; отсутствие evidence или gain ниже минимума блокирует gate. Это не означает, что любой skill обязан быть универсальным: целевые семейства задаются для каждого навыка.
- WorkPass332–333 добавили family labels и отдельные значения для SkillLearnBench-compatible validation/holdout отчётов; manifest family теперь проходит через fingerprint, run bindings и проверку перед записью в VerifiedOutcomeLedger. Высокий общий балл не должен скрывать провал tool-use или transfer. Для production продвижения остаётся отдельный подписанный P23 evidence gate.
- **WorkPass334 — ограничение полного evaluation budget:** независимая оценка кандидата использует единый монотонный deadline для всех задач validation + holdout, дополнительно к локальным timeout-ам sandbox/verifier/safety scanner. Истечение общего budget прекращает весь прогон; тест проверяет отмену зависающего executor и отсутствие запуска следующей задачи. Дефолт 5 минут; настройка `evaluationTimeoutMs` принимает 10–1800000 мс. Подробности: [WorkPass334 checkpoint](WORKPASS334_BOUNDED_INDEPENDENT_EVALUATION_RU.md).
- **WorkPass335 — preflight записи в VerifiedOutcomeLedger:** перед первой записью все bindings проходят runtime-проверку безопасных string run IDs, non-empty task/trial IDs, строгого `bindingVerified`, целого seed/safety count и допустимого split. Регрессия задаёт числовой `runId` во второй записи и проверяет, что ledger остаётся пустым. Подробнее: [WorkPass335 checkpoint](WORKPASS335_LEDGER_PREFLIGHT_ATOMICITY_RU.md).
- **WorkPass336 — evaluator-origin capability:** public SHA-256 можно пересчитать после изменения JSON, поэтому commit boundary теперь требует приватную in-process привязку точного объекта результата к исходному fingerprint. Подмена валидной строки `runId` с пересчитанным digest отклоняется до записи. Это не digital signature; cross-process/persisted evidence по-прежнему требует trusted signed-receipt verification. Подробнее: [WorkPass336 checkpoint](WORKPASS336_EVALUATOR_ORIGIN_ATTESTATION_RU.md).

- **WorkPass343 — reconcile sidecar clock with durable Core:** на старте `OrganismRuntime` сравнивает сохранённый `lastTick` проекции с каноническим Core tick. Если sidecar ушёл вперёд (включая `Number.MAX_SAFE_INTEGER`), переякоривается только clock, когнитивные метрики сохраняются. Добавлены unit-регрессия и реальный restart smoke: sidecar насильно получает future tick, затем после stop/re-init runtime подтверждает согласование и снова выполняет autonomous step. CI path-фильтры теперь явно включают wiring-тест и для PR, и для push. Code/test head `8b38a354…` пока без exact-head CI; статус `implemented / validation pending`, проценты не повышены. Подробности: [WorkPass343 checkpoint](WORKPASS343_SUBSTRATE_TICK_RECONCILIATION_RU.md).

- **WorkPass339 — строгая кодировка Ed25519 approval:** в combined diff также присутствует отказ от неоднозначных Base64-представлений подписи для promotion и rollback; отдельный набор подписей/тестов проходил на merge commit `4a41db0`. Эту проверку нельзя считать CI для combined HEAD; необходим новый совместный прогон. Подробности: [WorkPass339 checkpoint](WORKPASS339_STRICT_ED25519_APPROVAL_ENCODING_RU.md).
- **Validation status for combined WorkPass335/336/339–342:** exact combined code/test head `621864d0d7f2676245383adab86f1dcc6d0f741f` passed Unified integration, WorkPass110, WorkPass108, P26 and ledger integrity. The strict Ed25519 fix, the live cognitive substrate, task-family holdout gate and bounded research-probe deadlines all occur on that tested head. This closes their prior combined-head validation gap. Field-performance and hardware/release gates remain open.
- Исторический WorkPass329 proxy сравнение показывало family gain: memory=1, tool-use=0, transfer=0. Это известная слабость evidence, не заявка на обобщённый успех.
- **Актуальный подтверждённый CI snapshot:** на combined code/test head `621864d0d7f2676245383adab86f1dcc6d0f741f` успешно завершились 13 проверок, включая полный запуск runtime, `TYPECHECK=PASS`, `CLEAN_ORGANISM_SMOKE=PASS`, strict substrate wiring/restore, 30-cycle stop/re-init, UI build/typecheck, owner-approval E2E, все три Research Bridge probes, P23 candidate staging/promotion, WorkPass110/108, P26 и progress-ledger integrity. Полные links и testedHead сохранены в JSON ledger; все CI entries привязаны к одному SHA.
- Ранее опубликованный основной ZIP остаётся WorkPass70 Hotfix1 от 19 октября 2026 года. Новый ZIP не пересобран и не опубликован; главная ветка не менялась.

## Незакрытые релизные ворота

1. Независимый, не использованный для настройки holdout benchmark для tool-use, transfer и retrieval на нескольких парных seed-ах.
2. Доказательство полного пути реального принятого действия: план → gateway → фактический внешний postcondition → проверенная причинная привязка → learning credit.
3. Подтверждённая установка/сборка на чистой машине и целевом Android/Termux окружении.
4. Реальный браузерный UI, Live2D, голос/TTS и длительная синхронизация эмоций тела.
5. Длительный restart/soak test, полная лицензия/provenance проверка исходных источников и воспроизводимая пересборка главного release ZIP.

Панель разделяет «код есть», «контракты проверяются», «есть независимые полевые результаты» и «готово к релизу», чтобы одна цифра не скрывала незакрытые области.
