<!-- Current release: 34.27.0 | schema 92 -->
# Neuro-Kurisu 34.27.0 — BIG PASS 56 — аудит System Fabric и ядра

## 1. Цель прохода

Этот проход выполнялся поверх фактического архива `34.26.0`. Предыдущие отчёты BIG PASS 50–55 использовались как baseline-гипотезы, но каждое существенное утверждение перепроверялось по текущему коду. Главный принцип: не добавлять декоративные P-слои, а объединять существующие механизмы в устойчивые физические системы и уменьшать связность `OrganismCore`.

## 2. Главный результат

Добавлен `OrganismSystemFabric` — композиционный владелец семи физических систем организма:

1. Self
2. Governance
3. Memory
4. World
5. Embodiment
6. Agency
7. Evidence / Research

`OrganismCore` больше не создаёт эти runtime owners напрямую. Он держит только ссылки-геттеры и координирует их. Физическое создание объектов происходит в Fabric.

## 3. Дополнительное объединение модулей

Внутри существующих систем физически перенесены:

- Self: P48, P49.
- Embodiment: P66.
- Agency: P67, P68.
- Evidence/Research: P38, P53.

Это не меняет семантику модулей; меняется их lifecycle ownership.

## 4. Persistence / restore

Добавлены системные `restoreFromPersisted()` для физического слоя. Начальный restore из `OrganismCore` теперь имеет один системный вход через `OrganismSystemFabric`, после чего Core восстанавливает только несмещённые/специализированные механизмы, которые пока не входят в physical system owner.

Особенно проверены пути:

- Self identity/continuity/consciousness/personhood;
- MemoryOS/MemoryFabric/P47/P59/P62/P65/P70/P75;
- WorldModel/WorldModel2/P27/P44/P50/P51/P52/P57/P79/GroundedWorld;
- Embodiment/P35/P37/P40/P41/P42/P43/P66;
- Agency/project/budget/quorum/P67/P68;
- Governance/P69/P72/P73/resilience;
- Research/P38/P53/prediction/evidence/shadow.

## 5. Registry inversion

`CognitiveSubsystemRegistry` теперь может строить порты напрямую из `OrganismSystemFabric`, без зависимости от `OrganismCore`. Это уменьшает coupling и открывает путь для отдельного Android host/research harness.

## 6. Routing ownership

`PerceptionRouter` state физически перенесён в `EmbodimentSubsystemRuntime`. Routing теперь является состоянием органа, а не случайным Core-owned field.

## 7. Multi-project scheduling

`MultiProjectScheduler` получил bounded `lastDecision` snapshot/restore. Это делает его наблюдаемым системным компонентом без создания второго источника истины.

## 8. Core slimming

Фактическая динамика размера:

- baseline `34.26.0`: ~3482 строк;
- после прохода: ~3415 строк.

Удалены/перенесены связанные с physical ownership части и лишние импорты. Это не финальное разбиение Core: массовый перенос `syncPersistenceProjection()` сознательно отложен, потому что он затрагивает критический checkpoint contract.

## 9. Метрики hot-path / code complexity

На исходном ядре перед проходом было обнаружено примерно:

- `21` использования `structuredClone`;
- сотни вызовов `snapshot()`/`restore()` на всем Core execution surface;
- физические runtime constructors находились внутри Core.

После прохода все семь physical runtime constructors вынесены из Core в Fabric.

## 10. Verification

### Основные gates

- TYPECHECK — PASS
- CORE_OWNERSHIP — PASS
- CORE_PHYSICAL_OWNERSHIP — PASS
- ARCHITECTURE — PASS
- RELEASE_CONTRACT — PASS
- SOURCE_TRUTH — PASS
- SOURCE_HYGIENE — PASS
- SYNTAX — PASS
- FORENSICS — PASS
- BIG_PASS_56_SYSTEM_FABRIC — PASS
- SUBSYSTEM_REGISTRY — PASS
- CLEAN_RESTART_PERSISTENCE — PASS
- MEMORY_DEDUP — PASS
- PERSISTENCE_PROJECTION_TIERING — PASS
- PERSISTENCE_PROJECTION_GOVERNOR — PASS
- PERSISTENCE_FOOTPRINT — PASS

### Long horizon

250 cycles:

- PASS
- warmed ratio ≈ `1.536`
- first median ≈ `22.42 ms`
- last median ≈ `34.44 ms`
- p95 ≈ `36.27 ms`

500 warm cycles:

- PASS
- warmed ratio ≈ `1.592`
- first median ≈ `25.86 ms`
- last median ≈ `41.15 ms`
- p95 ≈ `45.22 ms`

1000 cycles:

- PASS
- ratio ≈ `1.302`
- steady warm ≈ `35.29 ms`
- last ≈ `45.95 ms`
- p95 ≈ `49.90 ms`
- heap sample `39.30 → 48.88 MB`
- canonical memory `216`
- wall time ≈ `33.42 s`
- MAXRSS ≈ `290416 KB`

`MAXRSS` заметно выше `heapUsed`, поэтому future mobile qualification нельзя строить только по V8 heap metrics.

## 11. Что НЕ доказано

- полноценная semantic vision;
- полноценное semantic audio;
- learned latent world model человеческого масштаба;
- полноценное continual representation learning;
- доказанная phenomenal consciousness;
- 24h/72h/7d/30d реальное Android endurance;
- human-indistinguishability.

## 12. Честный вывод

BIG PASS 56 улучшил именно организацию организма. Теперь семь physical domains имеют единый composition root и ownership invariant. Это сильнее простого фасада, потому что lifecycle и создание объектов вынесены из Core.

Следующий опасный участок — `syncPersistenceProjection()` и оставшиеся Core-owned P-модули. Их следует рефакторить через отдельный projection coordinator, но только с golden-output regression, чтобы не купить уменьшение Core ценой потери persistence correctness.


## Финальная верификация перед упаковкой
- `npm run audit:big-pass-progress`: **100/100 (147/147)**.
- `npm run audit:pass56`: **PASS** (typecheck, ownership, architecture, contract, source-truth, hygiene, syntax, forensics и регрессии BIG PASS 49–56).
- `npm run audit:integrity`: **PASS**.
- `npm run audit:archive`: **PASS**, manifest 895 файлов до упаковки.
- Изолированный 1000-cycle operational benchmark: **PASS**, 33.42 s wall, ratio 1.302, p95 49.90 ms, heap 39.30→48.88 MB, memory 216.

## Ограничение
Полный исторический `audit:all` не использовался как критерий release-pass: суммарный набор исторических тестов превышает одно окно исполнения. Вместо этого все затронутые контуры прошли targeted regression, а отдельный 1000-cycle запуск прошёл полностью.
