# NK1 Completion Kit — evidence-first надстройка NeuroCore

**Назначение:** связать существующие подсистемы NK1 в проверяемую систему аудита, экспериментов и завершения проекта. Это не альтернативное ядро, не второй владелец памяти и не набор пустых модулей.

## Главные архитектурные инварианты

1. Канонический код остаётся в `runtime/neuro-kurisu/src/organism`.
2. Семь владельцев из `OrganismSystemFabric` остаются единственными владельцами подсистем: `self`, `governance`, `memory`, `world`, `embodiment`, `agency`, `research`.
3. `MemoryOS2` / `MemoryFabric`, `CognitiveEventFabric`, `UnifiedCognitiveCycle`, P23 и persistence-контракты не заменяются этим пакетом.
4. Строгий cognitive cycle — 11 этапов: observation, prediction, appraisal, attention, memory, goal, plan, action, outcome, learning, self-update.
5. Любая новая функция проходит `implemented → wired → tested → independently measured → released`.
6. Наличие файлов, синтетическая фикстура или telemetry counter не считаются приростом интеллекта.
7. Promotion навыка запрещён без frozen holdout, парных seeds, независимого evaluator и безопасного rollback.

## Установка и запуск

ZIP содержит верхнюю папку `completion-kit/`. Распакуйте его из корня репозитория NK1 в `runtime/neuro-kurisu/`, чтобы получился путь `runtime/neuro-kurisu/completion-kit/`.

До распаковки проверьте SHA-256 архива по инструкции `COMPLETION_KIT_INSTALL_RU.md`.

Требуется Node.js 22.12+. В каталоге `runtime/neuro-kurisu/completion-kit`:

```bash
npm test
npm run audit
npm run imports
npm run test-surface
npm run report
npm run tree
npm run cef-check -- ./evidence/cef-snapshot.json
npm run verify
```

Completion Kit не добавляет npm dependencies. Скрипты `audit`, `imports` и `test-surface` читают соседнее дерево исходников NK1 и поэтому запускаются после установки полного репозитория.

## Что входит

- `ARCHITECTURE_MEGA_TREE_RU.md` — целевое архитектурное дерево с привязкой к существующим компонентам и открытым пробелам.
- `architecture/owners.json` — семь canonical subsystem owners и границы записи.
- `architecture/module-map.json` — реестр модулей и gaps.
- `architecture/gates.json` — критерии и команды проверки.
- `architecture/research-ledger.json` — источники и направления адаптации.
- `architecture/benchmark-matrix.json` — измеримые направления оценки.
- `contracts/` — JSON Schema для cognitive cycle, evaluation run и skill promotion.
- `src/` — CEF lineage audit, статистика экспериментов и консервативный promotion gate.
- `scripts/` — аудит владельцев, import graph, поверхности тестов, CEF snapshot, dataset hashes, дерево, отчёты и запуск существующих NK1 gates.
- `tests/` — регрессионные проверки Completion Kit.

## Границы действия

- Пакет не запускает непрерывное обучение и не меняет production memory/persisted state.
- Promotion evaluator формирует отчёт, но не записывает навыки в production skill store.
- N.E.K.O., AIRI, Hermes, Letta, Hindsight и Mem0 перечислены как reference projects; код, веса и данные из них не импортированы.
- Пакет не доказывает сознание, AGI, автономность или улучшение качества модели.
- Незакрытые RU/EN holdout, transfer, длительная self-initiative, browser/WebGL E2E, Android soak, power-loss recovery и human license review остаются `GAP`/`UNKNOWN`.

Completion Kit — проверяемый управляющий слой над текущим NK1, а не новая когнитивная система параллельно ему.
