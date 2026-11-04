# NK1 Completion Kit — обновлённый исходный checkpoint v0.2.0

- Репозиторий: `ailtron1ss-rgb/NK1`
- Каноническая source branch: `workpass70-source`
- Upstream HEAD на момент этого checkpoint: `06e8831447b29bc128cc56ba03dbf942471bea5b`
- Родитель: `d8902d765ef218a32125567f24345fea77f1c902`
- Commit: `[NK1][EngineeringOS] Add governed multi-agent engineering control plane`
- Runtime package: `35.90.0`

## Подтверждённые архитектурные владельцы

- Один `OrganismSystemFabric` с семью физическими владельцами: self, governance, memory, world, embodiment, agency, research.
- `MemoryOS2` — canonical writable owner записей; `MemoryFabric` — lifecycle boundary.
- `CognitiveEventFabric` — причинный evidence ledger, не отдельная база памяти.
- `CycleCompletenessPolicy` и `UnifiedCognitiveCycle` различают legacy six-stage core и строгий eleven-stage full cycle.
- P23 содержит guarded candidate/skill lifecycle, независимые evaluator contracts и local-model revision generator.
- `PairedSeedConfidence.ts` — канонический deterministic paired-seed bootstrap; promotion CLI Completion Kit импортирует его, не копируя алгоритм.

## Repository-level NeuroK Engineering OS

- `engineering-os/manifest.v1.json` — capability/policy registry с unverified/fail-closed defaults.
- `tools/neurok-os-coordinator.mjs` — lease-based task claims, single-writer ownership, base-SHA и read-set freshness.
- `tools/neurok-os-patch.mjs` — unified-diff preflight; это не patch apply executor.
- `tools/neurok-os-evidence.mjs` — canonical exact-SHA evidence receipt ledger.
- `tools/neurok-os.mjs` — registry/status/planning CLI.
- `neurok-os:*` root npm scripts и GitHub Actions workflow проверяют control plane.

Coordinator сейчас advisory и локальный; не выдаём это за работающую многопользовательскую распределённую платформу.

## Разделение ответственности

- Engineering OS: agent claims, read-set freshness, patch preflight, capability governance, exact-SHA receipts.
- Completion Kit: NK1 runtime owner audit, import graph, test surface, strict CEF snapshot audit, benchmark matrix, promotion policy и gate runner.
- Completion Kit не создаёт второй memory/identity/goal owner или отдельный evidence database.

## Открытые доказательные пробелы

- Независимый RU/EN memory retrieval uplift на frozen holdout.
- Unseen-task generalization и skill transfer без forgetting/catastrophes.
- Длительная полезная self-initiative.
- Browser/WebGL rendered-pose E2E и 30–60 minute soak.
- Реальный Android audio interruption / viseme clock / thermal soak.
- Power-loss recovery на целевом устройстве.
- Human license review и release из exact approved SHA.

## Протокол

Перед каждым применением обновить source HEAD. Все gate reports привязываются к точному SHA, environment, command output и (для evaluation) dataset/seed. Любой UNKNOWN/UNRESOLVED остаётся открытым. Локальные unit tests и синтетические fixtures не заменяют тесты полного runtime и внешние holdouts.
