# OmeStro №17 — Architecture Morphogenesis v1

**Дата:** 17 ноября 2026  
**Репозиторий:** `ailtron1ss-rgb/NK1`  
**Ветка:** `aspect/morphogenesis-architecture-20261117`  
**Зависимость:** Draft PR #902 — Developmental Genome  
**Статус:** реализован управляющий слой планирования; кандидатные изменения не применяются.

## Назначение

Architecture Morphogenesis превращает перестройку исходной архитектуры NK1 из неформального набора правок в проверяемую миграцию. Он описывает архитектуру как граф модулей, владельцев контрактов и потоков данных, сравнивает базовый и кандидатный графы и формирует план изменения с контрольной точкой и обратным ходом.

Это инженерный механизм для исходной архитектуры, а не одноимённый механизм нейропластичности микросхем. Существующие `NeuralMorphogenesisEngine` и `NeuralMorphogeneticConstraintSolver` остаются владельцами внутренней пластичности; они не перепрофилируются для перемещения файлов или модулей.

## Подходы

1. **Автономный переписыватель репозитория** — отклонён: у него были бы права на изменение дерева исходников и возможность обходить review/Release gates.
2. **Read-only graph + evidence-gated migration planner** — выбран: строит проверяемый граф, планирует merge/split/move/replace, фиксирует baseline, migration и rollback, но не меняет файлы и не сливает ветки.
3. **Изменение семи системных контрактов через новый runtime** — отложено: это дублировало бы владельцев и конфликтовало с Developmental Genome.

## Точки интеграции

- `CognitiveArchitectureMap` остаётся источником карты когнитивных подсистем, владельцев, зависимостей и потоков.
- `DevelopmentalGenome` остаётся источником digest неизменяемого набора канонических системных контрактов. Кандидат №17 не может переписать этот digest.
- `audit:architecture` остаётся авторитетной проверкой полного относительного import graph исходного кода: отсутствующие импорты, циклы и запрещённая утечка в legacy/research.
- Новый `ArchitectureMorphogenesisEngine` является coordinator/planner над этими источниками; он не создаёт параллельный runtime, memory owner, migration engine или release authority.

## Модель графа

- **Module**: стабильный id подсистемы, основной канонический путь под `src/organism/`, полный список её канонических source paths, явный owner и SHA-256 revision, вычисленный по фактическим байтам каждого файла.
- **Source provenance**: полный 40-символьный commit SHA из `GITHUB_SHA` в GitHub Actions или явного `NK1_SOURCE_COMMIT` в локальной обвязке. Baseline и candidate графы привязаны к точным commit; evidence gate сверяет candidate SHA не только с branch, но и с commit, запечатанным внутри candidate graph. Граф без source provenance можно прочитать и диагностировать, но использовать как основание миграционного плана нельзя.
- **Contract**: один owner, перечень потребителей и режим `single-owner` либо `shared`.
- **Edge**:
  - `import` — структурная связь исходных модулей; цикл запрещён.
  - `contract` — зависимость owner/consumer; цикл запрещён.
  - `data-flow` — когнитивный поток; обратные/рекуррентные циклы допустимы и сохраняются.
- Запрещены пути с traversal, абсолютные пути, legacy/legacy-original, research и state.
- Входы должны быть ограниченными plain-data структурами: getter/accessor, циклы объектов, нестандартные прототипы и malformed payload закрываются fail-closed.

Живой снимок v1 строится из текущего `CognitiveArchitectureMap` и digest `DevelopmentalGenome`. Каждый узел покрывает все канонические файлы, перечисленные для подсистемы; revision digest рассчитывается из SHA-256 реальных файлов, а не только описательных метаданных. Реальный source import graph проверяется отдельным `audit:architecture`; концептуальную карту потоков нельзя выдавать за доказательство полного графа импортов.

## Операции

- **merge**: две или более baseline-модуля выводятся из candidate и заменяются одним явно указанным target.
- **split**: один baseline-модуль выводится из candidate и заменяется минимум двумя новыми модулями.
- **move**: сохраняется module id и фиксируется точная пара old/new path.
- **replace**: сохраняются id и path, но меняется revision/owner.

Любая структурная разница должна быть покрыта соответствующей операцией. Неописанные добавления/удаления, перемещения и замены блокируются. При изменении contract graph migration plan обязан перечислить все изменённые contract IDs — ни один и только они.

## Migration и rollback contract

Каждый план связан с:
1. полным SHA базового commit;
2. отдельной веткой `aspect/*` или `feature/*`;
4. контрольной точкой, привязанной к тому же base SHA и имеющей восстановимую ссылку;
5. нумерованными migration steps с описанием и способом проверки;
6. нумерованными rollback steps с описанием и способом проверки;
7. digest всего плана.

Кандидат не может быть изменён после построения плана без нарушения plan digest.

## Evidence gate

`evaluateArchitectureMorphogenesisPlan` требует:
- focused tests;
- runtime typecheck;
- полный architecture audit;
- contract checks;
- подтверждённый rollback;
- точные baseline/candidate commit SHAs;
- явное human review approval.

Нет доказательств — `NEEDS_REVIEW`. Провал любого обязательного технического gate — `BLOCKED`. Все проверки и review пройдены — `ELIGIBLE_FOR_MANUAL_INTEGRATION`.

Даже последний статус не сливает ветку: `mergeAllowed=false`, `activation=NOT_APPLIED`. Он лишь означает, что кандидат может быть передан на отдельное ручное решение об интеграции.

**Граница доверия:** движок проверяет форму и согласованность переданных evidence-полей, но сам не обращается к GitHub, не аутентифицирует аккаунт рецензента и не проверяет подписи на CI/review receipts. Поля `testsPassed`, `rollbackVerified` и `reviewApproved` — утверждения вызывающей доверенной обвязки, а не криптографическое доказательство. Поэтому итоговый статус не заменяет реальный GitHub Actions run, GitHub review и ручное решение maintainer-а.

## Команды

Из `runtime/neuro-kurisu`:

```sh
npm run test:architecture-morphogenesis
npm run architecture:morphogenesis:inspect
npm run test:developmental-genome
npm run typecheck
npm run audit:architecture
```

Для этого feature создан отдельный workflow `.github/workflows/architecture-morphogenesis.yml`.

## Ограничения v1

- Не вносит файловые изменения в NK1 автоматически.
- Не создаёт и не переключает Git-ветки, не пишет коммиты и не выполняет merge.
- Не загружает модули динамически и не выполняет hot-swap.
- Не меняет persisted state, state schema, model weights или Release ZIP.
- Не заявляет, что структурное упрощение улучшает когнитивную эффективность без отдельных измерений, paired seeds и holdout.
- Сам отчёт архитектурной карты не доказывает production call-path activation.

Следующая ступень может добавить сбор полного файлового import graph в один унифицированный report, но только при переиспользовании единого parser/auditor, а не при создании конкурирующего анализатора imports.
