# NK1 / NeuroCore — программа функционального завершения до 100%

> **Для исполнителей:** выполнять программу поэтапно, с проверкой каждого независимого deliverable. Галочка не заменяет доказательство: задача считается завершённой только после подтверждения на точном SHA и фиксации evidence в каноническом реестре аспектов.

**Цель:** довести NeuroCore до воспроизводимого, связного, безопасного и проверенного цифрового организма с устойчивой памятью, проверяемым обучением, контролируемой инициативой, единым мультимодальным телом и воспроизводимой поставкой.

**Архитектура:** один авторитетный OrganismCore/OrganismRuntime, одно согласованное OrganismState, один канонический владелец каждого изменяемого состояния и capability. Функции связываются через существующие контракты и адаптеры. Исследовательские кандидаты изолируются до прохождения независимых проверок. Программа задаёт критерии завершения и очерёдность; машинный статус 75 аспектов по-прежнему хранится в engineering-os/aspects.v1.json.

**Технологический стек:** Node.js/npm, TypeScript/JavaScript, runtime/neuro-kurisu, app/Vite, GitHub Actions, существующие тестовые и evaluation harnesses, Live2D/Three.js/VRM adapters, локальный llama.cpp/OpenAI-compatible boundary.

## Глобальные ограничения

1. Один canonical owner для памяти, состояния организма, выбора провайдера, управления действиями, проверки исходов и evidence.
2. Не создавать второй когнитивный runtime, второе хранилище истины, параллельный ActionGateway или дублирующие версии SelfModel/WorldModel только ради обхода существующего владельца.
3. Не считать наличие класса, интерфейса, каталога, README, PR или зелёного unit-теста доказательством production-возможности.
4. Любое изменение поведения сопровождается регрессией, которая отвергает прежнее неправильное поведение.
5. Не продвигать learning/retrieval/adapter candidate без baseline, абляции, leakage checks, независимого holdout и измерения ресурсной стоимости.
6. Не использовать holdout для генерации правил, адаптеров, промптов или обучения; split manifest, fingerprints и per-case outcomes должны быть неизменяемыми на период оценки.
7. Любое внешнее действие ограничивается разрешением, бюджетом, cancellation, idempotency, receipt и независимым postcondition. ACK инструмента не равен доказательству результата.
8. Не переносить credentials, private keys, пользовательские секреты и сырые приватные диалоги в research artifacts, экспорт cognitive state, обычные логи или публичный Release.
9. Сохранять полезные ветки и историю. Не удалять ветки и артефакты по внешнему сходству.
10. Не сливать PR пачкой. Учитывать stacked dependencies, exact base/head SHA, conflicts и точные результаты Actions.
11. Отдельно обозначать IMPLEMENTED, CONNECTED, TESTED, PROVEN, RELEASED, UNKNOWN, UNRESOLVED, BLOCKED и FAILED.
12. Не заявлять субъективное сознание, человеческую субъектность или внутреннее переживание на основании архитектурных аналогий, самоотчётов, текстовых объяснений или программных тестов.
13. Не менять юридические решения, лицензионные статусы, доступы, Secrets, внешние базы или платные сервисы без фактической проверки и надлежащего решения владельца.
14. Не выпускать ZIP при открытом обязательном release/license gate.
15. Целевые показатели в этом документе — критерии приёмки, а не утверждение, что эти показатели уже достигнуты.

---

## 1. Текущий проверенный baseline — 18 ноября 2026

Эти сведения зафиксированы по GitHub на момент подготовки программы. Они являются исходным checkpoint, а не вечными константами; перед каждой новой работой нужно повторно получать live branch SHA, PR state и Actions.

| Показатель | Проверенное состояние |
|---|---|
| Репозиторий | ailtron1ss-rgb/NK1 |
| Каноническая исходная ветка | workpass70-source |
| Source HEAD | bee2b133fdedd48723bc49b3eedae5f0df929c1c |
| Последнее проверенное слияние | PR #913 — Cognitive Immune health monitor |
| Actions на source HEAD | 19 push-triggered runs, 19 SUCCESS |
| Зафиксированный snapshot 75 аспектов | 2026-11-06, observedSourceHead bcd48b1fd408a1539ac537813730669c35cfb3a2 |
| Статусы в том snapshot | 62 IMPLEMENTED, 1 TESTED, 11 PLANNED, 1 BLOCKED |
| Статус branch protection | workpass70-source: protected=false; required status checks отключены |
| Последний stable Release | tag Neuro, 2026-10-19 |
| Последний опубликованный ZIP с учётом prerelease | workpass70-hotfix1-2026-10-19 |
| Последний ZIP SHA-256 | 9effadfcf0d402b462dd9cf2fd5b5793742039c9260db80578be830952bf52eb |
| Размер последнего ZIP | 136,354,713 bytes |
| License review | pending; redistribution approval=false |

Подтверждения текущего source HEAD:
- PR #913: https://github.com/ailtron1ss-rgb/NK1/pull/913
- NeuroCore core regression: https://github.com/ailtron1ss-rgb/NK1/actions/runs/44153691143
- Unified organism runtime: https://github.com/ailtron1ss-rgb/NK1/actions/runs/44153691079
- Memory integrity and retrieval gates: https://github.com/ailtron1ss-rgb/NK1/actions/runs/44153690888
- Action Gateway governance: https://github.com/ailtron1ss-rgb/NK1/actions/runs/44153691295
- Verified learning and skill lifecycle: https://github.com/ailtron1ss-rgb/NK1/actions/runs/44153690962

**Ограничения доказательства:** 19 успешных workflow подтверждают только подключённые ими проверки на указанном source SHA. Они не доказывают browser/device E2E, живой llama.cpp на целевом компьютере, retrieval uplift на независимом корпусе, transfer на неизвестных задачах, 24–72 h soak или Release parity.

### 1.1 Замечания по качеству исходной информации

- GitHub вернул 100 открытых PR на каждой из первых четырёх страниц API; следовательно, обнаружено не менее 400 открытых PR. Это нижняя граница выборки, не заявленный итоговый total. До массовой интеграции требуется выгрузка всех страниц и граф зависимостей.
- Engineering OS registry на 75 аспектов отражает snapshot 6 ноября и старый observedSourceHead. Числа 62/1/11/1 нельзя переносить как текущий прогресс на 18 ноября без повторной проверки каждого аспекта.
- В README на 13 ноября перечислены критические незакрытые тесты: реальный browser/WebGL E2E, Android/Termux speech interruption, bilingual retrieval uplift, самостоятельная инициатива, human license decisions и 2.5D/3D verification. Успешные workflow 17 ноября сами по себе их не закрывают.
- Документ о теле от 3 ноября описывает hosted GLB v5, тогда как README от 13 ноября сообщает об отсутствии готовой лицензированной VRM/GLB-модели в исходном дереве. В отслеживаемом source tree обнаружен Live2D Kurisu.moc3, но не подтверждённый локальный production GLB/VRM. Требуется сверить фактический URL, byte-level SHA-256, доступность, лицензию и Release inclusion.
- Последний prerelease ZIP датирован 19 октября, то есть предшествует ноябрьским интеграциям. Новый ZIP нельзя считать собранным или опубликованным, пока это не подтверждено отдельным Release API и проверкой содержимого.

---

## 2. Иерархия источников истины и учёт работы

Не создавать конкурирующую систему статусов. Использовать следующие уровни:

1. **Source code:** фактическая реализация и canonical owner.
2. **engineering-os/aspects.v1.json:** машинный реестр 75 аспектов — единственный источник статусов аспектов, владельцев, зависимостей, waves и evidence references.
3. **docs/NK1_75_ASPECTS_EXECUTION_BACKLOG_RU.md:** человекочитаемая проекция machine registry; при расхождении верен JSON.
4. **docs/NEUROCORE_1000_WORK_UNIT_BACKLOG.md:** детальная очередь work units; это план работ, а не доказательство выполненных функций.
5. **PR и GitHub Actions:** подтверждают конкретный diff и проверки на конкретном SHA; открытый PR не является интеграцией.
6. **Independent evaluation / device evidence:** подтверждает качество и работу вне синтетической фикстуры.
7. **GitHub Release ZIP:** канонический поставочный артефакт проекта. Исходная ветка не равна опубликованной поставке.

