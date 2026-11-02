# NK1 — план восстановления целостности CI и выпуска
Дата среза: 2026-11-02  
Целевая ветка документа: `workpass70-source`  
Базовый SHA аудита: `608435493b4af3b4a222d385f1b77d978d18583b`  
Рабочая ветка аспекта: `aspect/release-integrity-ci-gates`

> Этот документ фиксирует проверяемые наблюдения и план работ. Он не утверждает, что перечисленные ниже проверки уже исправлены или что исходник уже выпущен.

## 1. Зачем нужен этот аспект

До наращивания когнитивных возможностей NK1 необходимо сделать воспроизводимым путь от исходного кода до проверенной поставки. Цель — исключить ситуацию, когда исправление существует в рабочей ветке, но отсутствует в релизном ZIP, CI запускает несопоставимые наборы тестов, а документация указывает устаревший SHA.

## 2. Подтверждённые наблюдения на дату среза

- Канонический репозиторий: `ailtron1ss-rgb/NK1`.
- Рабочая исходная ветка на момент аудита: `workpass70-source`.
- HEAD этой ветки: `608435493b4af3b4a222d385f1b77d978d18583b`.
- `main` — отдельная ветка публикационных/документальных материалов; её нельзя считать полным деревом runtime.
- Последний опубликованный GitHub Release, найденный при аудите: `NeuroKurisu0.1`, дата публикации 2026-10-19.
- ZIP релиза: 135,290,615 байт; опубликованный SHA-256: `c5cf6a…224286` (сокращённое значение из интерфейса аудита; перед проверкой файла необходимо получить полное значение из Release API).
- На HEAD `6084354…` GitHub отобразил 14 завершившихся с ошибкой workflow. На более раннем SHA `f921007…` соответствующие проверки проходили.
- Для одного из неуспешных запусков список job не содержал доступных шагов/логов. Причина отказа поэтому остаётся **неустановленной**; нельзя объявлять её регрессией исходного кода без диагностических данных.
- Документы `AGENTS.md` и `NEUROCORE_START_HERE.md` содержат базовую точку, не совпадающую с текущим HEAD.
- В репозитории обнаружено более 200 веток. Это подтверждает необходимость явной маршрутизации изменений по аспектам, но само по себе не доказывает, что все ветки лишние или должны быть удалены.

## 3. Правила безопасности изменений

1. Не менять `main` как замену исходной ветке.
2. Не сливать этот аспект в runtime без отдельного PR review и зелёных обязательных проверок.
3. Не удалять ветки, архивы, legacy-код или release assets в рамках наведения порядка.
4. Не переписывать тесты только ради зелёного CI; сначала определить, что именно упало и почему.
5. Разделять статусы: `implemented`, `integrated`, `tested`, `holdout-validated`, `released`.
6. Любой релиз должен быть привязан к точному commit SHA, manifest файлов, тестовому отчёту и полному SHA-256 архива.

## 4. Рабочий план

### A. Восстановить достоверность CI (P0)

- [ ] Получить полный список workflow runs для точного HEAD и сгруппировать по workflow, event, job, conclusion.
- [ ] Для каждого доступного job получить steps и логи; для недоступных логов зафиксировать HTTP/permission/retention причину.
- [ ] Сравнить failed HEAD с последним успешным SHA: workflow YAML, package manifests/lockfiles, scripts, test selection, runner image и cache keys.
- [ ] Выделить ошибки конфигурации, ошибки запуска/инфраструктуры и реальные failing assertions в отдельные классы.
- [ ] Повторить только диагностически оправданные failed jobs на том же SHA; не менять код до получения причины.
- [ ] Создать один обязательный aggregate gate для PR в рабочую ветку, который проверяет завершение всех required suites и не допускает пропуск из-за неверного path filter.
- [ ] Ввести timeout, concurrency cancellation и единый формат артефактов (JUnit/JSON + logs + commit SHA).

**Критерии приёмки:** точный SHA получает однозначный итог; каждый required suite имеет статус и доступный отчёт; skipped не маскирует отсутствие проверки; повторяемый сбой имеет классифицированную причину.

### B. Восстановить цепочку Release ZIP (P0)

- [ ] Скачать именно последний опубликованный ZIP и вычислить полный SHA-256 локально.
- [ ] Распаковать в чистый каталог; сохранить manifest путей, размеров и хешей.
- [ ] Сравнить содержимое ZIP с `workpass70-source`, релизным commit/tag и опубликованным manifest.
- [ ] Выявить файлы runtime, отсутствующие в ZIP, и файлы ZIP, отсутствующие в source; объяснить каждое расхождение.
- [ ] Определить единственный воспроизводимый release entrypoint и запретить ручную сборку ZIP из произвольной ветки.
- [ ] Формировать release manifest: source SHA, tag, build workflow run, toolchain versions, test report, SBOM/license report, archive SHA-256.
- [ ] Добавить проверку, что release asset соответствует manifest и что опубликованный тег указывает на ожидаемый commit.
- [ ] Выпускать новый ZIP только после всех required gates и smoke test распакованного артефакта.

