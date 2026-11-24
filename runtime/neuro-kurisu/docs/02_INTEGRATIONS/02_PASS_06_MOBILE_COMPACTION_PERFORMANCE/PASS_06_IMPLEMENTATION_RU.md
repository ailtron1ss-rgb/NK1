# PASS 06 — Mobile State Compaction / Runtime Hotspot Control

Дата: 2026-09-26

## Цель

Следующий проход был направлен не на добавление декоративных модулей, а на устранение реально найденного runtime bottleneck в мобильном профиле.

Profiling полного `OrganismRuntime` показал существенную нагрузку в `B301MobileStateEconomy.compact()`: перед уплотнением выполнялся полный `JSON.stringify()` всего persisted organism state. На длинных циклах это становилось одной из заметных причин роста wall-time и allocation pressure.

## Реальное изменение

### B301 cadence-aware compaction

`src/organism/system/B301MobileStateEconomy.ts` теперь:

- проверяет, действительно ли существуют массивы выше ограничений;
- не сериализует весь organism state на каждом цикле;
- при нормальной нагрузке выполняет дорогую compaction-проверку с bounded cadence — каждые 8 циклов;
- немедленно выполняет compaction при high RAM/thermal pressure;
- немедленно выполняет compaction, если history сильно вышла за лимит;
- поддерживает явный `forceCompaction`;
- сохраняет прежние limits и защиту canonical neural/personality branches.

`OrganismCore` передаёт в B301 текущий tick и force-condition на основе фактического RAM/thermal pressure.

Это оптимизация частоты дорогостоящей операции, а не ослабление limits: сами limits для persistent history не изменены.

## Проверка

`TYPECHECK=PASS`

`R7_PERFORMANCE_GUARDS=PASS`

Дополнительно проверено:

- clean fast path не выполняет compaction;
- deferred path на промежуточном цикле действительно пропускает дорогую сериализацию;
- scheduled cycle выполняет compaction;
- high-pressure override остаётся доступен;
- B301 restart/migration остаются PASS.

P2862/P2862 persistence/P2862 dream-replay-identity и P2864 runtime-performance governor остаются PASS.

## Профилирование и открытая граница

Проверка 8 real `OrganismRuntime` cycles выявила заметные участки стоимости в:

- `OrganismCore.observe()`;
- B301 state byte sizing;
- `OrganismCore.feedback()`;
- `NeuralExperienceBranch.afterOutcome()`;
- `WorldModel2.prunePending()`;
- `WorldModelEnsembleController.pruneTickets()`.

Попытка полного `OrganismRuntime` 100-cycle endurance после PASS 06 всё ещё не укладывается в выделенный execution budget. Поэтому **full-runtime 100/500/1000-cycle PASS не объявляется**.

Это намеренно оставлено как открытая инженерная задача. Existing compact/stateful endurance gates остаются действующими.

## Native acceleration

Отдельный portable vector accelerator был испытан через equivalence/microbenchmark, но на текущем Node/V8 hot path оказался медленнее reference loop. Неподтверждённый backend не включён в release.

Следовательно, PASS 06 **не заявляет наличие native NEON/SIMD/NNAPI acceleration**.

## Следующий блок

1. устранение остальных реальных hot spots `feedback/afterOutcome/prunePending`;
2. снижение full-runtime allocation pressure без потери causal state;
3. native backend только после фактического target-device benchmark;
4. 100-cycle runtime gate с реальным state-growth evidence;
5. после этого — 500/1000-cycle endurance.