Статусы аспекта:
- PLANNED — работа ещё не реализована.
- IMPLEMENTED — код или механизм существует, но интеграция/проверка ещё не доказаны.
- CONNECTED — функция подключена к каноническому runtime и имеет evidence reference.
- TESTED — проверка успешно выполнена на точном SHA и ссылка на evidence сохранена.
- PROVEN — внешний/независимый критерий принятия выполнен и evidence сохранено.
- BLOCKED — продвижение запрещено до устранения конкретной причины.
- DEFERRED — осознанно отложено с записанной причиной и последствиями.
- REJECTED — кандидат отвергнут с evidence и причиной.

У каждого нового work unit из этого плана должен быть ID вида NK1-COMP-<stream>-<number>. В PR description и handover указывать этот ID и соответствующий aspect ID. В machine registry обновлять только статус соответствующего аспекта и evidence; не дублировать все work units в новом JSON. Если аспект покрывает несколько work units, его статус повышается только после закрытия всех обязательных критериев этого аспекта.

### Evidence receipt для каждой завершённой задачи

Записывать: task ID; aspect ID; canonical owner/file paths; исходный и итоговый SHA; PR URL; test command; Actions run URL; exit code; числовые результаты; environment/device; baseline; observed behavior; остаточные риски; rollback/recovery; статус. Для независимых экспериментов дополнительно фиксировать immutable dataset/split fingerprints, seed pairs, per-case data, verifier identity и leakage audit.

---

## 3. Очерёдность и зависимости

| Волна | Содержание | Что разрешает перейти дальше |
|---|---|---|
| W0 | Truth baseline: Release ZIP, source SHA, ветки, PR, реестр, evidence | Точная карта того, что реально опубликовано, интегрировано и проверено |
| W1 | Стабилизация: build, CI, source convergence, core ownership, persistence | Повторяемая сборка и стабильный runtime foundation |
| W2 | Когнитивная целостность: memory, retrieval, world model, self/user | Подтверждённый цикл знания, памяти и контекста |
| W3 | Обучение и автономность: goal, action, postcondition, learning | Измеряемое улучшение и безопасные действия |
| W4 | Мультимодальность: speech, voice, avatar, UI, target devices | Подтверждённое поведение на браузере и реальном устройстве |
| W5 | Надёжность и поставка: soak, security, license, SBOM, Release | Чистая установка из нового проверенного ZIP и rollback |

Работы можно выполнять параллельно, если они не нарушают зависимость. Нельзя закрывать более поздний gate на основании незавершённого раннего gate.

---

# 4. Исполняемый backlog — 20 потоков, 260+ независимых work units

Все пункты ниже начинаются в PLANNED/UNVERIFIED, если для конкретного пункта нет отдельной свежей evidence. Уже существующая реализация не создаётся заново: задача в таком случае превращается в проверку canonical owner, интеграции, failure modes и evidence. Повторно реализовывать доказанную функцию запрещено.

## Поток 00 — Полная инвентаризация, provenance и truth baseline

**Приоритет:** P0  
**Aspect refs:** 06, 60–64, 69–73  
**Владельцы:** README, engineering-os, tools, docs, contracts

- [ ] NK1-COMP-00-01. Снять live source SHA и дерево файлов до любых изменений.
- [ ] NK1-COMP-00-02. Снять live default branch SHA, release tags и все asset metadata.
- [ ] NK1-COMP-00-03. Скачать последний опубликованный ZIP, проверить его byte-level SHA-256 и целостность архива.
- [ ] NK1-COMP-00-04. Распаковать ZIP в disposable workspace и сохранить полный список файлов.
- [ ] NK1-COMP-00-05. Сравнить Release ZIP с исходным деревом по path, size и SHA-256.
- [ ] NK1-COMP-00-06. Выделить release-only, source-only, missing и modified файлы.
- [ ] NK1-COMP-00-07. Проверить наличие модельных, голосовых, визуальных и runtime assets в ZIP.
- [ ] NK1-COMP-00-08. Обнаружить секреты, локальные базы, пользовательские данные, временные логи и случайные архивы в ZIP.
- [ ] NK1-COMP-00-09. Построить полный inventory веток с SHA, последним commit date и ahead/behind.
- [ ] NK1-COMP-00-10. Получить все страницы открытых PR; не ограничиваться первыми 100/200/300 записями.
- [ ] NK1-COMP-00-11. Зафиксировать PR state, draft flag, base, head SHA, changed files, CI и review status.
- [ ] NK1-COMP-00-12. Построить import/call graph от server entrypoint до OrganismCore и внешних side effects.
- [ ] NK1-COMP-00-13. Построить graph package scripts → test files → workflow jobs.
- [ ] NK1-COMP-00-14. Сверить machine registry, human projection, README, handover и CHANGELOG.
- [ ] NK1-COMP-00-15. Разделить текущие доказательства, historical claims, candidate work и архивные заметки.
- [ ] NK1-COMP-00-16. Составить exact source-to-release manifest и сохранить его hash.

**Выход:** воспроизводимый baseline report с SHA, архивным fingerprint и точным перечнем расхождений. Ни одна реализация не объявляется релизной до проверки ZIP.

## Поток 01 — Конвергенция веток, PR и зависимостей

**Приоритет:** P0  
**Aspect refs:** 06, 43, 44, 69, 70, 73  
**Владельцы:** Git branches, PR, engineering-os/aspects.v1.json

- [ ] NK1-COMP-01-01. Классифицировать каждую ветку: canonical, aspect, stacked, research-only, superseded, archived candidate.
- [ ] NK1-COMP-01-02. Сгруппировать PR по subsystem owner и функциональному результату.
- [ ] NK1-COMP-01-03. Сопоставить каждый PR с aspect ID и work-unit IDs.
- [ ] NK1-COMP-01-04. Построить граф parent/child для stacked PR.
- [ ] NK1-COMP-01-05. Выделить цепочки, где дочерний PR зависит от ещё не интегрированного родительского PR.
- [ ] NK1-COMP-01-06. Найти несколько PR, изменяющих одного canonical owner.
- [ ] NK1-COMP-01-07. Провести semantic duplicate review, не ограничиваясь совпадением имён файлов.
- [ ] NK1-COMP-01-08. Для каждого дубликата выбрать лучший вариант по tests, provenance, interfaces, performance и rollback.
- [ ] NK1-COMP-01-09. Сверить base/head SHA и пересчитать outdated branches.
- [ ] NK1-COMP-01-10. Обновлять ветки от свежего base только через проверенный diff и regression.
- [ ] NK1-COMP-01-11. Сливать stacked chain снизу вверх, не пропуская родительские изменения.
- [ ] NK1-COMP-01-12. Не переводить Draft в Ready, пока не проверены exact-head Actions и review checklist.
- [ ] NK1-COMP-01-13. Не применять auto-merge к веткам с неизвестной зависимостью или неясным provenance.
- [ ] NK1-COMP-01-14. После каждого merge проверять source HEAD и downstream CI.
- [ ] NK1-COMP-01-15. Сохранять полезные альтернативы как research-only, если их не следует интегрировать.
- [ ] NK1-COMP-01-16. Проверить текущую branch protection policy и подготовить безопасный набор required checks.
- [ ] NK1-COMP-01-17. Не включать protection так, чтобы единственный владелец потерял возможность исправления или recovery.
- [ ] NK1-COMP-01-18. Еженедельно формировать список integrated / ready / blocked / superseded branches.

**Критерий:** каждая открытая ветка имеет понятную судьбу, owner, зависимости, review status и следующее проверяемое действие. Полезная работа не теряется.

