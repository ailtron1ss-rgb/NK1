# NK1 — общая панель инженерного прогресса (2026-10-26)

**Источник:** `ailtron1ss-rgb/NK1`, combined source branch `fix/mega-cognitive-progress-tracking-2026-10-26-r3`. Базовый исторический CI snapshot: `621864d0d7f2676245383adab86f1dcc6d0f741f`; WorkPass343–344 прошли Unified integration на точном checkout `a5aafc5274f44974aadf52e155213e12200cc4da` ([run #40279636593](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40279636593)), а WorkPass345 прошёл на `216d79086bfac2dd5f25e2c995fe6b5a44b61476` ([run #40279847281](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40279847281)).. Последний неподтверждённый code/test head: `5b86768a67c3893e6c76c044bffe822aa41e14ae` (WorkPass344; exact-head CI ожидается)., merged into the source branch as `39af7eb67c9ab05efd45d01cbd4b4d1d44751454`. На HEAD 621864d0d7f2676245383adab86f1dcc6d0f741f успешно прошли Unified project integration suite [#40257525157](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40257525157), WorkPass110 [#40257525071](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40257525071), WorkPass108 [#40257525093](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40257525093), P26 Learning Validation [#40257525095](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40257525095), progress-ledger integrity [#40257525008](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40257525008), plus outcome-ledger, replay, cognitive-contract, verified-experience, reflection and postcondition suites.

**Что реально проверено:** чистая установка app/runtime с Node.js 24; Python 3.12 + CPU PyTorch для research probes; doctor и installer lockfile contracts; UI build/typecheck; runtime typecheck; strict Unified Cognitive Substrate и 30-цикловое restore/restart; owner-approval E2E; NeuroCore/NOMEGA/DeepCode после явного одобрения; per-family distinct holdout-task gate; полный финальный smoke после устранения 8-секундного таймаута клиента.

**Новый WorkPass343:** исправляет future `lastTick` в derived cognitive-substrate sidecar, добавляет unit + restart-E2E регрессии и явные CI path-фильтры, но его новый code/test head `8b38a354e7a32ea8822e4cd44866c73f00ce0d1c` ожидает exact-head CI. Последний подтверждённый набор 13 workflows относится к `621864d0d7f2676245383adab86f1dcc6d0f741f`; проценты и CI evidence ниже к нему привязаны и не заявляются как доказательство WorkPass343.

**Оценки не повышены:** это подтверждает интеграцию и корректность защитных ворот, но не доказывает увеличение внешней успешности обучения или переноса навыков. Открыты реальные Android/Termux audio и датчики, browser/Live2D hardware E2E, длительный soak, license review и воспроизводимая замена большого GitHub Release ZIP.

**Машиночитаемый источник процентов:** [PROJECT_PROGRESS_TRACKER_2026-10-26_RU.json](PROJECT_PROGRESS_TRACKER_2026-10-26_RU.json).  
**Проверка таблицы:** `npm run test:progress-ledger`; **сводный отчёт:** `npm run progress:report`.

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

## WorkPass344 — второй future-tick restart regression

- Исправлено восстановление `CognitiveDependencyGraph.lastTick`: при sidecar, ушедшем дальше канонического тика Core, re-anchor меняет только производный clock и сохраняет routing counters, wake mask и активный interrupt.
- В unit-контракт добавлены MAX_SAFE_INTEGER, сохранность состояния, отказ для невалидного canonical tick и успешный следующий graph frame. Runtime restart smoke теперь повреждает оба sidecar, затем проверяет один новый автономный цикл.
- Code/test commit: `5b86768a67c3893e6c76c044bffe822aa41e14ae`. Exact-head CI для него пока не возвращён, поэтому все прежние успешные runs остаются привязаны к `621864d0d7f2676245383adab86f1dcc6d0f741f`, а проценты не повышаются.

## WorkPass345 — fail-open восстановление когнитивного графа

- Исправлено поведение старта при несовместимой схеме или ошибке загрузки `cognitive-dependencies.json`: runtime сбрасывает только производный граф, журналирует `runtime.cognitive-dependency.restore-failed` и продолжает инициализацию.
- Регрессия тестирует некорректную версию sidecar и следующий автономный цикл; часы графа остаются согласованы с каноническим Core.
- WorkPass345 code/test head: `216d79086bfac2dd5f25e2c995fe6b5a44b61476`; Unified integration run [#40279847281](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40279847281) выполняется. Оценки не меняются до подтверждения точного прогона.
- WorkPass344 future-tick fix подтверждён успешным run [#40279636593](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40279636593) на точном checkout `a5aafc5274f44974aadf52e155213e12200cc4da`.

## WorkPass345 — fail-open восстановление когнитивного графа: PASS

- Проверка завершилась успешно на точном code/test HEAD `216d79086bfac2dd5f25e2c995fe6b5a44b61476`: Unified project integration suite [run #40279847281](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40279847281).
- Подтверждена регрессия: неподдерживаемая схема `cognitive-dependencies.json` сбрасывает только производный граф, не блокирует запуск; следующий автономный цикл продолжает движение по каноническим часам Core.
- WorkPass343–344 также подтверждены полным прогоном на `a5aafc5274f44974aadf52e155213e12200cc4da` ([run #40279636593](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40279636593)).
- Общие инженерные оценки и оценка обучения 57/100 не изменены: эти исправления повышают устойчивость восстановления, но не доказывают полевой рост успешности задач, переноса навыков или удержания памяти.

## Незакрытые релизные ворота

1. Независимый, не использованный для настройки holdout benchmark для tool-use, transfer и retrieval на нескольких парных seed-ах.
2. Доказательство полного пути реального принятого действия: план → gateway → фактический внешний postcondition → проверенная причинная привязка → learning credit.
3. Подтверждённая установка/сборка на чистой машине и целевом Android/Termux окружении.
4. Реальный браузерный UI, Live2D, голос/TTS и длительная синхронизация эмоций тела.
5. Длительный restart/soak test, полная лицензия/provenance проверка исходных источников и воспроизводимая пересборка главного release ZIP.

Панель разделяет «код есть», «контракты проверяются», «есть независимые полевые результаты» и «готово к релизу», чтобы одна цифра не скрывала незакрытые области.
