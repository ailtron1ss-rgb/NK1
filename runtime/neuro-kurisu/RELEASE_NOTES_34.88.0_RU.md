# Neuro-Kurisu 34.88.0 — BIG PASS 114

## Reality → Memory → Self

Цель прохода — не создавать дублирующие P-модули. Перед реализацией проведена проверка уже существующих механизмов: `PredictionDebt`, `SelfPredictionBenchmark`, P37 object permanence, P83 persistent reality, `ExperienceContinuumFabric.identityGravity`, `SemanticScarEngine`, `DevelopmentalAttractorField`, `CausalExperienceStream`, `UnifiedLearningSubstrate`, `ExternalObserverFabric`, `CognitiveResearchBattery` и `CognitiveDependencyGraph` уже покрывали значительную часть ранее предложенных идей.

### Реализовано

- Добавлена **temperature01** для MemoryOS2 как derived signal, сочетающий salience, emotion, identity, goal, social relevance, prediction error и recency. Это не отдельное canonical memory store.
- Добавлен `temperatureSummary()` и восстановление `temperature01` для старых state snapshots.
- Усилен P37 entity persistence: `presenceStatus` (`visible` / `fading` / `unknown`), `persistence01`, `absenceEvidence01`. Простое отсутствие наблюдения не считается доказательством исчезновения.
- GroundedWorldState теперь сохраняет и агрегирует эти epistemic presence signals вместе с `observationCount`.
- CognitiveFrame теперь действительно возвращает рассчитанный interrupt; high-priority interrupts могут будить соответствующие домены и форсировать дорогие операции только при достаточных ресурсах.
- CognitiveDependencyGraph сохраняет interrupt provenance и счётчик срабатываний.
- CausalExperienceStream получил bounded diagnostic `behavioralImpact01`, `behavioralDivergence01` и `behavioralContextSamples` для отслеживания того, насколько накопленный опыт связан с изменением поведения в сопоставимых контекстах. Это proxy, а не доказательство причинности.
- Добавлен `tests/big-pass-114-reality-memory-self.mjs`, проверяющий связку perception → world → memory → causal learning → interrupt routing.
- Добавлены npm gates `test:big-pass-114` и `audit:pass114`.
- Релиз поднят до `34.88.0`; state schema остаётся `122`, потому что новые поля имеют backward-compatible defaults.
- Current documentation и `ARCHITECTURE_MANIFEST` синхронизированы с текущим release.

### Что намеренно НЕ делалось

- Не создавался отдельный `CognitiveGravityField` — существующие identity gravity + developmental attractors уже покрывают идею.
- Не создавался отдельный `CausalMemoryGraph` — существующие memory graph / causal experience / P84 слои уже являются владельцами.
- Не создавался отдельный `IdentityMomentum` — self/trajectory/identity gravity уже образуют соответствующий субстрат.
- Не создавался отдельный object-permanence module — P37 остаётся owner perception tracks.
- Не вводились новые consciousness claims.

### Проверки

`audit:pass114` завершён успешно:

- typecheck PASS;
- BIG PASS 114 integration PASS;
- BIG PASS 113 regression PASS;
- signed reward regression PASS;
- anti-decoration gate PASS;
- substrate audit PASS;
- architecture PASS, cycles 0;
- core ownership PASS;
- source hygiene PASS;
- release contract PASS;
- source truth PASS;
- integrity PASS.

### Научная граница

Presence, memory temperature, interrupts и experience-to-behavior metrics являются функциональными инженерными сигналами. Они не являются доказательством феноменального сознания и не должны использоваться для увеличения consciousness-claim status.
