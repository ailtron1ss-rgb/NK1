# NK1 WorkPass419 — устойчивость автономного цикла P23 (2026-10-23)

## Что добавлено после WorkPass418
- Cooldown после ошибки генерации/оценки навыка сохраняется в sidecar через существующий атомарный `FileStateStore`; runtime восстанавливает его до допуска следующих повторов.
- Запись ограничена 128 навыками и привязана к точному digest исходного repair-evidence. Невалидный формат/запись не приводит к незаметному сбросу cooldown: восстановление завершается fail-closed.
- Новая регрессия проверяет ошибку поставщика, сохранение retry deadline, создание нового координатора, блокировку повторной работы при том же digest и отказ для повреждённой persisted-записи.
- P26 Learning Validation отслеживает новые curriculum-тесты, coordinator и runtime. Новых зависимостей нет.

## Оценка после WorkPass419 — без повышения
- **Реализация категории learning:** 83%.
- **Подтверждённая production-готовность:** около 45%.
- **Exact-head runtime tests/typecheck:** не подтверждены; видимые Actions jobs продолжают завершаться до выделения runner (`runner_id=0`, `steps=[]`). Это инфраструктурный блокер, а не PASS/FAIL конкретного теста.
- **Измеренный прирост способности учиться:** не установлен.
- **Main/release:** `main` и Release ZIP не изменены.

## Следующий проход
1. Получить рабочий CI runner и exact-head typecheck/tests.
2. Проверить backup/restore-поведение нового P23 retry sidecar и поведение при отказе записи.
3. Продолжить сквозную проверку реального цикла `outcome → diagnosis → candidate → independent validation/holdout → approval/rollback → durable feedback`.

---

# NK1 WorkPass418 — оценка прогресса ветки обучения

## Результат этого прохода
- **Код:** защита восстановления контекста личного обучения, карантин конфликтующих ID/семейств, проверка входов наблюдений и ранжирования целей; детерминированный порядок при одинаковом score; счётчики жизненного цикла синхронизируются с уникальными текущими темами.
- **Регрессии:** дополнены `big-pass-122-personal-curriculum.mjs`, `big-pass-122-personal-curriculum-observation-boundary.mjs` и `big-pass-122-curriculum-restore-collision.mjs`; единый скрипт `test:big-pass-122` подключает наблюдательные и collision-сценарии.
- **Счётчики и статистика:** реализация получила дополнительные инварианты, но фактическое качество обучения этим не измерено.

## Оценка без необоснованного повышения
- **Реализация категории learning:** 83% (не изменена).
- **Подтверждённая production-готовность:** около 45% (не изменена).
- **Exact-head typecheck/tests:** не подтверждены: последующие GitHub Actions всё ещё завершаются до назначения runner — `runner_id=0`, `steps=[]`. Это не доказывает ошибку кода и не является успешным запуском.
- **Runtime dependencies:** новых зависимостей нет; применён общий `LearningTrustBoundary`.
- **Main/release:** `main` и Release ZIP не изменены.

## Следующий кодовый проход
1. Восстановить исполняемый CI/runner и получить точный результат typecheck + трёх curriculum-регрессий.
2. Проверить реальный runtime путь: от аутентифицированного outcome/evidence к обновлению curriculum, а не принимать caller-supplied `verified` как самостоятельное доказательство.
3. Затем продолжить end-to-end P23: observed outcome → diagnosis → bounded revision → independent validation/holdout → approved activation/rollback → durable learning feedback.

---

# NK1 WorkPass448 — bounded bootstrap-work checkpoint (2026-10-23)

## Обновление
- **Сделано:** в общем bootstrap-утилитном слое введён бюджет 16 000 000 draw-операций на вызов.
- **Защита:** произведение размера выборки на число resamples проверяется до выделения массива бутстрэп-результатов и запуска вложенных циклов. Превышение приводит к явной ошибке вместо скрытого изменения настроек confidence.
- **Регрессия:** добавлен случай 5 000 значений × 4 000 повторов, который должен отклоняться.
- **Метрики и promotion:** обычные допустимые расчёты используют прежний алгоритм; gate-правила не меняются.
- **Оценки:** реализация категории learning — 83%; подтверждённая production-готовность — около 45%. Это не повышается без исполняемого exact-head CI и независимых benchmark evidence.

