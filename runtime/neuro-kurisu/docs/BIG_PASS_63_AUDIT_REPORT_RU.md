# BIG PASS 63 — Causal Accountability Graph

## Что изменено
- Добавлен `CausalAccountabilityGraph` как единая причинная проекция действия.
- `ActionGateway`/Core теперь не только записывают `ok/verified`, но связывают goal/decision/prediction → action → outcome → verification → observation/prediction-error.
- Граф bounded: 192 nodes, 384 edges, 32 active chains. Он является производной диагностико-эпистемической проекцией, а не второй memory/world store.
- Snapshot/restore и schema migration добавлены.

## Принцип
`tool OK` не становится причинной истиной. Независимая external verification создаёт отдельные verification/observation nodes. Отсутствие verification создаёт prediction-error node.

## Следующий шаг
Подключить реальные Android/file/HTTP observers и использовать причинную цепочку как основу для outcome-driven learning и shadow comparison.

## Core integration
`OrganismCore.executeTool()` now creates prediction and decision nodes before tool execution and links them through the action/outcome/verification chain. The graph is persisted in `system.causalAccountability`.

## Source-of-truth rule
`OutcomeCognitionFabric` is the single runtime source for outcome ledger + causal accountability. `system.outcomeVerification` and `system.causalAccountability` are persisted projections, not independent stores.