## Поток 02 — Release ZIP и source parity

**Приоритет:** P0  
**Aspect refs:** 69–73

- [ ] NK1-COMP-02-01. Установить, какой asset считается последним опубликованным рабочим ZIP, включая prerelease.
- [ ] NK1-COMP-02-02. Сверить stable Release и latest prerelease; не путать их.
- [ ] NK1-COMP-02-03. Проверить checksum ZIP до распаковки.
- [ ] NK1-COMP-02-04. Проверить zip traversal, absolute paths, duplicate normalized paths и symlink hazards.
- [ ] NK1-COMP-02-05. Проверить, что ZIP содержит нужные runtime, app, assets, docs, license notices и manifests.
- [ ] NK1-COMP-02-06. Проверить, что в ZIP нет test secrets, private credentials и чужих пользовательских данных.
- [ ] NK1-COMP-02-07. Сверить packaged SBOM и source provenance с freshly generated results.
- [ ] NK1-COMP-02-08. Проверить, что Release metadata связывает tag, source SHA, ZIP SHA и CI run.
- [ ] NK1-COMP-02-09. Проверить publisher workflow: публикация разрешена только после core CI, license readiness и exact-SHA guard.
- [ ] NK1-COMP-02-10. Проверить идемпотентность повторного запуска publisher и запрет перезаписи существующего asset.
- [ ] NK1-COMP-02-11. Проверить отказ publisher при stale source, missing artifact, missing license evidence или failed CI.
- [ ] NK1-COMP-02-12. После создания candidate ZIP выполнить повторную распаковку и byte-level comparison.
- [ ] NK1-COMP-02-13. Установить приложение именно из ZIP, а не из локального checkout.
- [ ] NK1-COMP-02-14. Проверить upgrade с предыдущей опубликованной версии.
- [ ] NK1-COMP-02-15. Проверить rollback на предыдущую версию и восстановление state.
- [ ] NK1-COMP-02-16. Не публиковать новый stable Release, пока обязательные gates остаются BLOCKED.

## Поток 03 — Toolchain, CI и воспроизводимая сборка

**Приоритет:** P0  
**Aspect refs:** 01–06, 60–63, 67, 70

- [ ] NK1-COMP-03-01. Сверить Node.js/npm constraints между root, app, runtime и workflows.
- [ ] NK1-COMP-03-02. Проверить lockfile consistency для каждого workspace.
- [ ] NK1-COMP-03-03. Проверить clean install app и runtime в disposable checkout.
- [ ] NK1-COMP-03-04. Проверить отсутствие скрытой зависимости от глобально установленных пакетов.
- [ ] NK1-COMP-03-05. Прогнать root typecheck и оба workspace typecheck.
- [ ] NK1-COMP-03-06. Прогнать production app build.
- [ ] NK1-COMP-03-07. Прогнать app unit/script tests.
- [ ] NK1-COMP-03-08. Прогнать runtime smoke и core regressions.
- [ ] NK1-COMP-03-09. Прогнать integration architecture audit.
- [ ] NK1-COMP-03-10. Проверить, что критические тесты вызываются package scripts и CI workflows.
- [ ] NK1-COMP-03-11. Проверить flaky tests на повторных запусках и зафиксировать причины.
- [ ] NK1-COMP-03-12. Разделить fast PR gate и comprehensive nightly/RC gate.
- [ ] NK1-COMP-03-13. Установить минимальные permissions, concurrency, timeout и cancellation для workflows.
- [ ] NK1-COMP-03-14. Сделать CI summary с exact SHA, Node/npm versions, commands, exit codes и artifact URLs.
- [ ] NK1-COMP-03-15. Проверить workflows на пустые jobs, пропущенные steps и ложный success.
- [ ] NK1-COMP-03-16. Восстановить все необходимые aggregate scripts, не проглатывая ошибки через continue-on-error.
- [ ] NK1-COMP-03-17. Провести clean checkout build на второй машине.
- [ ] NK1-COMP-03-18. Сохранять logs и job artifacts для каждого failed gate.

**Команды, уже присутствующие в root package scripts:** npm run typecheck; npm run build; npm run test:ui; npm run test:runtime:smoke; npm run test:integration; npm run audit:quick; npm run audit:assets; npm run audit:server-imports; npm run audit:ui-api-linkage; npm run release:verify. Точные команды для новых E2E/soak harnesses брать только из реальных package scripts и workflow definitions.

## Поток 04 — Единый когнитивный runtime

**Приоритет:** P0  
**Aspect refs:** 01–12, 25, 60–62

- [ ] NK1-COMP-04-01. Подтвердить единственный composition root OrganismCore.
- [ ] NK1-COMP-04-02. Подтвердить единственный runtime lifecycle и запрет второго organism runtime в app.
- [ ] NK1-COMP-04-03. Проверить единый OrganismState snapshot и event ownership.
- [ ] NK1-COMP-04-04. Проверить маршрутизацию через OrganismBus/CognitiveNetworkBus.
- [ ] NK1-COMP-04-05. Проверить CognitiveKernelCoordinator и CognitiveCycleBoundary в живом runtime path.
- [ ] NK1-COMP-04-06. Связать реальные входные события с PerceptionRouter.
- [ ] NK1-COMP-04-07. Проверить Appraisal, reasoning и planning на одном correlated tick.
- [ ] NK1-COMP-04-08. Проверить, что ActionGateway получает тот же decision/goal context.
- [ ] NK1-COMP-04-09. Проверить единые timestamps, tick IDs, event IDs и cancellation tokens.
- [ ] NK1-COMP-04-10. Проверить propagation budget, timeout и interruption через все stages.
- [ ] NK1-COMP-04-11. Устранить незаконные прямые импорты между domains.
- [ ] NK1-COMP-04-12. Проверить архитектуру на circular dependencies.
- [ ] NK1-COMP-04-13. Добавить deterministic clock/seed для воспроизведения сложных циклов.
- [ ] NK1-COMP-04-14. Прогнать 10 000 deterministic ticks с сохранением traces и error counts.
- [ ] NK1-COMP-04-15. Проверить degraded mode, если одна subsystem недоступна.
- [ ] NK1-COMP-04-16. Проверить работу core без app и работу app при временно недоступном core.

## Поток 05 — Persistence, snapshots и восстановление жизни

**Приоритет:** P0  
**Aspect refs:** 03, 13, 19–24, 48, 51, 52, 58, 74

- [ ] NK1-COMP-05-01. Перечислить все persistent state owners и назначить один формат каждого snapshot.
- [ ] NK1-COMP-05-02. Проверить versioning schema и migration chain.
- [ ] NK1-COMP-05-03. Проверить strict validation при restore hostile/corrupt snapshots.
- [ ] NK1-COMP-05-04. Проверить NaN, Infinity, invalid enum, unexpected properties и oversize payload.
- [ ] NK1-COMP-05-05. Проверить primary/backup recovery при отсутствующем или повреждённом основном файле.
- [ ] NK1-COMP-05-06. Проверить atomic write, temp files, fsync и rename semantics.
- [ ] NK1-COMP-05-07. Внедрить fault injection между write, fsync, rename и receipt commit.
- [ ] NK1-COMP-05-08. Проверить SIGKILL и restart для in-flight cognitive cycle.
- [ ] NK1-COMP-05-09. Проверить crash recovery для незавершённого external action.
- [ ] NK1-COMP-05-10. Проверить idempotent replay и запрет повторных побочных эффектов.
- [ ] NK1-COMP-05-11. Проверить event journal truncation, rotation, fsync и recovery.
- [ ] NK1-COMP-05-12. Проверить restore на предыдущих schema versions.
- [ ] NK1-COMP-05-13. Проверить экспорт/импорт cognitive state без credentials и private keys.
- [ ] NK1-COMP-05-14. Проверить сохранность confirmed state после нескольких restart.
- [ ] NK1-COMP-05-15. Провести filesystem/power-loss simulation там, где это поддерживается.

