# NK1 Completion Kit v0.2.0 — evidence-first надстройка NeuroCore

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

Полный ZIP содержит верхнюю папку `completion-kit/`. Распакуйте его из корня NK1 в `runtime/neuro-kurisu/`, чтобы появился `runtime/neuro-kurisu/completion-kit/`. Перед распаковкой проверьте SHA-256 по `COMPLETION_KIT_INSTALL_RU.md`.

Требуется Node.js 22.12+. Из `runtime/neuro-kurisu/completion-kit`:

```bash
npm test
npm run audit
npm run imports
npm run test-surface
npm run report
npm run tree
npm run cef-check -- ./evidence/cef-snapshot.json
npm run gate -- foundation
npm run verify
```

Скрипты аудита читают соседнее дерево исходников NK1; production promotion CLI использует существующий канонический `../src/organism/learning/PairedSeedConfidence.ts`, не копируя bootstrap-алгоритм.

## Интеграция с NeuroK Engineering OS

Completion Kit **не создаёт второй** координатор агентов, patch sandbox, capability registry или evidence ledger. Эти функции принадлежат корневому NeuroK Engineering OS. Completion Kit отвечает за runtime-специфичные проверки: canonical owners, import graph, test surface, strict CEF snapshots, paired-seed policy и skill-promotion gate.

Из корня NK1 доступны существующие команды:

```bash
npm run neurok-os:validate
npm run neurok-os:test
npm run neurok-os:claims -- list
npm run neurok-os:snapshot -- --paths src/a.ts,src/b.ts --out .neurok-os/read-set.json
npm run neurok-os:claims -- verify --task TASK_ID --agent AGENT_ID
```

Gate runner привязывает каждый gate report к текущим Git branch и полному commit SHA. При отсутствующей provenance, изменённом рабочем дереве или устаревшем SHA статус PASS блокируется. PASS и FAIL receipts передаются в корневую команду `neurok-os:evidence` и сохраняются существующим canonical evidence ledger. Повторная запись отчёта: `npm run record-evidence -- reports/gate-<id>-<timestamp>.json`.

Локальный каталог `.neurok-os/` содержит claims и receipts и должен оставаться вне Git. Это локальная evidence-запись, а не production deployment и не доказательство когнитивного улучшения.

## Что входит

- `ARCHITECTURE_MEGA_TREE_RU.md` — целевое архитектурное дерево с привязкой к существующим компонентам и открытым пробелам.
- `architecture/` — owners, module map, gates, research ledger и benchmark matrix.
- `contracts/` — JSON Schema для cognitive cycle, evaluation run и skill promotion.
- `src/` — CEF lineage audit, статистика экспериментов, promotion policy, Git provenance и адаптер exact-SHA receipts.
- `scripts/` — аудит владельцев, import graph, test surface, CEF snapshot, dataset hashes, дерево, gate runner и evidence adapter.
- `tests/` — регрессионные проверки Completion Kit, provenance и fail-closed exact-SHA evidence adapter.
- `reports/` — исходный checkpoint и локальные отчёты; generated gate reports игнорируются Git.

## Границы действия

- Пакет не запускает непрерывное обучение и не меняет production memory/persisted state.
- Promotion evaluator формирует отчёт, но не записывает навыки в production skill store.
- N.E.K.O., AIRI, Hermes, Letta, Hindsight и Mem0 перечислены как reference projects; код, веса и данные из них не импортированы.
- Пакет не доказывает сознание, AGI, автономность или улучшение качества модели.
- Незакрытые RU/EN holdout, transfer, длительная self-initiative, browser/WebGL E2E, Android soak, power-loss recovery и human license review остаются GAP/UNKNOWN.

Completion Kit — runtime-specific audit and evaluation plane над NK1 и использует существующий Engineering OS как единый repository-level control plane.
