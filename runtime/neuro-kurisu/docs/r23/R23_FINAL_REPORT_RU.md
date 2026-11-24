# Neuro-Kurisu R23 — Memory Regret / Multi-Step World / Recurrent Ablation

## Статус

R23 — инженерный research-release поверх R22. Цель прохода: перевести ещё три ранее частично описанных механизма в реально исполняемые и проверяемые контуры.

## Реально внедрено

### 1. MemoryOS2: реальный byte-budget enforcement

`MemoryOS2` поднят до внутреннего state-version 6.

Добавлены:
- `byteBudget` и фактический контроль `estimatedBytes`;
- принудительное вытеснение кандидатов при превышении бюджета;
- защита identity/autobiographical/quarantined памяти;
- ценность, вред и net-value-per-byte для выбора жертвы;
- `MemoryEvictionWitness` для каждого реального вытеснения;
- наблюдение последующих запросов и `budgetMisses` / `meanEvictionRegret01`;
- backward-compatible restore старых snapshots.

Ключевое отличие от R22: это теперь не только ранжирование стоимости памяти, а действие над фактическим memory store.

### 2. MemoryFabric: каноническое подключение бюджета

`MemoryFabric.maintain()` теперь вызывает `MemoryOS2.enforceByteBudget()` и возвращает фактически выполненные byte-budget eviction. Событие `memory-lifecycle` содержит размер бюджета, объём памяти и число реальных вытеснений.

### 3. B261: многошаговое действие

`B261UnifiedWorldModel` поднят до state-version 3.

Добавлены:
- `planSequence()` — rollout до 8 действий;
- `bestPlan()` — выбор из bounded набора последовательностей;
- `sequenceActionabilityBenchmark()` — held-out benchmark по многим шагам;
- накопительные метрики `sequenceRegret01` и `counterfactualActionGap01`;
- новые публичные методы `OrganismCore` для запуска этих операций.

Результат P2903 на held-out 16 состояниях:
- model regret = `0.03266`;
- baseline regret = `0.04972`;
- uplift = `0.3430`;
- action hit rate = `0.75`.

Это внутренний инженерный benchmark на контролируемой поверхности, а не доказательство компетентности во внешнем мире.

### 4. Runtime semantic evidence

Буфер operation-level evidence расширен до 256 последних записей.

В каждый полный `observe()` добавлены 12 реально закрываемых operation evidence записей для:
- goal ecology;
- autonomous learning memory;
- self-directed life;
- autonomous runtime;
- relationships;
- skill acquisition;
- social initiative;
- neuro-digital fusion;
- memory lifecycle;
- experience continuum;
- governed decision selection;
- canonical memory byte budget.

Отдельно сохраняется R22 instrumentation для world prediction, action selection, retention, B261 training и unified learning.

### 5. Bounded recurrent / SSM-style ablation lane

Добавлен отдельный `BoundedRecurrentStateSubstrate` с:
- bounded tanh recurrence;
- фиксированным размером состояния;
- детерминированными весами;
- reset/restore;
- оценкой saturation, energy и boundedness.

Он намеренно не является скрытой заменой canonical decision path. Это отдельная экспериментальная ветка, которую можно использовать для ablation и сравнения.

P2906:
- 512 шагов;
- saturation = `0`;
- boundedness = `1`;
- reset = `1`;
- finite state на каждом шаге.

### 6. Long-memory experience battery

Добавлен компактный внутренний battery, вдохновлённый задачами long-term experience memory: static state, dynamic update, workflow, environment gotcha, premise awareness.

P2905: `5/5` query families retrieved with expected semantic markers (`score = 1.0`). Это внутренний battery, а не сертификация по внешнему датасету.

### 7. 1000-cycle endurance

Добавлен отдельный тест `r23-1000-cycle-endurance.mjs` для 1000 operational cycles. Он проверяет:
- продвижение tick;
- конечность измерений;
- bounded slowdown;
- количество накопленного operation evidence.

Важно: этот test не является сертификацией реального Android/Termux устройства. Реальная device endurance остаётся отдельным этапом.

## Anti-decoration / truth boundary

R23 сохраняет принцип: экспериментальный или synthetic контур не поднимается в proof-канал автоматически. Recurrent lane не влияет на canonical decisions без явного вызова. Byte-budget witness относится к реальным memory-store операциям.

## Ограничения

1. `meanEvictionRegret01` R23 — это observed post-eviction witness, а не полный causal A/B regret с параллельным retained control. Для такого causal regret нужен R24.
2. Multi-step benchmark пока ограничен небольшими bounded sequence length и контролируемой synthetic task surface.
3. Long-memory battery компактный; он не заменяет LongMemEval-V2 или реальный user-history benchmark.
4. 1000-cycle test не равен 1000+ циклам на физическом Android устройстве.
5. Широкая static semantic coverage остаётся существенно ниже runtime evidence coverage и не была искусственно завышена.

## Релиз

Application: `35.37.0`
Core: `100.29.0-r23-memory-regret-multistep-recurrent`
State schema: `221`
Phase: `Stage-122/R23-Memory-Regret-MultiStep-Recurrent`