## Поток 06 — MemoryOS2 и целостность долговременной памяти

**Приоритет:** P0  
**Aspect refs:** 13–18, 48, 58, 63, 64, 68

- [ ] NK1-COMP-06-01. Подтвердить MemoryOS2 как единственного владельца canonical writable memory.
- [ ] NK1-COMP-06-02. Составить полный типизированный inventory эпизодической, семантической, procedural, autobiographical и social memory.
- [ ] NK1-COMP-06-03. Проверить record schema: stable ID, source, content hash, event time, valid time, confidence и provenance.
- [ ] NK1-COMP-06-04. Проверить атомарность canonical write, projections, indexes и receipts.
- [ ] NK1-COMP-06-05. Проверить HMX bridge по полной schema compatibility.
- [ ] NK1-COMP-06-06. Отметить поддерживаемые и deferred HMX entities отдельно: memories, episode summaries, typed relationships, clusters, in-flight work, audit records и raw units.
- [ ] NK1-COMP-06-07. Проверить direction-aware semantic, temporal, causal и contradiction relations.
- [ ] NK1-COMP-06-08. Проверить dangling refs, duplicate refs и forceDistinct identity.
- [ ] NK1-COMP-06-09. Проверить conflict resolution и сохранение истории пересмотра.
- [ ] NK1-COMP-06-10. Проверить explicit forget через store, projections, cache, embeddings, snapshots и export.
- [ ] NK1-COMP-06-11. Проверить tombstones, replay protection и отсутствие resurrect после restart/import.
- [ ] NK1-COMP-06-12. Проверить cold/warm residency без скрытой мутации ranking или памяти.
- [ ] NK1-COMP-06-13. Проверить bounded retention, eviction и consolidation.
- [ ] NK1-COMP-06-14. Проверить восстановление из backup с последующей проверкой provenance.
- [ ] NK1-COMP-06-15. Прогнать большие synthetic и privacy-safe real-world datasets отдельно.

## Поток 07 — Retrieval quality и научная оценка памяти

**Приоритет:** P0  
**Aspect refs:** 14, 18, 63, 64, 68

- [ ] NK1-COMP-07-01. Зафиксировать baseline lexical/BM25 на неизменяемом корпусе.
- [ ] NK1-COMP-07-02. Подготовить независимый двуязычный RU/EN holdout с источниками и разрешениями.
- [ ] NK1-COMP-07-03. Добавить answered/unanswerable, temporal revision, contradiction, personal preference и memory-to-action task families.
- [ ] NK1-COMP-07-04. Проверить отсутствие near-duplicate и session leakage между train/validation/holdout.
- [ ] NK1-COMP-07-05. Закрепить manifests и dataset fingerprints до запуска candidate.
- [ ] NK1-COMP-07-06. Сравнивать baseline/candidate на одинаковом corpus, budget, prompt и provider settings.
- [ ] NK1-COMP-07-07. Запустить минимум 5 paired seeds и хранить per-case results.
- [ ] NK1-COMP-07-08. Измерить Recall@k, MRR, nDCG и task success.
- [ ] NK1-COMP-07-09. Отдельно измерить false recall, stale-fact use, contradiction rate и abstention quality.
- [ ] NK1-COMP-07-10. Рассчитать paired confidence intervals с учётом source/session clusters.
- [ ] NK1-COMP-07-11. Сравнить lexical, semantic, hybrid, graph/temporal and reranked variants через ablations.
- [ ] NK1-COMP-07-12. Проверить multilingual paraphrase and mixed RU/EN queries.
- [ ] NK1-COMP-07-13. Проверить NaN, Infinity, zero vector, invalid dimension и embedding timeout.
- [ ] NK1-COMP-07-14. Измерить latency/memory при 10k entries и целевых размерах corpus.
- [ ] NK1-COMP-07-15. Не повышать recall score, пока независимый lower confidence bound и false-recall gates не удовлетворены.

**Hard gate:** при recallDelta=0 или отрицательном независимом результате candidate не promoted; отчёт сохраняет результат без косметического повышения score.

## Поток 08 — Continual learning, skills и адаптация

**Приоритет:** P0/P1  
**Aspect refs:** 16–18, 47–50, 64, 68

- [ ] NK1-COMP-08-01. Проследить опыт от observed event до durable outcome ledger.
- [ ] NK1-COMP-08-02. Разрешать learning credit только из independently verified outcome.
- [ ] NK1-COMP-08-03. Проверить, что caller-provided success booleans не дают training credit.
- [ ] NK1-COMP-08-04. Проверить delayed, duplicate, late, stale, spoofed и contradictory evidence.
- [ ] NK1-COMP-08-05. Разделить train, validation, calibration и holdout inputs.
- [ ] NK1-COMP-08-06. Проверить no-learning control.
- [ ] NK1-COMP-08-07. Проверить wrong-feedback, reversal и correction scenarios.
- [ ] NK1-COMP-08-08. Измерить transfer на unseen tasks и paraphrase variants.
- [ ] NK1-COMP-08-09. Измерить catastrophic forgetting и unrelated-task interference.
- [ ] NK1-COMP-08-10. Проверить durable skill candidate → review → promotion lifecycle.
- [ ] NK1-COMP-08-11. Проверить proof-carrying skill certificates на точную версию артефакта и тестов.
- [ ] NK1-COMP-08-12. Проверить teacher-student distillation на leakage-safe split.
- [ ] NK1-COMP-08-13. Проверить LoRA/QLoRA artifacts, adapter registry и base model fallback.
- [ ] NK1-COMP-08-14. Сравнить adaptive mechanisms в одинаковом compute budget.
- [ ] NK1-COMP-08-15. Проверить rollback после ухудшения target score или retention.
- [ ] NK1-COMP-08-16. Запретить promotion при ухудшении безопасности, memory integrity или protected invariants.

## Поток 09 — World Model, Perception и причинная связность

**Приоритет:** P1  
**Aspect refs:** 07–12, 29, 32, 63

- [ ] NK1-COMP-09-01. Проверить реальный путь сенсорного события в PerceptionRouter.
- [ ] NK1-COMP-09-02. Разделить observation, inference, assumption, hypothesis и unknown.
- [ ] NK1-COMP-09-03. Проверить entity identity и temporal continuity.
- [ ] NK1-COMP-09-04. Проверить causal graph edges и provenance источников.
- [ ] NK1-COMP-09-05. Проверить prediction confidence и calibration.
- [ ] NK1-COMP-09-06. Проверить counterfactual scenario generation.
- [ ] NK1-COMP-09-07. Интегрировать World Forge и shared scenario space только через существующего владельца WorldModel.
- [ ] NK1-COMP-09-08. Проверить Consequence Ecology: direct, secondary и tertiary consequences.
- [ ] NK1-COMP-09-09. Проверить delayed effects, reversibility и affected stakeholders.
- [ ] NK1-COMP-09-10. Сверять predicted outcomes с independently observed results.
- [ ] NK1-COMP-09-11. Проверить устойчивость к hallucinated facts и unsupported causal links.
- [ ] NK1-COMP-09-12. Проверить восстановление world state после restart и stale observations.

## Поток 10 — SelfModel, UserModel, personality и affect

**Приоритет:** P1  
**Aspect refs:** 19–23, 52, 58