---

# NK1 WorkPass447 — task-level uncertainty checkpoint (2026-10-23)

## Обновление прогресса
- **Оценка реализации категории learning: 83% — без повышения.** Диагностическая оценка теперь показывает неопределённость macro-mean прироста по задачам, но полноценный цикл всё ещё требует точного CI и эмпирических независимых результатов.
- **Подтверждённая production-готовность: около 45% — без повышения.** Новый код и регрессии внесены; тест/typecheck на точном HEAD не подтверждены, поэтому выполнение не приравнивается к PASS.
- **Изменение:** percentile bootstrap строится по task-level разницам candidate − baseline, а не по каждому повторному seed. Это сохраняет задачи единицами анализа и уменьшает риск псевдорепликации.
- **Результат диагностики:** 95%-интервал, 2,000 resamples, sampleCount и point estimate; при одной задаче интервал отсутствует (`null`). Все поля остаются диагностическими и не влияют на promotion gates.
- **Открытые пункты:** зелёный точный-head typecheck/tests, длительные независимые benchmark/holdout, подтверждённое улучшение навыков и production evaluator isolation. PR [#79](https://github.com/ailtron1ss-rgb/NK1/pull/79) остаётся draft; `main` и Release ZIP не менялись.

---

# NK1 WorkPass417 — curriculum integrity checkpoint (2026-10-23)

## Обновление прогресса
- **Оценка реализации категории learning: 83% — без повышения в этом проходе.** Код восстановления и приема observations стал строже, однако корректность ещё не подтверждена исполняемыми тестами на точном HEAD.
- **Подтверждённая production-готовность: около 45% — без повышения.** Свежий Actions run [WorkPass417 Personal Curriculum Integrity](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39975425148) дважды завершился до назначения runner: `runner_id=0`, `steps=[]`. Это не PASS и не подтверждает ошибку в коде; причина инфраструктурного отказа не установлена.
- **Внесённый код:** безопасное восстановление persisted personal curriculum; проверка диапазонов числовых оценок, счетчиков, идентичностей, контекстов и временных меток; проверка исходных goal/outcome/developmental-context данных перед мутацией состояния.
- **Интеграция:** новые регрессии подключены через существующий `test:big-pass-122`, а сфокусированный WorkPass417 workflow запускает typecheck, curriculum restore/input checks и core-restart persistence check. Runtime-зависимости не добавлялись.
- **Открытый checkpoint:** draft PR [#79 — Harden P23 learning and verified skill evolution](https://github.com/ailtron1ss-rgb/NK1/pull/79), ветка `feature/learning` → `integration`. Не создавать дублирующий PR и не считать его готовым к merge, пока точные тесты не запустились.
- **Следующий проход:** восстановить исполняемый Actions runner; затем выполнить точный-head typecheck и curriculum/P23 tests. После этого перейти к проверяемому end-to-end результату полного цикла `outcome → diagnosis → candidate → independent holdout → approval/rollback → durable feedback`. Эмпирического прироста обучения пока не заявлять.

---

# NK1 WorkPass416 — оценка прогресса ветки обучения

Дата снимка: 23 октября 2026 года. Рабочая ветка: `feature/learning`.

## Текущая оценка (после WorkPass416)

| Область | Оценка реализации | Что входит / почему не 100% |
|---|---:|---|
| Сбор опыта, replay и continual learning | 80% | Есть приоритизированный/стратифицированный replay, forgetting/transfer/drift-системы; полный независимый live-benchmark по реальным задачам пока не подтверждён |
| Жизненный цикл навыка и promotion gate | 95% | Есть staged candidates, независимая оценка, разделение validation/holdout, signed evidence, authenticated approval, rollback и отдельный журнал фактического результата активации; production sandbox/verifier/scanner остаётся отдельным gate |
| Целостность оценки и происхождение evidence | 93% | Есть точные fingerprints, canonical task/seed/split joins, trust boundary, hash-chained fitness journal и hash-chained lifecycle transitions; подписанные удалённые checkpoints и независимое развёртывание evaluator authority пока не подтверждены |
| Метрики качества и наблюдаемость | 92% | Есть P23 family confidence bounds, fitness journal, WorkPass406 task-balanced IQM/paired improvement и WorkPass407 activation-intent/outcome diagnostics; требуется reconciliation после crash и история по реальным независимым циклам |
| Воспроизводимость production-проверок | 42% | Регрессионные контракты и workflow подключены, но Actions на точном текущем HEAD сообщают failure без доступных steps/logs; полный независимый multi-seed uplift не доказан |

**Сводная инженерная оценка полноты реализации категории: 83%.** Расчёт — взвешенное экспертное резюме по приведённым направлениям, а не автоматически измеренная метрика и не оценка интеллекта.

**Подтверждённая production-готовность категории: около 45%.** Этот показатель ниже, потому что он учитывает реальное исполнение проверок на точном HEAD, развёртывание независимых evaluator authorities, подтверждённые gains и длительные интеграционные прогоны. Пока CI не предоставляет запускаемые шаги и логи, высокий процент реализованного кода нельзя считать подтверждённой готовностью.

## WorkPass406 — что сделано в этом проходе

- Добавлен `LearningRobustMetrics.ts`: task-balanced interquartile mean (IQM), delta IQM и paired probability of improvement отдельно для task success, skill quality и trajectory quality.
- Метрики вычисляются для validation и holdout из уже matched и проверенных evaluator envelopes. Усреднение сначала выполняется внутри задачи и только затем между задачами, так что задачи с большим числом seed не получают автоматически больший вес.
- Публичный `P23LearningEngine.approveIndependentlyEvaluatedSkillCandidate` теперь сохраняет типизированную форму диагностик в возвращаемом `fitness`.
- Новая регрессия включена в `test:p23:learning` и в P26 Learning Validation workflow; workflow path filters включают модуль и тест.
- Добавлена документация и checkpoint. Изменения внесены в `feature/learning`; `main` и release ZIP не изменялись.

## Доказательность и ограничения

Локальный изолированный тест метрик выполнился успешно, а строгий TypeScript check нового модуля вместе с локальной заглушкой trust boundary прошёл. Это **не** полная проверка рабочего дерева NK1 и не замена CI.

На проверенном commit P26 Learning Validation завершился со статусом `failure`, но API возвращает для job пустой список шагов, `logs_url=null`, а загрузка логов — `BlobNotFound`. Поэтому причину нельзя честно приписать этому коду или runner, и результат нельзя считать PASS.

WorkPass406 не демонстрирует фактического улучшения навыков сам по себе: метрики описательные и явно помечены `diagnosticOnly: true`. WorkPass407 закрывает только журналирование решения и его фактического lifecycle-исхода; это тоже не доказывает прирост навыка. Метрики не меняют `eligible`, а lifecycle-журнал не заменяет paired-seed confidence, safety, provenance, signed-evidence и approval gates.

## Конечная цель ветки обучения

Условие готовности — не наличие новых файлов. Категория считается завершённой после того, как полный цикл «реальный исход/ошибка → разбор траектории → план ремонта → кандидат → выполнение в изолированном окружении → независимая оценка на фиксированных validation и нетронутом holdout → подтверждённое решение → наблюдаемый результат/rollback» выполняется воспроизводимо; точные тесты и typecheck зелёные на одном HEAD; устойчивый выигрыш подтверждён заранее зарегистрированными независимыми seed/task families без недопустимого регресса; длинный soak, privacy/license review и production evaluator isolation закрыты.

## WorkPass412 — метрики распределения по задачам

- Расширен `LearningRobustMetrics.ts`: теперь отчёт по task success, skill quality и trajectory quality содержит task-balanced IQM, task-balanced median, optimality gap до ceiling=1 и их дельты плюс paired probability-of-improvement.
- Метрики вычисляются на matched baseline/candidate trials после валидации score ∈ [0,1]. Repeats усредняются внутри задачи, затем задачи получают равный вес.
- Источник напрямую прочитан: `google-research/rliable/rliable/metrics.py` (blob `dc206a180c822eaf3bc8524a63b127aeb1e60fe7`). Адаптированы идеи агрегатов, код не скопирован; NK1's task-balanced IQM намеренно отличается от pooled IQM RLiable.
- Regression в `workpass406-learning-robust-metrics.mjs` проверяет медиану, ceiling gap и дельты. Existing P23/P26 wiring уже включает обновлённый тест.
- Новые поля остаются `diagnosticOnly: true`; они не влияют на promotion, не заменяют confidence gates и не являются доказательством улучшения. Exact-HEAD тесты пока не подтверждены.
- Оценка реализации категории после прохода — **83%**, production readiness — **~45%**.

---

## WorkPass416 — воспроизводимое суммирование дробных оценок

- После однократной группировки по taskId каждая группа сортируется по стабильному `trialId` до вычисления средних. Это предотвращает расхождение последнего округлённого разряда из-за разного порядка floating-point сложения.
- Регрессия WorkPass406 дополнена корпусом из 5 задач × 37 seed с различными дробными оценками; перестановка/обратный порядок входов обязаны давать идентичную сводку.
- Полная сложность остаётся O(R log R) в худшем случае из-за сортировки внутри задач вместо исходных повторных O(T × R) полных фильтраций.
- Дополнительно выборочно синхронизирован `docs/NEUROCORE_MASTER_STRATEGY_AND_BRAIN_MAP.md` с `integration`: двоичный diff подтвердил, что версия `integration` дополняла эту копию без удаления существующих строк; содержимое после sync совпадает по blob SHA. История веток остаётся расходящейся — это не merge.
- Общая оценка полноты категории остаётся **83%**, production readiness — **~45%**; exact-HEAD тест/typecheck не подтверждён.

---

## WorkPass415 — оптимизация вычисления метрик

- Убрана повторная полная фильтрация matched trials для каждой task: строки группируются в `Map<taskId, MatchedScore[]>` единственным проходом и используются для всех измерений.
- Вычислительная часть группировки уменьшается с повторных O(tasks × trials) сканирований до O(trials) группировки и O(trials) обработки на измерение. Формулы и равный вес каждой задачи не изменены.
- Регрессия инвариантности к перестановке входных строк остаётся защитой семантики. Полный exact-HEAD runtime test не подтверждён.
- Общая экспертная оценка полноты категории остаётся **83%**; production readiness — **~45%**.

---

## WorkPass409 — восстановление после аварии между intent и result

- Проверка обнаружила новый crash-window: процесс мог завершиться после долговременного `activation-intent`, но до записи `activation-outcome-unknown`. Прошлая reconciliation обходила только явные unknown events, поэтому такой intent оставался бы pending бесконечно.
- Исправлено: `P23LearningEngine.reconcileLearningLifecycleOutcomes()` теперь начинает с каждого незавершённого `activation-intent`, предпочитает связанный unknown event, если он есть, и сверяет оба варианта с авторитетным versioned skill store.
- `LearningLifecycleJournal` разрешает reconciliation после `intent → unknown` и после одного лишь `intent`, что закрывает аварийный сценарий без промежуточной записи. Статистика отдельно показывает число pending intents и число явно unknown.
- Тест `workpass408-lifecycle-store-reconciliation.mjs` расширен сценарием hard exit после intent: точная активная версия восстанавливается, неактивный кандидат остаётся корректно описан, отсутствующий lineage остаётся pending, повтор не дублирует событие. Workflow уже запускает эту регрессию.
- **Проверка:** реализация и тестовая проводка внесены, но exact-HEAD Actions/typecheck не подтверждены; runner steps/logs по-прежнему недоступны. Production readiness остаётся около 45%.

Сводная инженерная оценка после WorkPass409 — **82% реализации категории**, production readiness — **~45%** (экспертные оценки, не автоматические показатели).

---

## WorkPass408 — восстановление состояния после неопределённой активации

- `P23LearningEngine.reconcileLearningLifecycleOutcomes()` связывает `activation-outcome-unknown` с авторитетным versioned skill store по точному candidate/skill/version/payload fingerprint.
- Точное matching активной версии получает `activation-reconciled-active`; найденный кандидат без matching active row получает `activation-reconciled-not-currently-active`; отсутствующий/противоречивый lineage остаётся pending.
- Runtime запускает reconciliation при старте и предоставляет явный API для повторной сверки. Reconciliation не активирует навык и не меняет promotion authority.
- Добавлена интеграционная регрессия `workpass408-lifecycle-store-reconciliation.mjs` (matching active, shadow/non-active, absent lineage, repeat idempotency), включена в P23 aggregate и P26 CI.
- **Статус проверки:** wiring committed; exact-HEAD runtime tests/CI remain unverified due to unavailable Action steps/logs. Production readiness does not rise until tests and real store restart/rollback soak are confirmed.

Сводная инженерная оценка после прохода — **82% реализации категории**, production readiness — **~45%** (экспертные оценки, не автоматические показатели).

---

## WorkPass407 — замкнутый журнал фактической активации

- Отдельный `LearningLifecycleJournal.ts` пишет events `promotion-rejected`, `activation-intent`, `activation-confirmed` и явный `activation-outcome-unknown` в hash-chained JSONL.
- P23 пишет долговременный intent после evidence binding, но до активации. Ошибка записи intent блокирует side effect; ошибка записи confirmed после успешного store не превращается в ложную ошибку API — остаётся visible pending intent.
- Исключение из store обозначается как outcome unknown, поскольку вызывающая сторона не всегда может доказать, что side effect не состоялся.
- Runtime публикует безопасные агрегаты в `longitudinalSnapshot()` и `persistenceMetrics()`. Отдельный path resolver и тест защищают основной state file от перезаписи JSONL.
- Upstream напрямую исследованы файлы Hermes Self-Evolution: `README.md` (blob `c59f9a6`), `PLAN.md` (blob `48f9ef1`) и `evolution/skills/evolve_skill.py` (blob `2a79a67`). Принципы constraint gate, раздельной оценки holdout и сохранения failed candidates адаптированы в NK1; несовместимый Python optimizer-код и новые сторонние runtime-зависимости не импортировались.
- Регрессия подключена в P23 aggregate command и P26 Learning Validation; WorkPass402 также проверяет привязку production rejection к кандидатному payload/evaluation fingerprint.
- **Статус проверки:** implementation/CI wiring committed, but actual exact-HEAD run remains unverified because Actions returns a failed job without step list/log URL. No measured skill improvement is claimed.

Сводная инженерная оценка после прохода — **79% реализации категории**, production readiness — **~45%** (экспертные оценки, не автоматические показатели).

## Следующие приоритеты

1. Восстановить actionable CI: получить исполнимые jobs/step logs для текущего HEAD и не подавлять ошибки setup/runner.
2. Запустить новую метрику через полную P23 ветку на независимом labelled benchmark; проверить task families, missing pairs, per-split data isolation и стоимость.
3. Встроить диагностический summary в dashboard/longitudinal snapshot только через allowlisted агрегаты, сохраняя privacy и diagnostic-only семантику.
4. Подтвердить внешний sandbox, independent verifier/scanner и signed remote checkpoints для журнала; затем выполнить multi-seed/long-soak валидацию.
