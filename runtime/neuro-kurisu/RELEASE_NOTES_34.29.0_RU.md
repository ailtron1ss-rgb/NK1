# Neuro-Kurisu 34.29.0 — BIG PASS 58

## Главный результат
Введён единый machine-checkable System Contract поверх семи physical organism systems и системный execution order поверх рекуррентного dependency graph. Полный dependency graph сохраняет циклы, а scheduler использует отдельный executionRank.

## Что изменилось
- `OrganismSystemFabric` теперь отдаёт runtime-bound contracts, capability matrix, health и system graph.
- Каждый physical runtime-owner имеет `systemName`, `systemCapabilities` и health probe.
- Добавлены `dependencyCycles()` и `executionOrder()` без ложного превращения рекуррентного организма в DAG.
- `OrganismCore` получил наблюдаемые `organismSystemGraph()` и `organismSystemExecutionOrder()`.
- Добавлен `/api/organism/system-graph`.
- `CognitiveExecutionPlanner` теперь распределяет budget между органами с учётом phase, cost, cadence, pressure и execution rank; Governance получает критический резерв.
- Внутренний persistence projection остаётся семантически прежним; массовый event-sourcing rewrite сознательно отложен до differential-equivalence тестов.

## Validation
- TYPECHECK PASS
- BIG PASS 52–57 regression PASS
- BIG PASS 58 System Contract PASS
- BIG PASS 58 System Fabric PASS
- 250-cycle operational PASS
- 500-warm operational PASS
- 1000-cycle device qualification не сертифицирован автоматически и требует отдельного длительного прогона на реальном Android.
