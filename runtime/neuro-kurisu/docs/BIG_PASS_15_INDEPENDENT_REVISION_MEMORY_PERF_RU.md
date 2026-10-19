# Neuro-Kurisu Evolution — BIG PASS 15
## Independent Revision Registry + Memory Retrieval Optimization + Long-Horizon Validation

Дата: 2026-09-05
Release contract: 34.2.0 / organismCore 70.0.0-master-prompt-progress-engine / state schema 83

## 1. Цель прохода

BIG PASS 15 продолжает только незакрытые пункты BIG PASS 14. В этом проходе не повторяется базовый scheduler/operational result plane/branch budget функционал без измеримого изменения.

Приоритеты:
1. довести RevisionTokenRegistry от общего domain counter к независимым subsystem counters;
2. связать независимые revision tokens с persistence round-trip;
3. снять оставшийся recurring allocation/CPU overhead в MemoryOS2 и MultiTimescaleMemory;
4. получить более устойчивый long-horizon результат на 250 циклах;
5. повторно проверить исторические, migration, security, architecture и forensic gates;
6. отдельно исследовать 500-cycle gate, но не считать timeout успешным результатом.

## 2. Реально внедрено

### 2.1 Independent RevisionTokenRegistry v2

`src/organism/persistence/RevisionTokenRegistry.ts` теперь хранит независимые counters для:
- memory-core
- memory-fabric
- identity-core
- reality-model
- development-core
- evidence-ledger
- critical-kernel
- slow-cognition

Каждая подсистема имеет `revision`, `materializedRevision`, `lastTick`, `lastMaterializedTick`, `lastCause`.

Coarse `RevisionGraph` сохранён как групповой projection journal. Registry больше не делит один counter между подсистемами, даже если они принадлежат одной projection domain.

Legacy states без `revisionTokens` получают безопасную seed-инициализацию от старого `RevisionGraph`.

### 2.2 Persistence round-trip

`revisionTokens` теперь типизированно присутствуют в `OrganismSystemState`, миграции сохраняют их, а `OrganismCore` восстанавливает их вместе с `revisionGraph`.

Regression test подтверждает, что после flush:
- `memory-core` и `memory-fabric` имеют независимые revision values;
- оба сохраняют materialized state;
- legacy coarse graph при этом остаётся корректным.

### 2.3 MemoryOS2: bounded encode candidate selection

`MemoryOS2.encode()` больше не строит и полностью не сортирует весь candidate pool.

Используется bounded scan первых 512 элементов с top-4 insertion.

Temporal/causal lookup ограничен 256 ближайшими bounded candidates.

### 2.4 MemoryOS2: cached semantic-link support

`retrieve()` теперь кеширует aggregate link-support и инвалидирует кеш по `linkUpdates`/реальному изменению memory graph.

Полный support-map больше не пересчитывается для каждого retrieval query, пока semantic links не изменились.

### 2.5 MultiTimescaleMemory: bounded top-K retrieval

`retrieve()` больше не создаёт полный объединённый массив и не сортирует его целиком.

Теперь четыре memory timescales обходятся по очереди и поддерживается bounded top-K buffer.

### 2.6 Forensic cleanup

Найден и устранён реальный duplicate-content между двумя BIG PASS 14 documents. Один файл оставлен подробным canonical report, второй — коротким historical index.

Итоговый forensic результат:
`duplicateContent=0`, `duplicateNames=0`, `empty=0`.

## 3. Измеримые результаты

### Projection

Naive advanced projection operations: 576.
Scheduled operations: 204.
Reduction: 64.6%.

### Persistence footprint

Текущий footprint regression:
`PERSISTENCE_FOOTPRINT=PASS total=2,359,927 bytes` в последнем прогонах близкого workload.

Branch budget:
`maxUtilization=0.762`, overBudget=0.

### 250-cycle warmed horizon

Последний подтверждённый результат:
`LONG_HORIZON_OPERATIONAL_250=PASS`

- warmed median ratio: 1.662x
- first median: 123.03 ms
- last median: 204.43 ms
- p95 approximation: 208.47 ms
- heap growth: 1.094x

Для сравнения с BIG PASS 14:
- ratio было 1.721x → стало 1.662x;
- sampled heap growth было 1.646x → стало 1.094x.

Это фактическое улучшение после MemoryOS2 и MultiTimescaleMemory optimizations, но оно не закрывает 500–1000 cycle validation полностью.

### 500-cycle

`tests/long-horizon-operational-500-warm.mjs` снова не завершился в execution window.

`tests/long-horizon-operational-500-natural.mjs` также не завершился в доступном окне.

Оба результата классифицируются как `TIMEOUT`, не `PASS`.

Отдельный профиль 120 cycles завершился:
- MemoryOS retrieve ≈ 0.329 ms/call;
- MultiTimescale retrieve ≈ 0.289 ms/call;
- SemanticMemory retrieve ≈ 0.040 ms/call;
- UnifiedMemory snapshot ≈ 0.013 ms/call;
- WorldModel snapshot ≈ 0.008 ms/call.

