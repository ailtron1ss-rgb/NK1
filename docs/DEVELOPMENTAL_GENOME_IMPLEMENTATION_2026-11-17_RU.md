# Developmental Genome v1 — отчёт о реализации

**Дата:** 17 ноября 2026  
**Проект:** NeuroCore / NK1  
**Репозиторий:** https://github.com/ailtron1ss-rgb/NK1  
**Рабочая ветка:** `aspect/developmental-genome-20261117`  
**База:** `workpass70-source`  
**Pull Request:** [#902 — Developmental Genome control plane](https://github.com/ailtron1ss-rgb/NK1/pull/902)  
**Статус интеграции:** IMPLEMENTED на feature-ветке; PR открыт как Draft; не слит и не опубликован в Release.

## Результат

Реализована идея №7 OmeStro — Developmental Genome — как детерминированный паспорт архитектуры NeuroCore и fail-closed механизм оценки наследуемых конфигураций.

Это не второй runtime, планировщик или хранилище памяти. Геном собирается из действующих семи контрактов организма и связывает их с неизменяемыми правилами целостности, runtime/state-schema контрактом и реальным владельцем миграции состояния.

## Интеграция с существующими владельцами

| Канонический владелец | Использование геномом | Что осталось у владельца |
|---|---|---|
| `OrganismSystemContract` | Источник семи контрактов, зависимостей, ресурсов и возможностей | Владение системными контрактами |
| `OrganismSystemFabric` | Построение генома из разрешённых контрактов; API и диагностический snapshot | Компоновка и lifecycle семи физических систем |
| `InvariantEngine` | Публикует read-only manifest с кодами, путями и серьёзностью правил | Единственный владелец проверки persisted-organism |
| `ReleaseContract` | Версия приложения, organism core, runtime requirements и state schema | Контракт версии/совместимости |
| `StateMigrations.migratePersistedOrganism` | Зафиксирован владелец и путь действующей миграции | Единственный владелец миграции persisted state |
| P53 / P63 / UnifiedDevelopmentalCompiler | Сохраняют существующие роли; геном фиксирует архитектурный контекст | Лаборатория ограниченных изменений, режимы развития и выбор направления развития |

## Реализованный интерфейс

Файл `runtime/neuro-kurisu/src/organism/system/DevelopmentalGenome.ts` предоставляет:

- `buildDevelopmentalGenome(contracts?)` — строит baseline schema v1 по семи текущим контрактам.
- `computeDevelopmentalGenomeDigest(genome)` — канонический SHA-256 содержимого без поля digest.
- `inheritDevelopmentalGenome(parent, changes, ancestors?)` — создаёт дочернюю конфигурацию с явным списком изменений и parent digest.
- `evaluateDevelopmentalGenome(candidate, parent?, ancestors?)` — проверяет структуру, совместимость, lineage и выдаёт результат Evolution Gate.

Публичный runtime boundary:

- `OrganismSystemFabric.developmentalGenome()`
- `OrganismSystemFabricSnapshot.developmentalGenome`

Реестр правил `invariantRuleManifest()` объявлен в `InvariantEngine`; это проекция существующего владельца, а не второй движок проверки.

## Что именно хранится в геноме

Для каждой из семи систем паспорт содержит:

- идентификатор и версию контракта;
- назначение, фазу, связи зависимостей и список возможностей;
- `snapshotWeight01` и `executionRank` как неизменяемые параметры композиции;
- `estimatedCost01` и `cadenceCycles` как ограниченные наследуемые параметры v1.

Порядок модулей и dependency order детерминированы. Baseline отвергает неполный набор систем, отсутствующие/повторные зависимости, self-edge и циклы.

## Наследование и Evolution Gate

В v1 наследуются только:

- `estimatedCost01`: конечное число в диапазоне [0,1];
- `cadenceCycles`: целое число от 1 до 64.

Изменение содержит точные `from` / `to` значения, имя модуля и тип признака. Повторные патчи одного модуля, неизвестные модули, no-op и недопустимые числа отвергаются.

Следующие свойства неизменяемы: состав систем, contract version, назначение, фаза, snapshot weight, execution rank, зависимости, возможности, правила инвариантов, runtime/state-schema контракт и владелец миграции.

Результаты:

- `APPROVED` — кандидат структурно совместим и может быть передан на review; это не активация.
- `NEEDS_REVIEW` — недостаёт доказательства, в частности прямого родителя или всей цепочки предков.
- `BLOCKED` — нарушена структура, хеш, контракт, миграция, dependency graph или lineage.

Для поколения выше первого требуется цепочка предков от непосредственного родителя к baseline поколения 0. Неверный digest/переход поколения блокируется; неполная цепочка не получает автоматического одобрения.

**Каждый кандидат всегда имеет `activation: NOT_APPLIED`.** Геном v1 не меняет работающие системы, код, веса модели или persisted state. Он создаёт проверяемое предложение для последующего инженерного допуска.

## Защитные границы

- SHA-256 — content digest и средство обнаружения изменения содержимого, не криптографическая подпись автора и не независимое доказательство происхождения.
- Нет автономной генерации/загрузки кода, hot-swap, автоматической промоции или самостоятельного ослабления инвариантов.
- Нет нового memory owner, lineage database, planner или миграционного движка.
- Некорректные, циклические и объекты с выбрасывающими getter-ами должны закрываться статусом `BLOCKED`, а не исключением за границей Evolution Gate.
- Ресурсные значения генома — конфигурационные признаки; их изменение ещё не является измеренным улучшением стоимости или производительности.

## Проверка

Проверка выполняется выделенным workflow `.github/workflows/developmental-genome.yml` на Node 22.16.0:

1. `npm --prefix runtime/neuro-kurisu run test:developmental-genome`
2. `npm --prefix runtime/neuro-kurisu run typecheck`
3. `npm --prefix runtime/neuro-kurisu run audit:architecture`

Текущая test suite содержит 15 поведенческих тестов, включая:

- семь живых систем и детерминированный digest;
- уникальный manifest инвариантов и реальный экспорт `migratePersistedOrganism`;
- dependency order, JSON round-trip и отклонение некорректного baseline;
- ограниченное наследование, точный parent digest и поколения 0 → 1 → 2;
- отсутствие автоматического одобрения при недостающем parent/ancestor proof;
- tampering contract version, dependencies, purpose, snapshot weight и execution rank;
- изменения invariant/release/schema/migration контрактов;
- поддельные SHA, циклы, дубли, malformed records, циклический объект и hostile getter.

**Финальная проверка code-bearing HEAD:** PR workflow [44044205037](https://github.com/ailtron1ss-rgb/NK1/actions/runs/44044205037), ветка HEAD `8a84560b58b9a0cd7277c059487a6b266f3c93d9`, job `133905770944` — **SUCCESS**.

- Behavioral suite: **15 passed / 0 failed**.
- Runtime TypeScript: `TYPECHECK=PASS`, Node 22.16.0, npm 10.9.2.
- Architecture: `CLEAN_ARCHITECTURE=PASS`.
- Audit metrics: `sourceFiles=2436`, `canonicalFiles=671`, `missing=0`, `cycles=0`, `legacyLeakage=0`.

Этот run привязан к конкретному PR HEAD `8a84560...`. Последующие обновления отчётной документации не меняли runtime/test/workflow source. Указанная проверка — только специализированный Developmental Genome workflow; она не означает, что все остальные workflow репозитория прошли.

## Границы поставки

- Изменения находятся только в `aspect/developmental-genome-20261117`.
- PR #902 открыт как Draft и не слит.
- State schema не менялась; runtime version не менялся; зависимости не добавлялись.
- GitHub Release `Neuro` и его ZIP asset не изменялись.
- Содержимое Release ZIP не сверено с feature branch; поэтому функция не заявляется как RELEASED.

## Следующий инженерный этап

После review и принятия PR можно отдельно рассмотреть интеграцию genome evolution proposals с безопасным экспериментальным контуром: подписываемая provenance receipt, хранилище lineage (если появится конкретный persistence owner), независимая оценка кандидата, rollback и применение только после отдельного разрешения. Эти возможности не входят в v1 и не должны добавляться в обход существующих governance owners.
