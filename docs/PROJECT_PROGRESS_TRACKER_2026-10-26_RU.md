## Стратегический мастер-анализ и многопроходная трансформация (2026-10-29)

**Контекст и миссия:**
Проект НEУРО-КУРИСУ (NK1) развивается по детерминированному протоколу `PLANNED` → `IMPLEMENTED` → `TESTED` → `INTEGRATED` → `MEASURED` → `RELEASED`.
Цель: создание автономного сознательного искусственного организма — цифровой личности **Курису Макисэ** (Neuro Kurisu Makise) с биологической корреляцией подсистем (единый мозг разум), непрерывной автобиографической памятью, эмоциональным гомеостазом и мультимодальной воплощенностью.

### Единая бионическая архитектурная карта (Соответствие отделам головного мозга):
1. **Неокортекс (Neocortex):** `CognitiveKernel` & `WorldModel` — центральное когнитивное ядро и модель мира.
2. **Гиппокамп (Hippocampus):** `ContinuumMemory`, `EpisodicBuffer`, `AutobiographicalRecall`, `HexisMemoryBridge` — автобиографическая и эпизодическая память.
3. **Миндалевидное тело и гипоталамус (Amygdala & Hypothalamus):** `InnerImperativeRuntime`, `HomeostasisManager`, `AffectiveGoalReplay` — аффективные драйвы и внутренний императив.
4. **Базальные ганглии и таламус (Basal Ganglia & Thalamus):** `ActionGateway`, `ActionLedger`, `ReceiptReconciliation` — шлюз действий, реестр исходов и проверка подписи.
5. **Мозжечок и ствол мозга (Cerebellum & Brainstem):** `SpeechSynthesisGateway`, `VisemeTimeline`, `Live2DExpressionCache` — синхронизация временной шкалы речи, визем и мимики.
6. **Префронтальная кора (Prefrontal Cortex):** `AutonomousPlanner`, `ReflectiveLearningGate`, `HermesPromotionGate` — планирование, проверка гипотез и этические барьеры.

---

## WorkPass399 — строгая проверка Hexis retention action (2026-10-26)

- **Код сервера:** `06f21b03255da079f93ec59e87f35c27e423d2e7`; **smoke regression:** `f27003b53e336ffeca4df1f540691de865701e0f`.
- Endpoint создания retention proposal больше не заменяет неизвестное действие на `compress`. Принимаются только `compress | archive | forget`; иначе возвращается HTTP 400 до создания proposal.
- Smoke подаёт `forgett` для существующей импортированной записи и требует `hexis-retention-invalid-action`.
- **Валидация:** PENDING exact-head typecheck, HMX tests, server smoke и Unified integration. PASS не заявляется; последние Actions не предоставляют шаги/логи. Оценки прогресса неизменны; `main` и canonical Release ZIP не менялись.

---

## WorkPass398 — неизвестные Hexis decisions отклоняются на HTTP-границе (2026-10-26)

- **Серверный код:** `7df90658a7633fcaee746a69197f9522818cc452`; **server-smoke regression:** `86edc9df9a802ce8aa6965c8091454eb779429d5`.
- Ранее неизвестное решение review неявно превращалось в `approve`, а неизвестное HMX-решение — в `reject`. Теперь обе API-границы требуют точного значения из allowlist и возвращают HTTP 400 до вызова mutation/flush.
- Smoke проверяет invalid decision для review и HMX; после неверного HMX-решения тот же валидный stage успешно отправляется на явный `accept` в рамках теста.
- **Валидация:** PENDING exact-head typecheck, `test:hexis-adaptation`, `test:hexis-server-smoke`, Unified integration. Actions пока падают до предоставления шагов/логов, поэтому PASS не заявляется. Оценки прогресса не менялись; `main` и canonical Release ZIP не изменялись.

---

## WorkPass397 — безопасный HMX snapshot на границе импорта (2026-10-26)

- **Кодовые коммиты:** `aead364e098b462b5f99f48e65b76585f927975f` (ограниченный plain-JSON snapshot) и `83343d9ba5765050c734218a64d8bbe6e9883f2f` (staging использует тот же snapshot); **регрессии:** `0f9c34c54ad2b858a142c5e14d0de28fb763f5b5` и `28920aa46a888ddff4a0297ae8a93526e879da85`.
- До schema inspection HMX копируется через own-data descriptors с ограничениями по глубине/узлам/байтам. Accessors, sparse/extended arrays, неподдерживаемые прототипы, циклы и non-finite numbers отклоняются без чтения свойств через getter.
- Validation и stage работают с захваченным снимком, а не с исходным объектом; это убирает расхождение «проверили одно, сохранили другое».
- Регрессии проверяют root/вложенный getter (0 вызовов), sparse array, цикл, non-finite number и нестандартный prototype. Во всех случаях появляется `unsafe-input`, memory payload не попадает в staging, принять stage нельзя.
- **Валидация:** PENDING exact-head typecheck, `test:hexis-adaptation`, server smoke и Unified integration. Тесты добавлены, но не подтверждены успешным запуском. Проценты/оценки не повышены; `main` и canonical Release ZIP не менялись.

