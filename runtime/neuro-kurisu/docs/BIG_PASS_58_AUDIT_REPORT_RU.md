# BIG PASS 58 — System Contract + Recurrent Organism Graph

Релиз: **34.29.0**.

## Реализовано
- единый runtime lifecycle contract для семи physical systems;
- systemName/dependencies/systemCapabilities/health на runtime-owner'ах;
- `OrganismSystemFabric.contracts()` с runtime-bound snapshot/health;
- capability matrix;
- dependency graph с явной фиксацией циклов;
- детерминированный execution order, не подменяющий рекуррентные зависимости DAG-ом;
- `/api/organism/system-graph`;
- `OrganismCore.organismSystemGraph()` и `organismSystemExecutionOrder()`;
- новые regression tests.

## Важный архитектурный вывод
У организма есть рекуррентные связи между Self/Memory/World и другими доменами. Поэтому полный dependency graph не должен насильно становиться DAG. Для scheduling используется отдельный execution rank.

## Что сознательно не сделано
Массовый event-sourcing persistence rewrite не выполнялся: сохранена семантика существующего PersistenceProjectionCoordinator. Следующим безопасным шагом является differential delta projection.