**Критерии приёмки:** любой опубликованный ZIP можно однозначно восстановить до source SHA и workflow; проверка хеша проходит; smoke test выполняется из чистого каталога.

### C. Устранить дрейф handoff-документов (P1)

- [ ] Обновлять HEAD и статус ветки в одном каноническом handoff-файле после подтверждённого merge.
- [ ] Добавить generated source-of-truth snapshot: branch, SHA, дата, CI summary, release tag, PRs in flight.
- [ ] Помечать документы с устаревшим SHA как historical, не удаляя их.
- [ ] В каждом отчёте использовать термины implemented / integrated / tested / holdout-validated / released.
- [ ] Добавить проверку CI на противоречивые активные ссылки на source branch и release tag.

**Критерии приёмки:** разработчик, открывший START_HERE, за 2 минуты определяет правильную ветку, HEAD, обязательные проверки и текущий release.

### D. Упорядочить PR и аспектные ветки (P1)

- [ ] Составить таблицу всех открытых PR: base/head SHA, изменённые пути, возраст, CI, пересечения файлов.
- [ ] Сгруппировать PR по 6 доменам: core/runtime, memory/learning, motivation/autonomy, embodiment/voice/mobile, self/safety, validation/release.
- [ ] Для каждого PR определить одно решение: merge, rebase, split, superseded, close with preserved patch.
- [ ] Перед закрытием superseded PR сохранить diff/commit SHA и подтвердить перенос полезных изменений.
- [ ] Не создавать новые ветки без владельца аспекта, ограниченной области файлов и критерия завершения.
- [ ] Не допускать одновременной правки одного canonical file несколькими несогласованными ветками.

**Критерии приёмки:** каждый открытый PR имеет актуальную базу, владельца/домен, решение и отсутствие потерянного уникального изменения.

## 5. Release gate — минимальная обязательная цепочка

1. Source integrity: clean tree, pinned commit, dependency lock integrity.
2. Static: typecheck, lint, secret scan, dependency/SCA scan, license inventory.
3. Unit/contract: быстрые детерминированные suites.
4. Integration: OrganismBus, OrganismState, memory restore, ActionGateway.
5. Cognitive eval: retrieval holdout, memory-to-action, temporal/conflict/forget tests.
6. Safety: permission boundaries, idempotency, replay, rollback, prompt-injection/tool-output isolation.
7. Embodiment: browser E2E, voice interruption, audio/avatar synchronization.
8. Device: Android/Termux soak and resource limits.
9. Package: clean install/extract, migration, smoke test, SBOM and archive hash.
10. Release: tag and ZIP are generated from the same verified SHA.

## 6. Очерёдность следующих аспектов

| Приоритет | Аспект | Результат |
|---|---|---|
| P0 | CI recovery | объяснимый и воспроизводимый зелёный gate |
| P0 | Release integrity | ZIP строго соответствует проверенному source SHA |
| P1 | MemoryOS2 | независимый retrieval uplift и корректное забывание |
| P1 | Organism loop | единый исполняемый Perceive→Appraise→Plan→Act→Reflect→Consolidate |
| P1 | Action safety | идемпотентность, ACK/replay, rollback и postconditions |
| P1 | Voice/avatar/mobile | реальные E2E и soak на целевом устройстве |
| P2 | Cognitive self-model | калиброванная уверенность, непротиворечивое состояние, объяснимые инициативы |
| P2 | Performance | бюджеты latency/RAM/CPU и нагрузочные профили |

## 7. Метрики прогресса

Не считать этап завершённым по наличию документа, интерфейса или заглушки.

- CI: доля обязательных suites с доступными отчётами; повторяемость результатов на одном SHA.
- Release: 100% артефактов имеют source SHA, manifest и проверяемый хеш.
- Memory: paired holdout, минимум 5 seeds, положительный recall delta без ухудшения precision/temporal correctness.
- Runtime: deterministic replay, bounded latency и отсутствие потери/двойного исполнения событий.
- Autonomy: инициативы измеряются по полезности, отменам, безопасности и объяснимой причине, а не по числу сообщений.
- Embodiment: измерять audio-to-mouth drift, interrupt latency, crash-free soak и восстановление после потери связи.

## 8. Что намеренно не делается в этом PR

- Не изменяется runtime-код и API.
- Не меняются зависимости и lockfiles.
- Не закрываются и не удаляются ветки/PR.
- Не объявляется причина CI failures без логов.
- Не объявляется новый релиз и не меняется Release ZIP.

Этот PR создаёт безопасную и проверяемую основу для следующего кодового прохода: сначала восстановить CI и происхождение артефакта, затем выполнять когнитивные интеграции с достоверным регрессионным контуром.
