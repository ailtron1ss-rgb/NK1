# NK1 Completion Kit — надстройка завершения NeuroCore

**Назначение:** связать уже существующие подсистемы NK1 в проверяемую систему завершения проекта. Это не альтернативное ядро, не новый владелец памяти и не набор пустых модулей.

## Главные правила

1. Канонический проект остаётся `runtime/neuro-kurisu/src/organism`.
2. Семь владельцев из `OrganismSystemFabric` остаются единственными физическими владельцами подсистем: `self`, `governance`, `memory`, `world`, `embodiment`, `agency`, `research`.
3. `MemoryOS2` / `MemoryFabric`, `CognitiveEventFabric`, `UnifiedCognitiveCycle`, P23 и текущие persistence-контракты не заменяются этим пакетом.
4. Любая новая функция проходит цепочку `implemented → wired → tested → independently measured → released`.
5. Синтетическая фикстура, unit-тест или красивый telemetry counter не считаются независимым приростом интеллекта.
6. Promotion навыка запрещён без совпадающего frozen holdout, парных seeds, независимого evaluator и безопасного rollback.
7. Не добавлять ничего, что создаёт второй источник истины, фиктивную автономность или неиспользуемый интерфейс.

## Установка и запуск

Пакет использует только Node.js и существующий runtime NK1. Он не добавляет npm-зависимостей.

```bash
cd runtime/neuro-kurisu/completion-kit
npm test
npm run audit
npm run imports
npm run test-surface
npm run report
npm run tree
npm run cef-check -- <cef-snapshot.json>
npm run verify
```

На Windows PowerShell команды те же. Требуется Node.js 22.12+.

Независимая проверка готового CEF snapshot (формат: `events` + массив `cycles` с `tick` и `stageIds`):

```bash
npm run cef-check -- ./evidence/cef-snapshot.json
```

Запуск существующих project-gates (только когда runtime установлен вместе с зависимостями):

```bash
node scripts/run-gate.mjs foundation
node scripts/run-gate.mjs memory
node scripts/run-gate.mjs learning
node scripts/run-gate.mjs motivation
node scripts/run-gate.mjs all
```

`run-gate` вызывает только команды, уже объявленные в `runtime/neuro-kurisu/package.json`. Он не подменяет тесты Completion Kit и не сообщает об успехе, если subprocess вернул ненулевой код.

## Что входит

- `ARCHITECTURE_MEGA_TREE_RU.md` — большое дерево конечной конструкции с привязкой к реальным файлам и явными незакрытыми направлениями.
- `architecture/owners.json` — канонические владельцы семи физических подсистем и границы записи.
- `architecture/module-map.json` — реестр фактических модулей и пробелов; пути проверяются скриптом.
- `architecture/gates.json` — строгие критерии завершения и команды проекта.
- `architecture/research-ledger.json` — источники и конкретные направления адаптации.
- `contracts/` — машинно-читаемые схемы цикла, эксперимента и promotion.
- `src/` — чистые функции для проверки CEF lineage, анализа экспериментов и promotion gate.
- `scripts/` — аудит реальных файлов, статический граф импортов, проверка поверхности тестов, независимая проверка CEF snapshot, dataset hash verifier, генератор source tree, отчёт и запуск gate.
- `tests/` — regression-тесты самого Completion Kit.

## Чего пакет НЕ делает

- Не запускает обучение по расписанию автоматически.
- Не трогает production memory / persisted state.
- Не меняет `OrganismCore`, `OrganismRuntime`, `MemoryOS2` или P23.
- Не сливает исходники N.E.K.O., AIRI, Hermes, Letta, Hindsight или Mem0.
- Не объявляет сознание, AGI, автономность или улучшение модели доказанными.
- Не создаёт release ZIP и не снимает лицензионные запреты.

## Статус

Это инженерная надстройка для аудита и управления завершением. Она может доказать наличие файлов, целостность тестовой поверхности, корректность входной структуры причинной цепочки и соблюдение формальных экспериментальных ворот. Она не может сама доказать, что весь runtime интеллектуально эффективен: это требует реальных запусков, независимого evaluator, замороженных holdout-наборов и испытаний на целевых устройствах.
