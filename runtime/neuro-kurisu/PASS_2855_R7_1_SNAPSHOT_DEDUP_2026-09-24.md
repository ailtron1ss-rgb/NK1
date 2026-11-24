# PASS_2855_R7.1 — Snapshot / Diagnostics Allocation Reduction

**Дата:** 2026-09-24
**База:** Neuro-Kurisu 35.26.0 / P2855 / R7
**Цель:** уменьшить реальную allocation/GC-нагрузку в горячих когнитивных путях без ослабления причинности, persistence-контрактов или R3–R6 архитектуры.

## Что реально изменено

### 1. NeuralExperienceBranch: удалены повторные snapshot-вызовы
`src/organism/cognition/NeuralExperienceBranch.ts`

`NeuralExperienceBranch.snapshot()` несколько раз снимал одни и те же подсистемы. Повторялись `stabilityPlasticity`, `causalPlanner`, `transferableSkills`, `hierarchicalSkills`, `taskAgnosticTransfer`, `riskRecovery`, `goalIdentityModulator`, `deviceScheduler`, `selfOptimizingMemory`, `developmentalController`, `activeInformationGain`, `evidenceLedger`, `learnedTransition`, `causalRegimeGraph` и `factorialAblation`.

Теперь каждый managed subsystem снапшотится ровно один раз за один branch snapshot. Финальный deep clone контракта сохранён.

### 2. NeuralExperienceBranch: diagnostics больше не клонирует состояние дважды
`diagnostics()` раньше выполнял:

1. `this.snapshot()` — уже синхронизировал подсистемы и создавал deep clone;
2. затем игнорировал этот результат;
3. затем ещё раз выполнял `deep(this.state)`.

Теперь `diagnostics()` использует результат одного `snapshot()` и добавляет только диагностические projections.

### 3. OrganismCore: устранены повторные NeuralExperience diagnostics в candidate hot path
Внутри action scoring один и тот же `NeuralExperienceBranch.diagnostics()` вызывался дважды подряд. Поскольку перед этим branch уже был синхронизирован в `persisted.system.neuralExperienceBranch`, scoring использует этот актуальный persisted projection вместо новых diagnostic clones.

### 4. OrganismCore: устранено повторное B421 diagnostic cloning в feedback path
`feedbackSpineOnly()` многократно запрашивал `B421B450ResearchAcceleration.diagnostics()` для одного и того же `last.context`. Теперь один diagnostic snapshot создаётся один раз и переиспользуется в пределах feedback batch. Аналогично `B501B560HierarchicalMetaMemory.diagnostics()` берётся один раз.

## Измерения до / после

### NeuralExperienceBranch.snapshot(), 30 вызовов
Одинаковый Node runtime, одинаковое initial state, одинаковый benchmark.

- R7 до этого pass: mean **7.3066 ms**, p50 **7.1937 ms**, p95 **9.0248 ms**.
- R7.1 после удаления повторных snapshot assignments: mean **7.0675 ms**, p50 **6.7719 ms**, p95 **8.2789 ms**.
- Среднее улучшилось примерно на **3.3%** в изолированном snapshot benchmark.
- JSON payload snapshot остался тем же: ~**190.06 KB**.

### NeuralExperienceBranch.diagnostics(), 40 вызовов
- До R7.1: mean **12.0689 ms**, p50 **11.8676 ms**, p95 **13.4277 ms**.
- После R7.1: mean **6.7577 ms**, p50 **6.6978 ms**, p95 **7.5191 ms**.
- Локальное снижение времени вызова: примерно **44%**.
- Средний payload остался ~**190.12 KB**.

### Полный 40-cycle mobile workload
Полный workload заметно шумнее изолированного benchmark. На одном A/B прогоне после всех изменений mean latency не показал статистически надёжного глобального выигрыша, поэтому этот pass **не объявляет** доказанное end-to-end ускорение по среднему cycle time только на основании одного прогона.

Один контрольный прогон после R7.1:
- mean **~168.0 ms/cycle**;
- p95 **~340.0 ms**;
- heap peak **~260.8 MB**;
- heap after forced GC **~67.3 MB**.

Это подтверждает отсутствие явного удержания нового heap, но не заменяет длинный endurance benchmark.

## Regression evidence

- `TYPECHECK=PASS mode=tsc`
- `test:p2855` = PASS
- `test:canonical-policy` = PASS
- `test:canonical-live` = PASS
- `test:self-agency` = PASS
- `test:r3:unified-latent-world` = PASS
- `test:r4:temporal-credit` = PASS
- `test:r5:memory-lifecycle` = PASS
- `test:r7:guards` = PASS
- R7 guards дополнительно фиксируют уникальность assignments в `NeuralExperienceBranch.snapshot()` и запрещают возврат к discarded-snapshot + second-deep-clone pattern в `diagnostics()`.

Сохранены значения ключевых причинных проверок R3–R6; self-agency integrity остаётся `1.0`, а R6 ablation delta остаётся `0.0765`.

## Что намеренно не заявляется

R7.1 не доказывает сознание, human-level intelligence или readiness для постоянного запуска на телефоне.

80-cycle endurance по-прежнему является stress target, а не PASS. Для решения этой задачи нужны повторяемые 80/120/240-cycle runs с одинаковым workload, holdout checks и измерением p50/p95/heap/GC/checkpoint/save.

## Следующий технический узел

Следующий наиболее ценный performance target остаётся **checkpoint clone amplification**, особенно вокруг `persisted.system.neuralExperienceBranch` и крупных advanced/system projections. Нужна отдельная A/B проверка с file-backed persistence, чтобы не оптимизировать только `MemoryStateStore` test harness и не ухудшить crash-recovery semantics.