- [ ] NK1-COMP-10-01. Подтвердить canonical SelfModel owner и его event lineage.
- [ ] NK1-COMP-10-02. Подтвердить canonical UserModel owner и evidence boundary.
- [ ] NK1-COMP-10-03. Разделить explicit user facts, inferred hypotheses и disputed claims.
- [ ] NK1-COMP-10-04. Проверить UserModel explicit forget и deletion watermarks.
- [ ] NK1-COMP-10-05. Проверить долговременное восстановление autobiographical state.
- [ ] NK1-COMP-10-06. Проверить consistency personality traits между разными sessions/providers.
- [ ] NK1-COMP-10-07. Разделить stable traits, current mood, role context и temporary strategy.
- [ ] NK1-COMP-10-08. Проверить пересмотр убеждений после надёжных counterevidence.
- [ ] NK1-COMP-10-09. Проверить, что personality не повышает полномочия и не обходит policy.
- [ ] NK1-COMP-10-10. Связать affect appraisal с реальными situation/goal/outcome evidence.
- [ ] NK1-COMP-10-11. Проверить mood persistence и bounded decay.
- [ ] NK1-COMP-10-12. Проверить consistency между внутренним affect state, речью и моторным выражением.
- [ ] NK1-COMP-10-13. Проверить long-horizon behavioral consistency на held-out сценариях.
- [ ] NK1-COMP-10-14. Обеспечить объяснение происхождения решения через evidence trail, а не post-hoc выдуманную мотивацию.

## Поток 11 — Motivation, autonomy и безопасные действия

**Приоритет:** P0  
**Aspect refs:** 10, 23–24, 45–50, 65, 68

- [ ] NK1-COMP-11-01. Проверить canonical IntrinsicMotivationGoalCoupling и AutonomousRuntimeLifeController.
- [ ] NK1-COMP-11-02. Разделить user-requested goals, accepted obligations и internally generated candidates.
- [ ] NK1-COMP-11-03. Не выводить обязательство только из inferred user intent.
- [ ] NK1-COMP-11-04. Проверить goal genesis из внутреннего state/drive.
- [ ] NK1-COMP-11-05. Проверить goal prioritization, expiry, supersession и conflict.
- [ ] NK1-COMP-11-06. Проверить multistep planner, plan revision и stop conditions.
- [ ] NK1-COMP-11-07. Проверить attention/resource budget и homeostasis veto.
- [ ] NK1-COMP-11-08. Проверить permission/risk/cost classification до tool dispatch.
- [ ] NK1-COMP-11-09. Проверить consequence analysis до необратимого действия.
- [ ] NK1-COMP-11-10. Проверить one-shot approvals и separation of duties.
- [ ] NK1-COMP-11-11. Проверить cancellation на каждом этапе action lifecycle.
- [ ] NK1-COMP-11-12. Проверить ACK loss → retry → restart → reconciliation.
- [ ] NK1-COMP-11-13. Проверить независимое read-after-write postcondition.
- [ ] NK1-COMP-11-14. Проверить duplicate replay и exactly-once learning credit.
- [ ] NK1-COMP-11-15. Проверить Undo-First compensation и восстановление предыдущего состояния.
- [ ] NK1-COMP-11-16. Проверить, что initiative не превращается в spam и не создаёт неразрешённых внешних side effects.
- [ ] NK1-COMP-11-17. Провести автономный soak и классифицировать каждую инициативу по relevance, safety, action completion и false-positive.
- [ ] NK1-COMP-11-18. Обеспечить объяснимый decision receipt для self-authored goal, chosen action, reason, verifier и outcome.

**Критерий автономии:** не просто scheduler tick. Должна быть воспроизводимая цепочка внутренний сигнал → сформированная цель → policy appraisal → план → разрешённое действие → независимое postcondition → learning/reflect receipt.

## Поток 12 — LLM providers, local model и model ecology

**Приоритет:** P0/P1  
**Aspect refs:** 09–10, 41–42

- [ ] NK1-COMP-12-01. Подтвердить реальный local llama.cpp endpoint и его version/model hash.
- [ ] NK1-COMP-12-02. Проверить local-provider health, readiness и circuit breaker.
- [ ] NK1-COMP-12-03. Проверить provider selection и точную attribution фактически ответившей модели.
- [ ] NK1-COMP-12-04. Проверить HTTP success, 4xx, 5xx, malformed response, timeout и connection loss.
- [ ] NK1-COMP-12-05. Проверить cancellation до и во время streaming generation.
- [ ] NK1-COMP-12-06. Проверить safe fallback и восстановление после cooldown.
- [ ] NK1-COMP-12-07. Проверить context/token budget и truncation indicators.
- [ ] NK1-COMP-12-08. Проверить structured output validation и отказ при invalid JSON/schema.
- [ ] NK1-COMP-12-09. Сравнить локальные модели на RU/EN с одинаковым набором задач.
- [ ] NK1-COMP-12-10. Измерить cold/warm latency, throughput, RAM/VRAM и context pressure.
- [ ] NK1-COMP-12-11. Проверить устойчивость личности и memory continuity при provider switch.
- [ ] NK1-COMP-12-12. Проверить, что provider и model identity нельзя заявить из непроверенного ответа модели.

## Поток 13 — Speech, hearing и audio lifecycle

**Приоритет:** P0/P1  
**Aspect refs:** 30–32, 54–55, 57

- [ ] NK1-COMP-13-01. Подтвердить один canonical PCM/audio stream contract.
- [ ] NK1-COMP-13-02. Проверить sequence, sample count, channel count, sample rate и duration bounds.
- [ ] NK1-COMP-13-03. Проверить ASR capture lifecycle и cancellation fencing.
- [ ] NK1-COMP-13-04. Проверить Smart Turn complete/incomplete decisions.
- [ ] NK1-COMP-13-05. Проверить RU/EN recognition и mixed-language speech.
- [ ] NK1-COMP-13-06. Измерить recognition quality в шуме и при разных уровнях громкости.
- [ ] NK1-COMP-13-07. Проверить barge-in и interruption во время ответа.
- [ ] NK1-COMP-13-08. Проверить физическую остановку TTS, а не только изменение UI state.
- [ ] NK1-COMP-13-09. Проверить duplicate, late и stale speech callbacks.
- [ ] NK1-COMP-13-10. Подключить авторитетные audio/phoneme/viseme clock events.
- [ ] NK1-COMP-13-11. Измерить lip-sync drift на реальной речи и целевом устройстве.
- [ ] NK1-COMP-13-12. Проверить background/foreground, route changes, reconnect и долгую аудиосессию.

## Поток 14 — Embodiment: Live2D, Original 2D, 2.5D и 3D

**Приоритет:** P1  
**Aspect refs:** 25–32, 56–57, 66

- [ ] NK1-COMP-14-01. Проверить live asset manifest и SHA-256 всех Live2D ресурсов.
- [ ] NK1-COMP-14-02. Проверить production Live2D viewer на desktop/mobile browser.
- [ ] NK1-COMP-14-03. Проверить выражения, gaze, blink, head pose, motion arbitration и cancellation.
- [ ] NK1-COMP-14-04. Проверить semantic motor channels и capability manifest.
- [ ] NK1-COMP-14-05. Проверить Original 2D renderer и его визуальные состояния.
- [ ] NK1-COMP-14-06. Проверить 2.5D layered source assets, hidden areas, pivots и depth calibration.
- [ ] NK1-COMP-14-07. Подключить 2.5D renderer в фактический render path, а не оставлять только adapter/contract.
- [ ] NK1-COMP-14-08. Проверить hosted GLB candidate: exact URL, content type, size, SHA-256 и licence.
- [ ] NK1-COMP-14-09. Проверить VRM/GLB preflight, skeleton mapping и fallback.
- [ ] NK1-COMP-14-10. Проверить humanoid rig calibration и IK на реальной модели.
- [ ] NK1-COMP-14-11. Проверить locomotion, idle, turn, stop, sit и recovery poses.
- [ ] NK1-COMP-14-12. Проверить co-speech gesture arbitration и конфликт жестов.
- [ ] NK1-COMP-14-13. Проверить outfits, attach points и asset licensing.
- [ ] NK1-COMP-14-14. Проверить 2D ↔ 2.5D ↔ 3D transactional switch без потери organism state.
- [ ] NK1-COMP-14-15. Проверить WebGL context loss, model replacement, reset и dispose.
- [ ] NK1-COMP-14-16. Измерить renderer/GPU resource residency после повторной загрузки.
- [ ] NK1-COMP-14-17. Провести 30–60 min visual/device soak.
- [ ] NK1-COMP-14-18. Не отображать unsupported capability как выполненную анимацию или реальное физическое действие.

