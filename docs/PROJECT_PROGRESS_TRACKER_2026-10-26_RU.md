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

## WorkPass374 — Hexis HMX canonical-memory integration (2026-10-26; validation pending)

- **Implementation branch:** hexis-integration-workpass373-20261026, based on WorkPass373 cross-ledger-rollback source line.
- **Integrated code:** normalized HMX 1.7 export; review-gated canonical memory projection through MemoryFabric; source-provenance semantic namespace; idempotent application receipt; rollback-aware apply path; explicit HTTP decision validation; focused tests and workflow. Frontend now supports external HMX JSON upload, explicit canonical apply, goal-proposal review and confirmed materialization; focused workflow also typechecks app frontend.
- **Goal boundary:** accepted HMX goals can be converted to idempotent pending review proposals, listed and approved/rejected via the API; they are not silently materialized or activated. Explicitly confirmed materialization now creates/reuses a canonical candidate goal, reconciles goal↔memory graph edges where both endpoints exist, writes a typed event receipt and replays without creating a second goal.
- **Validation state:** unverified for a concrete platform reason. Workflow now captures both runtime and app install/typecheck output, plus focused Hexis test logs, then uploads the evidence artifact before enforcing the gate. Exact-head Hexis workflow #40336104593 and unified integration #40336104584 ended before any step ran (runner_id=0, empty runner_name, steps=[]); no artifacts were produced. The Hexis workflow now captures npm ci/typecheck/test logs and exit codes for the next runner-backed execution. No pass is claimed until exact-head checks actually execute.
- **Scoring:** preserve the prior weighted metrics. This pass is code integration only until exact-head checks and independent evaluation provide new evidence.
- **Unchanged:** main and the published Release ZIP.

## WorkPass375 — frontend HMX round-trip and goal graph continuity (2026-10-26; validation blocked)

- **Frontend API contract:** added client calls for HMX apply and the goal proposal lifecycle.
- **Operator UI:** external JSON import, stage acceptance and canonical write each have explicit UI boundaries; accept and apply require separate confirmations. Re-staging clears all stale confirmation state. Successful API results are retained even when the subsequent status refresh fails.
- **Goal continuity:** a duplicate goal proposal from the same lineage reuses the canonical goal's graph node and reconciles its semantic edge, while unrelated lineages remain separated.
- **Validation:** runner unavailable. Latest Hexis #40337917617 and unified suite #40337917630 fail before steps begin (runner_id=0, empty runner_name, steps=[], no artifacts). Workflow now captures runtime and app install/typecheck/test evidence if a runner is assigned. No validation is claimed.
- **Release boundary:** main and published Release ZIP remain unchanged; no maturity score or recallDelta uplift was claimed.

## WorkPass376 — HMX transport budget and partial-write rollback (2026-10-26; validation blocked)

- **Transport:** HMX import/stage uses a dedicated request body bound up to 8 MiB; the general API request limit stays unchanged. 413 replies include the correct route-specific limit; a 300 KB smoke case was added.
- **Atomicity:** rollback now discovers canonical rows created by a call that throws before returning the row ID, using the immutable pre-apply canonical snapshot as the baseline. Fault injection now commits the second row then throws, and asserts complete compensation and safe retry.
- **Validation:** not executed on Actions because jobs fail before starting a runner (runner_id=0, no steps/artifacts). No passing test/typecheck claim.
- **Release boundary:** main and published Release ZIP untouched; maturity metrics unchanged.
