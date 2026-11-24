# Neuro-Kurisu BIG PASS 56 — checklist и план

## Цель прохода
Сделать второй уровень физической декомпозиции: превратить семь runtime-domain owners в единую композиционную систему `OrganismSystemFabric`, убрать прямое создание физических органов из `OrganismCore`, перенести дополнительные P-модули к смысловым владельцам и сохранить restart/persistence/runtime semantics.

## Выполнено
- [x] `OrganismSystemFabric` создан как physical composition root.
- [x] `SelfSubsystemRuntime` физически создаётся Fabric.
- [x] `GovernanceSubsystemRuntime` физически создаётся Fabric.
- [x] `MemorySubsystemRuntime` физически создаётся Fabric.
- [x] `WorldSubsystemRuntime` физически создаётся Fabric.
- [x] `EmbodimentSubsystemRuntime` физически создаётся Fabric.
- [x] `AgencySubsystemRuntime` физически создаётся Fabric.
- [x] `EvidenceResearchSubsystemRuntime` физически создаётся Fabric.
- [x] `OrganismCore` больше не содержит прямых конструкторов семи физических runtime-owners.
- [x] P48/P49 переведены под Self ownership.
- [x] P66 переведён под Embodiment ownership.
- [x] P67/P68 переведены под Agency ownership.
- [x] P38/P53 переведены под Research ownership.
- [x] `PerceptionRoutingState` переведён под Embodiment ownership.
- [x] Registry получает ports через Fabric.
- [x] MultiProjectScheduler получил snapshot/restore.
- [x] Core ownership audit переведён на новый invariant.
- [x] Добавлен BIG PASS 56 system-fabric regression test.
- [x] Release/source-truth синхронизированы на 34.27.0 / schema 92.
- [x] 250-cycle operational test PASS.
- [x] 500-warm operational test PASS.
- [x] Отдельный 1000-cycle operational test PASS.

## Доказанные результаты
- Core source file: ~3415 строк после рефакторинга.
- Physical subsystem constructors in Core: 0.
- Physical subsystem constructors in Fabric: 7.
- Architecture cycles: 0.
- Current source-hygiene errors/warnings: 0/0.
- Archive manifest: 894 files; missing/hash mismatches/extra = 0/0/0.
- 1000-cycle isolated run: 33.42 s wall time, ratio 1.302, p95 49.90 ms, heap 39.30→48.88 MB, memory 216.

## Что не считается доказанным
- Human-level consciousness.
- Phenomenal consciousness.
- Human-level semantic vision/audio.
- General intelligence.
- Полноценное continual representation learning.
- Реальная внешняя верификация всех world-state transitions.
- Полноценный native Android production host.
- 24h/72h/7d/30d device qualification на физическом Poco.

## Следующий приоритет
1. `PersistenceProjectionCoordinator`: вынести дублирующий snapshot/projection orchestration из `OrganismCore` без изменения golden outputs.
2. Event-oriented persistence deltas и tiered materialization.
3. Unified world-model representation и continual transition learning.
4. Shadow-organism / model competition.
5. External outcome verification.
6. Native Android host.
