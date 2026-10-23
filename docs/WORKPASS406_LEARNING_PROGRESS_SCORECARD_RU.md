# NK1 WorkPass415 — оценка прогресса ветки обучения

Дата снимка: 23 октября 2026 года. Рабочая ветка: `feature/learning`.

## Текущая оценка (после WorkPass415)

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
