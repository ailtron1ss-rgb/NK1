# BIG PASS 57 — Persistence Projection Coordinator / Core Decomposition

## Цель
Вынести mapping persistence из `OrganismCore`, не меняя смысл persisted state, и создать единый координатор projection с локальной memoization snapshots.

## Фактически внедрено
- `PersistenceProjectionCoordinator` стал владельцем правил hot/full persistence projection.
- `OrganismCore` теперь вызывает coordinator вместо 16+ KB inline projection mapping.
- Добавлен `projectionContext()` как единственная точка передачи runtime owners/engines в coordinator.
- Snapshot memoization действует только внутри одного projection pass и очищается на каждом новом pass.
- `syncHot()` вынесен вместе с полной projection логикой.
- Исторические state schema и persistence contracts сохранены.
- Добавлен regression test `tests/big-pass-57-persistence-coordinator.mjs`.
- Добавлен npm command `test:big-pass-57-projection` и aggregate `audit:pass57`.

## Измеримый результат
`OrganismCore.ts`: 3414 → ~3184 строк.
Projection mapping: вынесен в отдельный coordinator (~286 строк).
Это не обещает одинакового уменьшения CPU: главный выигрыш — уменьшение архитектурной связности и устранение повторных snapshot calls внутри одного projection pass.

## Что проверено
- TypeScript typecheck PASS.
- BIG PASS 56 system-fabric PASS.
- BIG PASS 52 Memory Fabric/index PASS.
- BIG PASS 53 perceptual grounding PASS.
- BIG PASS 54 world grounding PASS.
- BIG PASS 55 pressure/passive-learning/core synergy PASS.
- Restart persistence PASS.
- Persistence tiering/governor/footprint/hotpath PASS.
- 250-cycle operational PASS.
- 500-warm operational PASS.
- 1000-cycle device qualification: не завершён в доступном окне как у 34.28, так и у контрольного 34.27; поэтому регрессия не доказана и тест не объявлен PASS.

## Ошибки, найденные и исправленные во время прохода
1. Первый generated coordinator не имел hot-wrapper в Core.
2. Snapshot return type был слишком узким (`unknown`) для typed persisted facets.
3. Тестовый fixture governance не содержал `consequences`.
4. Тестовый fixture hot projection сначала проверял неизменность поля, которое hot projection по контракту изменяет.
Все четыре исправлены; typecheck и regression после исправлений PASS.

## Архитектурный invariant
`OrganismCore` не должен напрямую создавать physical subsystem runtimes; physical ownership остаётся за `OrganismSystemFabric`.
Projection mapping не должен возвращаться обратно в Core.

## Ограничения
Coordinator пока получает большой `projectionContext`; это следующий этап декомпозиции. Также persistence projection всё ещё содержит много исторических P-фасетов и не превращён полностью в event-sourced delta log.