Следовательно, оставшийся long-horizon bottleneck больше не выглядит как один доминирующий memory retrieval hotspot.

## 4. Проверки

Подтверждено:
- TYPECHECK
- REVISION_TOKEN_REGISTRY
- REVISION_GRAPH_PERSISTENCE
- REVISION_AWARE_PROJECTION
- PERSISTENCE_PROJECTION_TIERING
- PERSISTENCE_PROJECTION_GOVERNOR
- PERSISTENCE_FOOTPRINT
- PERSISTENCE_BRANCH_BUDGET
- PERSISTENCE_BUDGET_FEEDBACK
- MEMORY_SUBSTRATE
- MEMORY_DEDUP
- CHECKPOINT_HOTPATH
- ADVANCED_PROJECTION_SCHEDULER
- PROJECTION_EFFICIENCY
- CLEAN_ORGANISM_SMOKE
- CLEAN_RESTART_PERSISTENCE
- P15.5_DEVICE_HARDENING
- P29_CORE_INTEGRATION
- P46 prediction ledger
- P47 temporal memory
- P48 functional awareness
- P49 temporal life
- P52 counterfactual development
- P54 long-horizon evidence
- P52 truthfulness
- P56/P57 persistence integration
- P74/P77 integration
- P80/P81/P82 runtime e2e
- concurrency
- replay
- portable subject boundary
- API security
- server security smoke
- 33/33 migration scripts
- historical shard audit: 152 test files / 164 script targets / 55 phases / 0 orphan / 0 missing
- API routes: 86 / duplicates 0
- source truth
- release contract
- architecture
- integrity
- forensics
- source hygiene
- analysis alignment: 42/42

## 5. Что ещё не закрыто

1. `RevisionTokenRegistry` уже независим по subsystem, но counters всё ещё обновляются из `OrganismCore`, а не из самих subsystem classes.
2. Полная physical consolidation MultiTimescaleMemory → MemoryOS2 ещё не завершена.
3. Adaptive branch compaction пока охватывает основные durable branches, но не абсолютно все advanced branches.
4. 500–1000 cycle validation в текущей среде не завершена.
5. Полный CPU/allocator/GC profile внутренних `OrganismCore` orchestration steps ещё нужен.
6. Реальная Android physical campaign остаётся отдельным незакрытым gate.
7. Repeated paired reality-validation campaigns остаются незакрытыми.
8. Thought-debt / DMN / circadian / incubation остаются частично реализованными.

## 6. Самокритическая проверка

В этом проходе исправлены не только production-код и тесты, но и мои собственные слабые места анализа:
- старый test expectation для общего memory counter был приведён к новому смыслу независимых subsystem counters;
- один тестовый подход был признан недостаточным до финального результата;
- timeout 500-cycle никогда не переименовывался в PASS;
- duplicate documentation был устранён вместо сокрытия forensic warning;
- self-audit расширен новыми требованиями и должен проходить вместе с release checks.

## 7. Оценка готовности

| Область | % |
|---|---:|
| Canonical architecture | 97 |
| Memory architecture | 96 |
| Persistence / recovery | 98 |
| Reality / provenance | 89 |
| Autonomy / development | 87 |
| Safety / HITL | 88 |
| Performance / mobile efficiency | 95 |
| Termux readiness | 83 |
| Android source/runtime | 77 |
| Реальное Android-устройство | 38 |
| Multimodal / semantic grounding | 74 |
| Long-horizon validation | 88 |
| Historical regression closure | 99 |
| Qwen recommendations | 77 |
| **Общая инженерная готовность** | **96%** |

Проценты — инженерная оценка зрелости проекта и качества доказательной базы, не измерение AGI/сознания.

## 8. Выполнение предыдущих рекомендаций

| Предыдущая рекомендация | Выполнение |
|---|---:|
| Independent revision counters | 100% на Registry layer; 76% по всей архитектуре |
| Unified memory substrate | 96% |
| Branch-level budgets | 98% |
| Snapshot / allocation efficiency | 94% |
| Long-horizon profiling | 82% |
| Android physical hardening | 38% |
| Thought-debt / DMN / circadian / incubation | 75% |
| Reality validation | 63% |
| Historical/statistical evidence | 96% |
| Self-audit собственных рекомендаций | 100% по 42 checks |

## 9. Следующий эффективный шаг

Следующий проход следует строить вокруг dependency-aware revision DAG, где subsystem tokens становятся источником dirty propagation, а не только журналом.

Параллельно нужен branch-cost controller с фактической стоимостью bytes + CPU + freshness, а не только bytes.

После этого — целевой allocator/GC profile 500 cycles и физический Android campaign.

Новые cognitive modules добавлять только при наличии доказуемого выигрыша по measured capability или safety.
