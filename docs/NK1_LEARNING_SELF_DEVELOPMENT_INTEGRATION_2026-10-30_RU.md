# NK1 — интеграция обучения и саморазвития (30.10.2026)

**Ветка интеграции:** `aspect03-learning-self-development-2026-10-30`  
**База:** `workpass70-source`, исходный SHA `d8bdf7a14f30d540c1503a436ad993c8d7be8400`  
**Источник полезных изменений:** `feature/learning`  
**Состояние:** код перенесён в отдельную ветку; exact-head CI и интеграционные испытания ожидают результата после открытия PR. Не считать этот документ подтверждением прохождения тестов.

## 1. Цель этого прохода

Не создавать второй learner, второй планировщик или отдельное хранилище навыков, а усилить существующий P23 lifecycle в текущем исходном дереве. Все новые механизмы встроены в уже существующие `P23LearningEngine`, `IndependentSkillCandidateEvaluator`, `SkillLearnBenchAdapter`, `VersionedSkillCandidateStore`, `OrganismRuntime` и `FileStateStore`.

Основная цепочка:

`verified outcome → failure diagnosis → reflection/curriculum → candidate generation → isolated execution → independent verifier + safety scanner → paired validation/holdout → task/family/seed gates → signed evidence + explicit approval → staged/activated skill version → lifecycle journal → outcome reconciliation`.

Генерация кандидата, оценка, approval, активация и проверка последствий остаются разными стадиями и разными границами доверия.

## 2. Что реально интегрировано

### 2.1 Независимая оценка: задача, семейство и seeds

В `SkillLearnBenchAdapter.ts` добавлены отдельные per-task и per-family regression guards. Средний рост не может компенсировать сильный провал одной задачи или умеренное ухудшение целого семейства.

В `IndependentSkillCandidateEvaluator.ts` добавлена проверка provenance/coverage и matched paired-seed анализа; диагностические robust metrics не являются полномочием на активацию.

Единая политика P23 в `P23LearningEngine.ts`:

- минимальное покрытие validation и holdout: не менее одного семейства;
- минимум две разные задачи на семейство;
- минимум три общих paired seeds на семейство;
- максимум validation-регресса одной задачи: 0,20;
- максимум validation-регресса семейства: 0,10;
- максимум holdout-регресса: 0,02;
- максимум holdout-регресса семейства: 0,10;
- доверительный уровень: 0,95; начальный bootstrap budget: 2000 повторов.

Пороговые значения являются стартовой политикой NK1, а не универсальными научными константами. Их нужно калибровать на заранее зафиксированном наборе задач и seeds. При недостаточном числе независимых данных кандидат остаётся заблокированным; нулевой прирост не следует выдавать за улучшение.

### 2.2 Повторяемость и robust metrics

Добавлены:

- `PairedSeedConfidence.ts` — детерминированный bootstrap-интервал для paired deltas, с фиксируемым seed и ограничением общего числа draws;
- `LearningRobustMetrics.ts` — task-balanced IQM/median, optimality gap, paired probability of improvement и bootstrap-интервалы для task success, skill quality и trajectory quality.

Эти метрики имеют `diagnosticOnly: true`. Они дают более полную картину качества и неопределённости, но сами по себе никогда не выдают разрешение на promotion.

### 2.3 Долговечный fitness journal

`LearningFitnessJournal.ts` хранит только агрегированное решение gate: fingerprints payload/evaluation/plan/environment, версию политики, числа matched trials, общие показатели по split и reason codes.

Гарантии реализации включают hash chain, идемпотентность повторного решения, проверку точных полей, ограничение размера, lock-файл, fsync и отказ при tampering/невалидных accessor inputs. Сырые prompts, индивидуальные task rows и подробные holdout-ответы в журнал не записываются.

### 2.4 Журнал жизненного цикла активации

`LearningLifecycleJournal.ts` фиксирует отклонение кандидата, intent активации, подтверждение/ошибку/неизвестный результат и последующее reconciliation. Журнал hash-chained, append-only и защищён от повторной записи идентичного перехода.

`P23LearningEngine.reconcileLearningLifecycleOutcomes()` сверяет незавершённые intent/unknown события с авторитетным `VersionedSkillCandidateStore`. Запись в журнале не является источником полномочий: активной считается только версия, реально присутствующая в store и соответствующая точному skill/version/payload.

### 2.5 Runtime bootstrap и восстановление после restart

Добавлен `LearningJournalBootstrap.ts` и подключён `OrganismRuntime`.

Когда runtime получает явно сконфигурированный `compoundRepairRevision.engine`, он:

1. подключает default fitness journal рядом с state file;
2. подключает lifecycle journal рядом с state file;
3. сохраняет ранее переданные host sinks — default wiring не перезаписывает их;
4. передаёт coordinator отдельный `FileStateStore` для retry backoff;
5. восстанавливает retry state во время `init()`, до начала дальнейшей фоновой работы.

Пути журналов: `<state>.learning-fitness.jsonl` и `<state>.learning-lifecycle.jsonl`. Retry state: `<state>.p23-retry-backoff.json`. Это отдельные файлы; они не переиспользуют файл основного состояния организма.

### 2.6 Долговечный cooldown повторных ревизий

