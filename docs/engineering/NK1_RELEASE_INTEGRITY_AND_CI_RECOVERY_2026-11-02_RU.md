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
- Release asset: `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`, 135,290,615 байт; GitHub Release API возвращает `sha256:c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`. Это digest из метаданных GitHub, а не самостоятельно пересчитанный локальный хеш.
- На точном HEAD `608435493b4af3b4a222d385f1b77d978d18583b` GitHub Actions API вернул 14 workflow runs, и все 14 завершились `failure`.
- Для всех 14 job подтверждена одинаковая сигнатура: `runner_id=0`, `runner_name=""`, `runner_group_id=0`, `steps=[]`; каждый job стартовал в `2026-11-01T17:29:33Z` и завершился в `17:29:35Z`. Это отказ до выполнения первого шага, а не подтверждённое падение тестов NK1.
- Получение логов для всех 14 job вернуло HTTP 404 `BlobNotFound`; endpoint логов workflow также вернул пустое содержимое. Это фиксирует недоступность логов, но не раскрывает аннотацию check run с точной причиной отказа.
- Родительский SHA `f921007a74a7a6124d274885354009dd3a3ef33c` имел 7 успешных workflow runs. Контрольный job `targeted-and-regression` на этом SHA использовал runner `1000079583`, выполнил 45 шагов и завершился `success` в `15:36:32Z`.
- `compare_commits(f921007…, 6084354…)` показывает ровно один изменённый файл: `runtime/neuro-kurisu/package.json` (+1/−2). В агрегаторе `test:rebuild-recovered` устранён повторный вызов `test:workpass611:cognitive-planner-restore-integrity`; workflow YAML и runtime исходники в этом commit не менялись. Поскольку runner не был назначен, этот diff не объясняет отсутствие выполнения job.
- Ранее в `docs/WORKPASS327_ACTIONS_STARTUP_DIAGNOSIS_RU.md` и `docs/CI_RELIABILITY_RUNBOOK_RU.md` уже описан тот же runner-startup blocker. Там account-level Billing & Licensing / Actions restriction названа приоритетной гипотезой, но не подтверждённым диагнозом. Текущая сессия не имеет доступа к личному экрану Billing & Licensing или аннотации check run.
- Публичная история GitHub Status не содержит зарегистрированного инцидента за 1 ноября 2026 года; это снижает вероятность публичного глобального инцидента, но не исключает ограничение конкретного аккаунта.
- В API-снимке ветки `workpass70-source` указано `protected=false`, `protection.enabled=false`, `enforcement_level=off`, `contexts=[]`, `checks=[]`. То есть обязательные status checks на ветке не настроены; красные Actions не блокируются настройкой branch protection.
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

- [x] Получить полный список 14 workflow runs для точного HEAD и сгруппировать по workflow, event, job, conclusion.
- [x] Получить API-снимки всех 14 job: ни один runner не назначен, steps отсутствуют; получить logs для всех jobs — GitHub вернул `BlobNotFound`.
- [x] Сравнить failed HEAD с непосредственным родителем: изменён только `runtime/neuro-kurisu/package.json`; последний успешный parent SHA подтверждён отдельным run.
- [x] Классифицировать текущий исход как pre-runner startup failure; конкретная account/platform причина и настоящие test assertions пока не доступны.

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


## 9. Дополнительная трассировка и решения (2026-11-02)

### 9.1. Все 14 failed workflow runs на SHA 6084354…

Каждый run содержит один job. Для всех job API возвратил `runner_id=0`, пустой `runner_name`, `runner_group_id=0`, ноль шагов; временное окно каждого job — две секунды. Для всех 14 отдельных запросов логов GitHub вернул `BlobNotFound`.

| Workflow | Run ID | Job ID |
|---|---:|---:|
| NK1 world perception integrity | 41331728125 | 124923078983 |
| NK1 Hexis source lineage contract | 41331728121 | 124923079098 |
| NeuroCore core regression validation | 41331728115 | 124923079245 |
| NK1 Verified learning and skill lifecycle | 41331728123 | 124923079133 |
| NK1 longitudinal memory holdout pairing | 41331728182 | 124923079547 |
| NK1 UserModel explicit-forget integrity | 41331728193 | 124923079301 |
| NK1 Memory integrity and retrieval gates | 41331728100 | 124923079049 |
| NK1 Action Gateway governance | 41331728131 | 124923079128 |
| NK1 Adaptive Experience Memory Boundary | 41331728086 | 124923079001 |
| WorkPass287-288 cognitive contracts | 41331728076 | 124923079060 |
| NK1 browser affect snapshot coherence | 41331728098 | 124923079151 |
| NK1 Unified organism runtime | 41331728091 | 124923079011 |
| WorkPass72-73 independent evidence and memory evaluation | 41331728231 | 124923079220 |
| WorkPass79 cognitive runtime regression | 41331728072 | 124923078985 |

