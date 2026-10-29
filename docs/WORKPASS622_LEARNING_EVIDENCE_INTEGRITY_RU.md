# WorkPass622 — интеграция доказательного обучения и саморазвития NK1

**Дата:** 29 октября 2026 года  
**База:** `workpass70-source`  
**Рабочая ветка:** `workpass622-learning-evidence-integrity-2026-10-29`  
**Статус:** изменения внесены в отдельную ветку; проверка GitHub Actions должна быть подтверждена на точном HEAD этой ветки.

## Что изменено

### 1. Доказательная оценка обучения

- Перенесён `PlainDataSnapshot` и узкая граница `LearningTrustBoundary` для копирования/валидации входных данных без вызова getters и без принятия произвольных объектов от вызывающей стороны.
- Добавлен детерминированный bootstrap-интервал для парных seed-дельт. Повтор с теми же входами/seed даёт одинаковый отчёт; есть ограничение вычислительного бюджета.
- Добавлены task-balanced метрики по успеху задачи, качеству навыка и качеству траектории: IQM, median, optimality gap, вероятность улучшения и bootstrap-интервал. Это диагностические метрики; они сами не дают разрешения на promotion.
- Обновлён `SkillLearnBenchAdapter`: индивидуальные validation-регрессии и регрессии семейств проверяются отдельно, так что прирост macro-average не может просто замаскировать просадку другой задачи/семейства.
- Обновлён `IndependentSkillCandidateEvaluator`: promotion-gate получает matched-pair результаты, доверительную оценку и task-family metadata из trusted manifest; входные отчёты и fingerprint связаны с конкретным кандидатом, планом и окружением.
- Обновлён `VerifiedOutcomeLedger` для подтверждённых outcome/task-family данных; имя семейства не должно выводиться из произвольного текста caller-а.

### 2. Журналы решений и жизненного цикла

- `LearningFitnessJournal` — append-only JSONL-журнал агрегированных fitness-решений, со связью candidate/payload/evaluation/plan/environment fingerprints, hash chain, ограничениями размера и отказом при повреждённой цепочке. Не пишет prompt, task IDs, имена семейств и отдельные holdout-строки.
- `LearningLifecycleJournal` — журнал intent/confirmed/failed/unknown/reconciled переходов активации. Незавершённый intent не считается успехом или неудачей автоматически.
- `P23LearningEngine` теперь поддерживает подключение журналов, ограниченные диагностические snapshots и reconciliation спорной активации по авторитетному versioned skill store.
- Добавлен адаптер `generateAndStageReflectiveSkillRevisionWithLocalModel`, который подключает host-owned local chat provider к каноническому P23 lifecycle и не обходит независимую оценку/approval.
- `OrganismRuntime` автоматически подключает журналы к каноническому P23 при заданном контуре ревизии, выполняет сверку незавершённых intent при старте и в production завершает запуск fail-closed при недоступности integrity journal.
- Сохранена обратная совместимость evaluator plan fingerprint: task-family попадает в digest только при наличии значения из доверенного manifest/config; для задач без family metadata прежний digest остаётся прежним.
- Уточнен порядок отказов ledger: точное повторение task/method/seed/attempt возвращает `duplicate-attempt`; повторное использование receipt для другой ячейки по-прежнему блокируется как `duplicate-evidence-ref`. Защита от повторного receipt не отключена.
- `OrganismRuntime` автоматически подключает журналы к каноническому P23 при заданном контуре ревизии, выполняет сверку незавершённых intent при старте и в production завершает запуск fail-closed при недоступности integrity journal.
- В независимом promotion-пути P23 фиксируется результат fitness-gate, затем evidence binding, durable activation intent и terminal outcome. Запись intent происходит до активации; если intent не записывается, активация не начинается. После неопределённого результата состояние остаётся pending для reconciliation.
- Диагностическая сводка validation и holdout рассчитывается до активации и явно помечена `diagnosticOnly: true`. Она не обходит family/seed gate, подписанные receipts, отдельный approval или rollback.

### 3. Централизованная политика promotion

Текущие стартовые значения политики P23:

- минимум 2 различные validation-задачи и 2 holdout-задачи в каждой учитываемой семье;
- минимум 3 paired seeds для validation и holdout families;
- maximum regression по отдельной validation-задаче — 0,20;
- maximum regression по validation-family — 0,10;
- maximum holdout regression — 0,02;
- maximum holdout-family regression — 0,10;
- доверительный уровень 95%, 2000 bootstrap resamples.

Это инженерные guardrails NK1, не универсальные научные константы. Их эффективность должна проверяться на заранее зафиксированном benchmark, с отчётом по дисперсии и стоимости. Неполное покрытие, несовпадающие seed/task/split, нарушение safety или несовпадение provenance должно приводить к отказу (fail closed), а не к продвижению кандидата.

## Новые/перенесённые regression tests

- `workpass383-p23-revision-generator-boundary.mjs`
- `workpass402-production-promotion-family-gate.mjs`
- `workpass404-paired-seed-confidence.mjs`
- `workpass405-learning-fitness-journal.mjs`
- `workpass406-learning-robust-metrics.mjs`
- `workpass407-learning-lifecycle-journal.mjs`
- `workpass408-lifecycle-store-reconciliation.mjs`
- `workpass622-runtime-learning-journal-wiring.mjs`
- `p23-local-model-skill-revision-integration.mjs`
- `p23-verified-outcome-ledger.mjs`
- `workpass203-independent-candidate-evaluator.mjs`
- `p23-hermes-production-promotion-gate.mjs`
- `p23-continual-outcome-matrix.mjs`

Добавлен скрипт `npm run test:workpass622:learning-evidence`; workflow P26 расширен path filters и отдельным шагом этой suite. `package-lock.json` не изменялся, так как новые внешние runtime-зависимости не добавлялись.

## CI и точность доказательств

**Предварительные CI-результаты:** P26 Learning Validation прошёл на SHA `0992c29e608438568e3b8736f30d6df695cd544e` с typecheck и WorkPass622 suite, но более широкий `NeuroCore core regression validation` на этом SHA выявил три совместимые регрессии/пропуска: отсутствующий P23 local-model adapter, изменившийся fingerprint задач без family metadata и приоритет `duplicate-evidence-ref` над точным `duplicate-attempt`. Эти три точки исправлены последующими коммитами в этой ветке; исправленный latest HEAD нужно повторно проверить, и до этого нельзя считать общий regression gate закрытым.

## Что доказывает эта работа, а что ещё нет

Это инженерная интеграция кода и regression-тестов. До появления успешного CI run на exact HEAD нельзя утверждать, что suite прошла. Даже успешная suite докажет только охваченные программные инварианты, а не универсальное улучшение качества обучения или полноценное автономное саморазвитие.

Остаются отдельные gates:
1. CI/typecheck и вся suite на этом веточном HEAD;
2. реальный evaluator/provider/runtime с неизменяемыми manifest и holdout;
3. независимое сравнение baseline/candidate с несколькими парными seeds и переносом на unseen tasks;
4. доказанный workflow обучения от реального outcome до staged candidate, evaluation, trusted approval, promotion/rollback;
5. долгий soak и проверка восстановления журналов/состояния на реальном окружении.

## Команды проверки

Из `runtime/neuro-kurisu`:

```sh
npm ci
npm run typecheck
npm run test:workpass622:learning-evidence
npm run test:p23:learning
```

Обновление Release ZIP не входит в этот change-set. Релизный архив должен пересобираться отдельно из подтверждённого source SHA после прохождения production gates.