`P23CompoundRepairRevisionCoordinator.ts` получил сохраняемый retry-backoff state. Базовая пауза — 30 минут, экспоненциальное увеличение ограничено 24 часами, число попыток ограничено. Повтор с тем же evidence digest не должен повторно запускать дорогого provider после restart; новое подтверждённое evidence образует отдельный retry budget.

### 2.7 Диагностика ошибок и коррекции

Изменён канонический feedback path в `OrganismCore.ts`: ограниченные outcome notes передаются в P23 `recordExperience`, чтобы learner мог классифицировать причины неудач, а не видеть только число success/reward.

Добавлена `CorrectionRuleMemory.ts` как адаптация Hexis-подхода: в хранилище попадают только явно проверенные correction observations. Модуль может предложить усиление/пересмотр правила, но не активирует hard gate и не выдаёт approval.

### 2.8 P36 host-owned evidence evaluator

Добавлены `P36VerifiedOutcomeLedgerEvaluator.ts` и `P36HostEvaluatorBootstrap.ts` для работы с подписанными outcome artifacts, доверенным manifest и независимыми host-owned executor/verifier/safety authorities. Эти модули не добавляют отдельный Python/DSPy runtime и не делают вывод о качестве без подтверждённых подписанных данных.

## 3. Перенесённые исходные файлы и проверки

Интегрированы/обновлены основные модули:

- `P23LearningEngine.ts`
- `IndependentSkillCandidateEvaluator.ts`
- `SkillLearnBenchAdapter.ts`
- `P23CompoundRepairRevisionCoordinator.ts`
- `OrganismCore.ts`
- `OrganismRuntime.ts`

Добавлены модули:

- `LearningTrustBoundary.ts`
- `CorrectionRuleMemory.ts`
- `PairedSeedConfidence.ts`
- `LearningRobustMetrics.ts`
- `LearningFitnessJournal.ts`
- `LearningLifecycleJournal.ts`
- `LearningJournalBootstrap.ts`
- `P36HostEvaluatorBootstrap.ts`
- `P36VerifiedOutcomeLedgerEvaluator.ts`

Добавлены или синхронизированы регрессии:

- P23 attempt diagnosis и reflection reason wiring;
- P23 generator boundary и production family gate;
- paired-seed bootstrap confidence;
- task-balanced robust metrics;
- fitness journal tampering/idempotency/privacy;
- lifecycle journal integrity и uncertain activation reconciliation;
- retry cooldown после перезапуска;
- default journal bootstrap и host sink preservation;
- Hexis correction memory;
- P36 signed outcome ledger evaluator и host bootstrap;
- обновлены P23 true-learning, independent evaluator, matched evaluation и reflective gate regressions.

## 4. CI и команды проверки

Добавлены package scripts для каждого теста и aggregate script:

`npm run test:p23:learning-governance`

`npm run test:p23:learning` теперь включает существующий true-learning test и новый governance suite.

Workflow `.github/workflows/p26-learning-validation.yml` расширен: добавлены новые source/test paths и отдельный шаг запуска P23 suite. Timeout увеличен с 15 до 25 минут из-за расширения фактического объёма проверок.

После открытия PR необходимо проверить на exact PR head:

1. `npm ci`;
2. `npm run typecheck`;
3. каждый новый targeted test;
4. `npm run test:p23:learning`;
5. полный P26 workflow и P36 targeted tests;
6. отсутствие skipped/neutral steps и runner-less workflow runs.

Прохождение unit/fixture тестов не заменяет независимую проверку на реальном model provider, production runtime и длительном soak.

## 5. Что специально не сделано

- Не сливалась целиком diverged ветка `feature/learning`; перенос сделан выборочно относительно общего предка.
- Не заменялся весь `package.json`/lockfile логикой старой ветки: добавлены только scripts, нужные этому срезу.
- Не добавлялась Python/DSPy/GEPA runtime-зависимость и второй learning service.
- Не активируются автоматически сгенерированные навыки; signed evidence и отдельное approval остаются обязательными.
- Не утверждается, что recall или общий интеллект уже выросли: это нужно измерить на независимом holdout.
- Не обновлялся `main` и не создавался новый Release ZIP; сначала нужен зелёный exact-head CI и проверенный source artifact.

## 6. Что остаётся до принятия в source

1. Исправить все compile/runtime/CI дефекты, обнаруженные PR checks.
2. Подтвердить на реальном runtime, что P23 journals создаются в configured path и выдерживают restart/restore.
3. Провести matched baseline/candidate тесты минимум на пяти парных seeds на фиксированном RU/EN task manifest; политика promotion внутри каждого family требует минимум три общих seeds, а исследовательский holdout должен быть шире.
4. Провести regression/transfer/forgetting/drift тесты после длительного интервала и после смены модели.
5. Проверить, что signed receipts выдаются реальным независимым verifier, а не исполняемой кандидатом стороной.
6. Провести restart/kill/reconnect тест для action outcomes и retry state.
7. После принятия PR пересобрать release ZIP из exact проверенного SHA, вычислить SHA-256, сравнить manifest и проверить чистое восстановление. Только затем публиковать новый Release.

**Статус на момент создания документа:** код и CI wiring находятся в отдельной интеграционной ветке. Пока exact-head Actions не завершились успешно, результат имеет статус `IMPLEMENTED / CI-PENDING`, а не `VALIDATED` или `PRODUCTION-READY`.