Примеры: [Core regression run](https://github.com/ailtron1ss-rgb/NK1/actions/runs/41331728115), [Memory integrity run](https://github.com/ailtron1ss-rgb/NK1/actions/runs/41331728100), [Unified organism run](https://github.com/ailtron1ss-rgb/NK1/actions/runs/41331728091).

### 9.2. Сравнение с последним успешным состоянием

- Parent SHA: `f921007a74a7a6124d274885354009dd3a3ef33c`.
- Failed HEAD: `608435493b4af3b4a222d385f1b77d978d18583b`.
- Между ними один commit и один изменённый файл — `runtime/neuro-kurisu/package.json`.
- На parent SHA есть 7 успешных workflow runs; в job `targeted-and-regression` runner был назначен и выполнено 45 шагов.
- Изменение агрегатора устранило двойное выполнение одного теста. Оно не меняло workflow-файлы, настройки runner или CI permissions.

### 9.3. Release asset: точные метаданные, но не локально проверенное содержимое

- Release name: `NeuroKurisu0.1`; tag: `Neuro`; опубликован 2026-10-19.
- Asset: `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`; size: `135290615` bytes.
- GitHub asset digest: `sha256:c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`.
- Бинарный ZIP не удалось получить в текущей среде: GitHub content fetch поддерживает только UTF-8, а рабочий контейнер не разрешил DNS для `github.com`. Поэтому локальный SHA-256, распаковка, manifest и сравнение с `workpass70-source` **не выполнены**. Этот asset остаётся первичным объектом проверки, но пока не считается локально верифицированным.

### 9.4. Следующие обязательные действия вне кода

1. Владелец аккаунта проверяет GitHub → Settings → Billing & Licensing и доступность GitHub Actions / hosted runners. Не считать гипотезу Billing подтверждённой до просмотра собственного уведомления или ответа GitHub Support.
2. Если в Billing & Licensing нет ограничений, отправить GitHub Support run IDs из таблицы и приложить сигнатуру `runner_id=0`, `steps=[]`, `BlobNotFound`; запросить account-level Actions restriction / runner assignment diagnosis.
3. После устранения блокировки повторить точные SHA-проверки на актуальном HEAD; только job с назначенным runner и реально выполненными шагами позволяет судить о тестах.
4. Настроить repository ruleset / branch protection для `workpass70-source`: обязательные regression/contract checks, запрет обхода required checks и merge только после свежих результатов. Текущий API-снимок подтверждает, что таких правил сейчас нет. Изменение требует административной настройки GitHub; workflow YAML сам по себе не включает защиту ветки.
5. Отдельно получить бинарный Release ZIP, сверить его локальный SHA-256 с asset digest, извлечь в чистую директорию и построить file manifest перед выводами о расхождении runtime/release.

**Не делалось:** не выполнялись массовые повторные запуски 14 jobs (они не дадут тестовых данных до устранения startup blocker); не менялся runtime; не менялась конфигурация Actions; не менялся Release asset; не настраивалась branch protection.
### 9.5. Как был собран текущий hotfix prerelease — проверка publisher workflow

- Release `workpass70-hotfix1-2026-10-19` имеет `target_commitish=main`. Его tag указывает на commit `aa237b8991a666155a4795ce714d0abf8a74b6a4` (`Prevent stale CI runs from publishing release assets`). У этого commit отдельная publication/workflow lineage; сравнение с текущим source HEAD не находит общего предка. Это согласуется с политикой проекта, где `main` содержит release metadata/workflows, а не runtime source.
- В самом publisher workflow `.github/workflows/publish-workpass70-hotfix.yml` на tag commit явно задан `workflow_run` для validation workflow на `workpass70-source`; далее `actions/checkout@v4` делает checkout `ref: workpass70-source`, `fetch-depth: 0`. Перед упаковкой workflow сравнивает `github.event.workflow_run.head_sha` с текущим remote tip `refs/heads/workpass70-source` и пропускает выпуск, если SHA отличается.
- При совпадении SHA workflow архивирует tracked `HEAD`, проверяет ZIP через `unzip -t`, вычисляет `sha256sum` для ZIP и release report, затем загружает ZIP, report и `SHA256SUMS.txt`. Это подтверждает предусмотренный кодом stale-run guard и происхождение архива из source branch, но не даёт независимой локальной проверки фактического ZIP из этого сеанса.
- В workflow-скрипте sidecar создаётся как SHA256-сумма ZIP и report; отдельное поле `source_commit_sha`/manifest в загружаемом наборе не записывается. SHA validated run выводится в job log, но логи текущей сессией для старых неуспешных runs недоступны. Рекомендуемое улучшение следующего release pipeline: добавлять подписанный `release-manifest.json` с `source_commit_sha`, validation workflow/run ID, tag, toolchain, тестовыми итогами, SBOM/license status, ZIP SHA-256 и именами asset.
- Сам tag commit не следует принимать за source SHA; для этого релиза связь должна подтверждаться publisher workflow и build provenance. Текущий тег / архив датирован 19 октября 2026 года, поэтому он заведомо предшествует интеграциям 1 ноября.

**Статус проверки release provenance:** workflow definition inspected; release asset metadata inspected; actual ZIP bytes / sidecar contents / local SHA-256 / unpacked tree comparison not inspected. Отметка «source commit equals tag commit» не делается.