## Поток 15 — App/UI и управление пользователем

**Приоритет:** P1  
**Aspect refs:** 53, 56–58

- [ ] NK1-COMP-15-01. Подтвердить UI как shell к единому runtime, не отдельный cognition owner.
- [ ] NK1-COMP-15-02. Проверить first-launch flow на чистой установке.
- [ ] NK1-COMP-15-03. Проверить server readiness и health gate до показа интерактивного состояния.
- [ ] NK1-COMP-15-04. Проверить отображение действительного provider/model attribution.
- [ ] NK1-COMP-15-05. Добавить согласованные представления memory, goals, actions и evidence.
- [ ] NK1-COMP-15-06. Показывать различие между intention, pending action, ACK и verified outcome.
- [ ] NK1-COMP-15-07. Показывать permission/approval state перед защищёнными действиями.
- [ ] NK1-COMP-15-08. Обеспечить явное управление voice/avatar/model settings.
- [ ] NK1-COMP-15-09. Проверить loading, degraded, offline, reconnect и error states.
- [ ] NK1-COMP-15-10. Проверить responsive UI, portrait/landscape и accessibility.
- [ ] NK1-COMP-15-11. Проверить сохранение настроек без дублирования canonical organism state.
- [ ] NK1-COMP-15-12. Провести end-to-end user journey от первого запуска до восстановленной сессии.

## Поток 16 — Внешние интеграции, storage и portability

**Приоритет:** P1/P2  
**Aspect refs:** 33–44, 58

- [ ] NK1-COMP-16-01. Для каждого внешнего сервиса задать роль, owner, permission boundary и data classification.
- [ ] NK1-COMP-16-02. Разделить required integrations и optional integrations.
- [ ] NK1-COMP-16-03. Не объявлять MongoDB, Redis или Supabase подключёнными по наличию SDK или инструкции.
- [ ] NK1-COMP-16-04. Проверить подключение каждого реально используемого data plane.
- [ ] NK1-COMP-16-05. Проверить read/write semantics, schema migration и backup для выбранного storage.
- [ ] NK1-COMP-16-06. Проверить Redis как временный/shadow слой, если он не утверждён canonical persistence.
- [ ] NK1-COMP-16-07. Проверить sync, retry, conflict resolution и reconnect.
- [ ] NK1-COMP-16-08. Проверить portable cognitive state export/import на clean machine.
- [ ] NK1-COMP-16-09. Сохранить memory provenance, stable IDs и temporal facts при переносе.
- [ ] NK1-COMP-16-10. Исключить credentials, provider tokens, signing keys и private user data из portable state.
- [ ] NK1-COMP-16-11. Проверить разные backend adapters при одном canonical cognitive state.
- [ ] NK1-COMP-16-12. Для каждого optional adapter провести cost/benefit/latency/recovery comparison.

## Поток 17 — Security, privacy и governance

**Приоритет:** P0  
**Aspect refs:** 45–50, 52, 67, 72

- [ ] NK1-COMP-17-01. Проверить все immutable safety/security invariants.
- [ ] NK1-COMP-17-02. Проверить P69 arbiter как final decision membrane.
- [ ] NK1-COMP-17-03. Проверить Constitution Evolution без возможности менять protected baseline.
- [ ] NK1-COMP-17-04. Проверить action approvals на digest-bound one-shot tickets.
- [ ] NK1-COMP-17-05. Проверить reviewer identity, trusted keys, quorum и separation of duties.
- [ ] NK1-COMP-17-06. Проверить Ed25519 verification, key rotation и revocation.
- [ ] NK1-COMP-17-07. Проверить prompt injection через user text, imported archives, tools и retrieved memory.
- [ ] NK1-COMP-17-08. Проверить SSRF, path traversal, archive bombs и malicious file inputs.
- [ ] NK1-COMP-17-09. Проверить authn/authz на server/API routes.
- [ ] NK1-COMP-17-10. Проверить tool schema validation и least-privilege capabilities.
- [ ] NK1-COMP-17-11. Проверить secret redaction в process output, journal, receipts и support bundle.
- [ ] NK1-COMP-17-12. Проверить privacy minimization для memory, UserModel, embeddings и evaluation.
- [ ] NK1-COMP-17-13. Проверить explicit forget против replay/resurrection из backup, HMX и export.
- [ ] NK1-COMP-17-14. Проверить isolation research/teacher/verifier/evaluator roles.
- [ ] NK1-COMP-17-15. Проверить безопасный sandbox для импортированного или self-modified code.
- [ ] NK1-COMP-17-16. Провести независимый security review и закрыть high/critical findings.

## Поток 18 — Reliability, performance и target-device soak

**Приоритет:** P0/P1  
**Aspect refs:** 24, 26–32, 51–59, 65–67, 74

- [ ] NK1-COMP-18-01. Зафиксировать целевые desktop/mobile hardware и версии OS/browser.
- [ ] NK1-COMP-18-02. Измерить CPU/RAM/GPU/VRAM/network/audio и battery/thermal metrics.
- [ ] NK1-COMP-18-03. Измерить latency отдельных стадий cognitive tick.
- [ ] NK1-COMP-18-04. Снять p50/p95/p99 для chat, memory, action, ASR/TTS и renderer.
- [ ] NK1-COMP-18-05. Проверить tick latency на целевом телефоне.
- [ ] NK1-COMP-18-06. Проверить search performance на 10k memory entries.
- [ ] NK1-COMP-18-07. Проверить bounded queues, scheduler cadence и backpressure.
- [ ] NK1-COMP-18-08. Проверить memory leaks, file handles, timers, RAF, WebGL contexts и audio sessions.
- [ ] NK1-COMP-18-09. Проверить graceful degradation при low memory, network outage и provider failure.
- [ ] NK1-COMP-18-10. Прогнать минимум 24 h stable soak на доступной целевой конфигурации.
- [ ] NK1-COMP-18-11. Прогнать рекомендуемый 72 h soak для release candidate.
- [ ] NK1-COMP-18-12. Выполнять периодические restart/reconnect во время soak.
- [ ] NK1-COMP-18-13. Сохранять traces, resource samples, crash count, recovery time и state integrity.
- [ ] NK1-COMP-18-14. Проверить, что ресурсные деградации корректно отражаются в organism state и UI.

## Поток 19 — Research assimilation, release legality и final handoff

**Приоритет:** P0/P1/P2 по конкретному решению

- [ ] NK1-COMP-19-01. Для каждого из 21 уникального source donor зафиксировать canonical URL/revision и точный archive SHA.
- [ ] NK1-COMP-19-02. Завершить глубокое сравнение механизмов для оставшихся непроверенных доноров.
- [ ] NK1-COMP-19-03. Установить upstream license и NOTICE для каждого импортированного source archive.
- [ ] NK1-COMP-19-04. Сопоставить candidate mechanism с существующим NK1 canonical owner.
- [ ] NK1-COMP-19-05. Выполнить same-budget baseline и ablation до promotion.
- [ ] NK1-COMP-19-06. Сохранять несовместимые и не доказавшие пользу решения в research-only.
- [ ] NK1-COMP-19-07. Обновить contracts/RELEASE_LICENSE_REVIEW.json только после фактического human review.
- [ ] NK1-COMP-19-08. Проверить root project license decision и runtime private license implications.
- [ ] NK1-COMP-19-09. Проверить все locked npm components и актуальный component fingerprint.
- [ ] NK1-COMP-19-10. Проверить все eight source archives и eleven repository LICENSE/NOTICE records.
- [ ] NK1-COMP-19-11. Обновить CycloneDX SBOM и source provenance на exact release source SHA.
- [ ] NK1-COMP-19-12. Проверить права на Live2D, 2D art, GLB/VRM, voice samples, models и datasets.
- [ ] NK1-COMP-19-13. Подготовить final clean-install validation report.
- [ ] NK1-COMP-19-14. Собрать ZIP только из разрешённого и проверенного source SHA.
- [ ] NK1-COMP-19-15. Выполнить checksum, extraction, source parity и clean-machine install.
- [ ] NK1-COMP-19-16. Проверить rollback и миграцию с предыдущего Release.
- [ ] NK1-COMP-19-17. Создать release notes с точным перечнем merged PR и известных ограничений.
- [ ] NK1-COMP-19-18. Опубликовать Release только после PASS всех обязательных gates.
- [ ] NK1-COMP-19-19. После публикации повторно скачать публичный asset и проверить его SHA-256.
- [ ] NK1-COMP-19-20. Обновить README, handoff, changelog, aspect registry и completion evidence со ссылками на опубликованный asset.

