# Neuro-Kurisu 34.22.0 — BIG PASS 51
## Physical subsystem extraction: Self / Governance / Memory / World / Embodiment

### Цель прохода
Продолжить физическую декомпозицию после BIG PASS 50 без создания новых декоративных P-уровней. Главный критерий: один реальный шаг должен одновременно улучшать ownership, сопровождаемость, наблюдаемость и пригодность runtime для среднего Android/Termux.

### Реально внедрено

1. `SelfSubsystemRuntime` стал физическим владельцем identity/personhood/self-continuity engines: IdentityContinuity, SelfAuthorship, P31, P32, P33, P34, P60, P71, P76, P78, P80.
2. `GovernanceSubsystemRuntime` стал физическим владельцем capability/integrity/replay/resilience/constitutional lifecycle engines: CapabilityRegistry, IntegritySentinel, ReplayEngine, AdvancedResilience, P69, P72, P73 и SelfGovernance.
3. `MemorySubsystemRuntime` стал физическим владельцем event/memory substrate и крупных memory-layer engines: EventLog, MultiTimescaleMemory, AutobiographicalMemory, SelfModel, SocialWorldModel, ValuePlasticity, RecurrentWorkspace, SemanticMemoryGraph, MemoryOS2, MemorySubstrateCoordinator, UnifiedMemory, P47, P59, P62, P65, P70, P75.
4. `WorldSubsystemRuntime` стал физическим владельцем world/prediction/reality engines: WorldModel, ActiveInference, LearnedResidualWorldModel, ContextualWorldModel, WorldModel2, P24, P27, P44, P50, P51, P52, P57, P79.
5. `EmbodimentSubsystemRuntime` стал физическим владельцем perception/embodiment engines: MultimodalPerception, PerceptionEngine, P35, P37, P40 semantic, P41 semantic/native/temporal, P42, P43.
6. `CognitiveSubsystemRegistry` теперь считает все семь доменов физическими runtime owners.
7. `SubsystemFlightRecorder` добавлен как bounded диагностический слой: calls, failures, latency и последние probe-записи по subsystem. Flight Recorder не сохраняется в identity/persistent memory.
8. `CognitiveExecutionPlanner` расширен `CognitiveOrganismMetabolism`: для каждого домена вычисляются priority, budget share, estimated load и active state; решение planner теперь учитывает не только стоимость операции, но и стоимость/приоритет органа.
9. Добавлены snapshot accessors для Self/Governance и диагностика Flight Recorder через core/server API.
10. Ownership audit расширен на все семь physical domains и проверяет отсутствие прямых `new Engine()` в OrganismCore для перемещённых классов.
11. Release/version/source-of-truth синхронизирован на `34.22.0`.
12. BIG PASS 51 regression alias зарегистрирован в npm.

### Важное исправление методологии
В предоставленном архиве 34.21.0 физические owner-классы Memory/World/Embodiment отсутствовали, хотя в текстовом отчёте прошлого чата они были заявлены. Этот проход не переносит это заявление как факт: ownership реализован заново и проверен статическим audit + runtime smoke.

### Что это даёт

Раньше большая часть этих engines создавалась в `OrganismCore`. Теперь Core остаётся координатором, а lifecycle/ownership принадлежат отдельным runtime organs. Это снижает связность и создаёт безопасную основу для следующего шага: выносить persistence/restore/ports из Core и заменять отдельные heuristic engines обучаемыми backend-ами без переписывания всего организма.

### Проверки

- TYPECHECK=PASS
- CORE_OWNERSHIP=PASS
- CLEAN_ARCHITECTURE=PASS
- BIG_PASS_51_PHYSICAL_OWNERSHIP=PASS
- BIG_PASS_49_SUBSYSTEM_RUNTIME=PASS
- BIG_PASS_50_COGNITIVE_EXECUTION=PASS
- CLEAN_ORGANISM_SMOKE=PASS
- CLEAN_RESTART_PERSISTENCE=PASS
- MEMORY_DEDUP=PASS

### Scientific honesty
Этот проход не утверждает сознание, human equivalence, learned general world model или полноценную semantic vision. Physical ownership — инженерное свойство архитектуры; оно не является доказательством качества когнитивных представлений.