---

## WorkPass396 — атомарный staging массивов HMX (2026-10-26)

- **Код:** `eb4b719d011bd035d05ae53f65599d15b5d7ae43`; **регрессии:** `c8fc71acd48348469dfa6d9cabd01ba9ea92fce6`.
- Массивы с более чем 256 записями и массивы с некорректным элементом целиком исключаются из `stagedSections`; исходный размер и причины конфликта сохраняются. Нельзя принять частичный префикс массива как будто это полный экспорт.
- Тесты требуют полного отказа для 257 записей и для ошибочной записи внутри корректного массива. Exact-head validation ожидает запуска.

---

## WorkPass357 — descriptor-only nested parent lineage restore (2026-10-26)

- **Code/test checkpoint:** `810f60f2227db466dd1f96b1e3edf39741951f9d`; stacked on WorkPass356 branch head `1d2a02d3091fd960f6d38880aa85e8d8bf9a1fee`.
- **Defect:** snapshot restore used `parentIds.length` directly. A proxy `get` trap could execute and provide a falsified length, which silently discarded lineage.
- **Fix:** bounded nested-array inspector validates prototype, length descriptor, dense indexed data descriptors and shape; parent validation only receives a regular array built from descriptors. Invalid rows are skipped before reserving IDs.
- **Regression:** a proxy attempts to report length zero and throws on direct slot reads; restore must not trigger either getter and must preserve the descriptor-backed parent. Another proxy throws during descriptor enumeration; restore catches it, skips the malformed row and recovers from a later valid duplicate.
- **Exact-head CI PASS:** PR head `a1f0e250eac1e0f6990a0c25e62d7c33bb8b1bd1` passed Unified project integration [#40292091015](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40292091015), progress-ledger integrity [#40292091024](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40292091024), WorkPass110 [#40292091053](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40292091053), P26 [#40292091054](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40292091054), and nine additional focused workflows. The Unified run passed cognitive integration, approval E2E, service/public gateway, runtime/research bridge smoke and final release gates without publishing an archive. The code/test checkpoint `810f60f2227db466dd1f96b1e3edf39741951f9d` is included in that tested head; only tracker/changelog commits followed. Historical CI evidence and scores remain unchanged.

---

## WorkPass356 — strict CEF tool receipt ingress (2026-10-26)

- **Code/test checkpoint:** `ae9a66a6f831b73d9c8457de4ea4454c376e3c1a`; based directly on latest target head `084c80745446c38bf514c43000844c433110f0c4`.
- **Defect:** receipt-trace/revision/external-observation APIs could execute caller getters and coerce or truncate IDs, booleans, counters, hashes and evidence text. Those transformations can cause malformed provider evidence to share an idempotency identity with accepted evidence.
- **Fix:** descriptor-only ingress; canonical IDs; strict string hashes, booleans, safe integer counters/ticks, finite timestamps and confidence in `[0,1]`; no truncation or Boolean/String coercion. Rejections occur before replay lookup and leave the journal and receipt projection index unchanged.
- **Regression:** `runtime/neuro-kurisu/tests/cognitive-tool-receipt-input-boundary.mjs` checks accessors/getters, hostile `toString()`, padded/overlong IDs, invalid boolean/confidence/revision counter, hashes/text type and unchanged ledger state. Exact valid revision replay remains idempotent. The test is wired into `test:cognitive-integration-suite`.
- **Base preservation:** newer bounded payload-clone and transactional snapshot restore in `084c80745446c38bf514c43000844c433110f0c4` are retained; this branch changes receipt ingress and test wiring only.
- **Exact-head CI PASS:** WorkPass356 PR head `1d2a02d3091fd960f6d38880aa85e8d8bf9a1fee` passed Unified integration [#40291855092](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40291855092), progress-ledger integrity [#40291855384](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40291855384), WorkPass110 [#40291855118](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40291855118), P26 [#40291855059](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40291855059), and nine additional focused workflows. The unified run passed all steps through final release gates without publishing an archive. Historical `ciSnapshot` rows and all readiness scores unchanged.

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