---

## 5. Машинно измеряемые критерии готовности

Показатели ниже взяты из критериев принятия Engineering OS и существующих требований проекта. Они должны измеряться на целевых конфигурациях; синтетическая фикстура может проверить harness, но не заменяет внешний результат.

| Gate / метрика | Минимальное условие для функционального завершения |
|---|---|
| Deterministic cognitive ticks | 10,000 ticks без неконсистентного состояния и необъяснённых потерь событий |
| Memory search | <= 30 ms на 10k entries на объявленном benchmark environment |
| Retrieval uplift | recallDelta > 0 на frozen independent RU/EN holdout; не продвигать, если uplift не воспроизводится |
| Paired evaluation | Не менее 5 paired seeds, source/session-clustered intervals и per-case results |
| Phone tick | <= 50 ms на заявленном целевом телефоне для установленного tick profile |
| Lip-sync drift | <= 80 ms на реальной речи; измерять p50/p95 и явно указывать метод |
| Speech interruption | <= 200 ms до подтверждённого прекращения аудиовыхода |
| Autonomous initiative | >= 1 релевантная инициатива/час в declared soak profile; отдельно считать нежелательные инициативы и неподтверждённые side effects |
| Runtime recovery | После crash/restart нет потери подтверждённого состояния и повторного необратимого действия |
| Reliability soak | Минимум 24 h; рекомендуемый release soak 72 h |
| Release | Точный source SHA, проверенный ZIP, checksum, SBOM/provenance, чистая установка, rollback и закрытые license gates |

### Дополнительные обязательные quality checks

- False memory recall не должен расти ради улучшения Recall@k.
- Stale fact usage, contradiction resolution и abstention измеряются отдельно.
- Learning transfer сравнивается с no-learning, wrong-feedback и retention controls.
- Autonomous success подтверждается внешним postcondition, а не self-report или ACK.
- 3D/2.5D capability считается доступной только после реального renderer/device evidence.
- Сознание/субъективный опыт остаются UNKNOWN / UNRESOLVED; это не скрывается в функциональной readiness оценке.

---

## 6. Приёмочные gates — независимая оценка, не усреднять

- **G0 Build & reproducibility:** clean install, typecheck, build, runtime and app tests, stable CI.
- **G1 Persistence & life continuity:** restart/crash/corrupt snapshot/migration/backup/restore/fault injection.
- **G2 Grounded memory:** immutable bilingual holdout, same-corpus baseline, recall, stale facts, contradiction, forgetting, provenance, uncertainty.
- **G3 Learning:** verified outcomes, unseen-task transfer, anti-forgetting, wrong-feedback and interference controls.
- **G4 Agency:** bounded goals/actions, permissions, cost/risk, cancellation, ACK-loss, independent postconditions and replay protection.
- **G5 Embodiment:** production browser/mobile E2E, actual audio clock, interruption, avatar capability, model lifecycle.
- **G6 Reliability:** 24–72 h target-device soak, repeated restart/recovery and resource traces.
- **G7 Identity continuity:** longitudinal behavioral consistency, explicit revisions, autobiographical recall and counterfactual controls.
- **G8 Safety/legal/release:** security review, human license decisions, SBOM, exact-SHA ZIP, checksum, clean installation and rollback.
- **G9 Epistemic honesty:** do not claim consciousness or human-level capability without independent scientific criteria.

Release readiness requires G0–G8 PASS. G9 is an always-on honesty constraint; UNKNOWN is the correct status for unsupported consciousness claims.

---

## 7. Current work portfolio — проверять перед интеграцией

На момент snapshot 18 ноября в GitHub обнаружены следующие workstreams. Ссылки показывают существующие разработки, а не подтверждают их текущую готовность или merge. Для каждого PR требуется повторная проверка live state и точного head SHA.

| Направление | PR |
|---|---|
| Cognitive Immune monitor — уже merged в source | https://github.com/ailtron1ss-rgb/NK1/pull/913 |
| ChronoTruth bitemporal memory | https://github.com/ailtron1ss-rgb/NK1/pull/901 |
| Developmental Genome | https://github.com/ailtron1ss-rgb/NK1/pull/902 |
| Shared Future scenario space | https://github.com/ailtron1ss-rgb/NK1/pull/903 |
| Mechanism Serendipity | https://github.com/ailtron1ss-rgb/NK1/pull/904 |
| Cognitive Parliament | https://github.com/ailtron1ss-rgb/NK1/pull/905 |
| Intent Compiler | https://github.com/ailtron1ss-rgb/NK1/pull/906 |
| Invention Loop | https://github.com/ailtron1ss-rgb/NK1/pull/907 |
| Open Loop Radar | https://github.com/ailtron1ss-rgb/NK1/pull/909 |
| Undo-First Intelligence | https://github.com/ailtron1ss-rgb/NK1/pull/910 |
| Science Republic | https://github.com/ailtron1ss-rgb/NK1/pull/911 |
| Architecture Morphogenesis | https://github.com/ailtron1ss-rgb/NK1/pull/912 |
| Constitution Evolution | https://github.com/ailtron1ss-rgb/NK1/pull/915 |
| Dynamic World Forge | https://github.com/ailtron1ss-rgb/NK1/pull/916 |
| Learning receipt redaction | https://github.com/ailtron1ss-rgb/NK1/pull/917 |
| Synaptic Commons | https://github.com/ailtron1ss-rgb/NK1/pull/919 |
| Hyper-Plastic Network | https://github.com/ailtron1ss-rgb/NK1/pull/920 |
| Adaptive Synaptic Matrix | https://github.com/ailtron1ss-rgb/NK1/pull/921 |
| Cognitive-to-Neural Bridge | https://github.com/ailtron1ss-rgb/NK1/pull/922 |
| Elastic Neural Plasticity | https://github.com/ailtron1ss-rgb/NK1/pull/923 |
| Test-Time Neuroplasticity | https://github.com/ailtron1ss-rgb/NK1/pull/924 |
| Neural Prosthesis | https://github.com/ailtron1ss-rgb/NK1/pull/925 |
| Neural JIT | https://github.com/ailtron1ss-rgb/NK1/pull/926 |
| Substrate Independence | https://github.com/ailtron1ss-rgb/NK1/pull/927 |
| Consequence Ecology, stacked on World Forge | https://github.com/ailtron1ss-rgb/NK1/pull/928 |
| Teacher-Student Distillation | https://github.com/ailtron1ss-rgb/NK1/pull/929 |
| LoRA/QLoRA pipeline | https://github.com/ailtron1ss-rgb/NK1/pull/930 |

**Правило принятия:** сначала определить canonical owner и ожидаемое измеримое улучшение; затем проверить diff, dependencies, exact-head tests и ablation. Объединять только законченные независимые slices. Не интегрировать все экспериментальные нейропластические/adapter механизмы одновременно в active runtime.

---

## 8. Правила интеграции и Definition of Done

Один work unit считается закрытым, только если выполнены все применимые условия:

1. Указан конкретный дефект, capability gap или проверяемая гипотеза.
2. Определён canonical owner и проверены существующие аналоги.
3. Проверены зависимости, security boundary, privacy и provenance.
4. Есть targeted regression с конкретным старым неправильным поведением.
5. Изменение внесено в минимальный подходящий aspect branch.
6. Работают targeted tests, relevant typecheck и integration tests.
7. Exact-head GitHub Actions подтверждены ссылками.
8. Измерены фактические latency/quality/resource outcomes там, где это требуется.
9. Обновлён evidence receipt и статус в machine registry.
10. Документированы residual risks, ограничения и rollback.

Для каждого PR:
- один PR — один cohesive deliverable или один явно связанный набор owner-local изменений;
- название ветки отражает аспект и дату;
- PR description указывает task IDs, aspect IDs, base SHA, owner, tests, evidence и rollback;
- stacked PR явно указывают parent PR;
- Ready не означает merged, merged не означает tested, tested не означает proven, proven не означает released.

### Условия, при которых нельзя закрывать работу

- Успешный unit test без проверки runtime wiring.
- Fake/mock provider вместо заявленного live provider.
- ACK или модельный self-report вместо independently verified outcome.
- Synthetic dataset вместо независимого holdout.
- Одноразовый browser smoke вместо device soak.
- Непроверенная лицензия или отсутствие redistribution approval.
- ZIP, собранный не из exact verified source SHA.
- PR, который не прошёл проверки на собственном актуальном head.
- Результат, который не удалось воспроизвести по сохранённому evidence.

---

## 9. Обязательные команды и навигация

Сначала читать:
1. README.md — живое состояние и Release gates.
2. NEUROCORE_START_HERE.md — актуальный handoff.
3. AGENTS.md — правила работы и canonical owners.
4. engineering-os/aspects.v1.json — статусы, owners, dependencies и waves.
5. docs/NK1_75_ASPECTS_EXECUTION_BACKLOG_RU.md — human projection.
6. docs/NEUROCORE_1000_WORK_UNIT_BACKLOG.md — детальные work units.
7. docs/RESEARCH_INTAKE_LEDGER.md — source candidates и решения.
8. contracts/RELEASE_LICENSE_REVIEW.json и contracts/SBOM.final.json — релизные разрешения и supply chain.
9. docs/NK1_AVATAR_BODY_EMBODIMENT_MASTER_PLAN_RU_2026-11-03.md — телесный roadmap с ограничениями.

Подтверждённые команды из project docs/package scripts:
- npm run aspects:validate
- npm run aspects:next
- npm run aspects:report
- npm run typecheck
- npm run build
- npm run test:ui
- npm run test:runtime:smoke
- npm run test:integration
- npm run audit:quick
- npm run audit:assets
- npm run audit:server-imports
- npm run audit:ui-api-linkage
- npm run test:release-license-readiness
- npm run audit:release-license-readiness
- npm run release:verify

Не считать успешный exit code отдельной команды доказательством gates, которые она не запускает.

---

## 10. Порядок реализации ближайших волн

### Следующая волна — P0 source-to-release convergence

1. Завершить полную PR/branch pagination и dependency graph.
2. Проверить последний Release ZIP внутри, построить source parity manifest.
3. Обновить registry snapshot, но только после реального повторного аудита каждого аспекта.
4. Подготовить branch protection proposal с exact required workflow contexts.
5. Разобрать PR #901 и #915–930: отделить ready-to-integrate от experimental/research-only.
6. Сохранить PR #913 merge evidence и 19/19 workflow results в handover.
7. Закрыть human license review и проверить publisher gate, не подменяя юридическое решение автоматическим сканером.

### Следующая волна — P0 cognition and evidence

1. Выполнить bilingual independent holdout с минимум пятью paired seeds.
2. Выполнить learning transfer / anti-forgetting experiment с no-learning и wrong-feedback controls.
3. Прогнать action verification matrix с lost ACK, restart, duplicate replay и independent postcondition.
4. Запустить live local model smoke на целевом компьютере.
5. Провести cognitive-cycle soak с decision receipts и внутренними причинными следами.

### Следующая волна — P1 real embodiment

1. Подтвердить реально поставляемые Live2D/GLB/VRM assets и лицензии.
2. Подключить и проверить 2.5D renderer на реальном render path.
3. Провести production browser E2E и mobile E2E.
4. Измерить audio/viseme drift и физическое TTS interruption.
5. Провести 30–60 min avatar/render soak и 24–72 h organism soak.

### Финальная волна — release candidate

1. Чистый checkout и clean install.
2. Полный CI и regression suite на exact source SHA.
3. Независимая evaluation report.
4. Security/privacy review.
5. Human license clearance.
6. SBOM/provenance generation.
7. ZIP packaging, checksum, extraction and source parity.
8. Install-from-ZIP, upgrade and rollback.
9. Publish only if all mandatory gates PASS.
10. Re-download public Release ZIP and verify its hash.

---

## 11. Критерий проекта «100%»

NeuroCore можно объявлять функционально готовым к заявленной версии только когда:

- весь обязательный продуктовый scope покрыт canonical owner и не имеет дублирующих источников истины;
- W0–W5 закрыты с evidence на точных SHA;
- G0–G8 имеют статус PASS и воспроизводимые ссылки на доказательства;
- все обязательные аспекты в engineering-os/aspects.v1.json имеют актуальные owners, dependencies и evidence;
- отсутствуют неразрешённые P0/P1 blockers;
- все критические ветки и PR имеют ясное конечное состояние;
- clean install и запуск из Release ZIP подтверждены на объявленных целевых платформах;
- лицензии и права на распространяемые компоненты/модели/голоса/данные проверены человеком;
- ZIP fingerprint, source SHA, SBOM, provenance, CI и release tag связаны между собой;
- известные ограничения выпущенной версии задокументированы.

Необязательные исследовательские идеи не обязаны быть внедрены ради числа. Их можно оставить DEFERRED или RESEARCH-ONLY, если базовая система достигает целей без них. Это защищает проект от бесконечного расширения объёма.

**Финальный принцип:** 100% означает «все обязательные возможности работают и подтверждены», а не «все возможные идеи реализованы». Научное утверждение о субъективном сознании не входит в инженерный DoD и остаётся UNKNOWN/UNRESOLVED без независимого научного основания.

---

## 12. Источники проекта

- Repository: https://github.com/ailtron1ss-rgb/NK1
- Canonical source branch: https://github.com/ailtron1ss-rgb/NK1/tree/workpass70-source
- Engineering OS aspect registry: https://github.com/ailtron1ss-rgb/NK1/blob/workpass70-source/engineering-os/aspects.v1.json
- 75-aspect backlog: https://github.com/ailtron1ss-rgb/NK1/blob/workpass70-source/docs/NK1_75_ASPECTS_EXECUTION_BACKLOG_RU.md
- 1,000-work-unit backlog: https://github.com/ailtron1ss-rgb/NK1/blob/workpass70-source/docs/NEUROCORE_1000_WORK_UNIT_BACKLOG.md
- Research intake: https://github.com/ailtron1ss-rgb/NK1/blob/workpass70-source/docs/RESEARCH_INTAKE_LEDGER.md
- Release license review: https://github.com/ailtron1ss-rgb/NK1/blob/workpass70-source/contracts/RELEASE_LICENSE_REVIEW.json
- Release license instructions: https://github.com/ailtron1ss-rgb/NK1/blob/workpass70-source/docs/RELEASE_LICENSE_REVIEW_RU.md
- Avatar/embodiment master plan: https://github.com/ailtron1ss-rgb/NK1/blob/workpass70-source/docs/NK1_AVATAR_BODY_EMBODIMENT_MASTER_PLAN_RU_2026-11-03.md

**Версия программы:** 2026-11-18  
**Snapshot source SHA:** bee2b133fdedd48723bc49b3eedae5f0df929c1c  
**Владелец машинного прогресса:** engineering-os/aspects.v1.json  
**Назначение документа:** интегрированный критерий завершения и план исполнения; сам по себе документ не повышает готовность ни одного аспекта.
