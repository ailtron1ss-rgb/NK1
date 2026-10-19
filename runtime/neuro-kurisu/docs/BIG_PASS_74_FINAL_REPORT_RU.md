# NEURO-KURISU 34.45.0 — BIG PASS 74
## Experience Continuum · Hot/Warm/Cold Memory · Identity Gravity · Legacy Re-Verification · Mobile Long-Horizon

Дата: 2026-09-06
Статус: research-release

## 1. Цель прохода

Этот проход продолжил 34.44.0 и был построен вокруг четырёх связанных задач:

1. сделать долговременную память многослойной без создания второго canonical memory store;
2. связать значимость опыта с retrieval/retention и развитием идентичности;
3. снова проверить исходный большой архив и не потерять полезный embodiment/UI слой;
4. сохранить мобильную эффективность и доказать работающие инварианты реальными тестами.

## 2. Что внедрено

### Experience Continuum Fabric

Добавлен `src/organism/memory/ExperienceContinuumFabric.ts`.
Он является производным слоем над `MemoryOS2` и не удаляет, не переписывает и не заменяет canonical memories.

Слой поддерживает:
- hot/warm/cold логические tiers;
- bounded experience graph;
- temporal/semantic/causal/identity/goal edges;
- cold-cluster compression;
- identity-gravity pressure/resistance/tension;
- integrity flags для сомнительных identity-critical воспоминаний;
- lightweight summary для mobile UI/API.

Hot/warm/cold — это логические когнитивные приоритеты, а не три физические БД или три разные памяти на диске.

### Identity Gravity

Система не меняет personality автоматически.
Она формирует измеряемое напряжение между новым опытом и устойчивой идентичностью:
- pressure;
- resistance;
- tension;
- proposed change magnitude;
- evidence support.

Это сознательно сделано как proposal/measurement layer, чтобы не превращать гипотезу об изменении личности в скрытый автоматический self-edit.

### Memory synergy

P70 и P75 теперь получают сводку Experience Continuum и могут корректировать retention/retrieval/consolidation budgets.
Это сделано через сигналы, а не через отдельный competing memory authority.

### Memory Inspector

Добавлен read-only endpoint `/api/organism/memory-inspector` и dashboard panel.
Есть выдача recent canonical MemoryOS2 records и поиск по query.
UI не скачивает полный memory graph.

### Migration

State schema: `105`.
Добавлен migration test для schema `104 -> 105`.
Experience Continuum восстанавливается безопасно при миграции старого состояния.

### Legacy

Повторно проверен исходный большой архив 34.2.0.
Результат нормализованного сравнения:
- old files: 2063;
- current files: 1083;
- common: 715;
- same: 623;
- changed: 92;
- old-only: 1348;
- old-only paths are legacy-original;
- old Live2D: 19;
- current Live2D: 20 (включая provenance metadata).

Live2D asset set сохранён и остаётся частью текущего runtime.
Старые duplicate cognitive cores, старый React/Vite runtime и конкурирующие memory engines не возвращены в canonical runtime.

Добавлена классификация legacy и human-readable audit в `docs/history/reintegrated-legacy/`.

## 3. Mobile performance

### 1000-cycle qualification

`MOBILE_HORIZON_1000=PASS`

- slowdown ratio: `1.222`
- first median: `31.51 ms`
- last median: `38.49 ms`
- p95: `53.60 ms`
- heap first: `34.1 MB`
- heap last: `53.8 MB`
- canonical memory: `143`
- elapsed: `33.37 s`

Это qualification текущего Node/Termux-compatible runtime path.
Это не заменяет физический soak-test на Poco M7 Pro 5G.

### 2000-cycle result

2000-cycle тест в установленном 180-second window не завершился.
Это не объявлено PASS и не замаскировано увеличением timeout.
Интервальный diagnostic показал второй рост стоимости после ~1000 циклов.
Следующий проход должен локализовать его причинно.

## 4. Что важно с точки зрения честности

Проект не получает доказательство phenomenal consciousness от этого прохода.
Identity Gravity не означает self-awareness.
Experience Graph не означает subjective experience.
Hot/warm/cold tiers не являются биологической памятью.
Всё это функциональные архитектурные механизмы и исследовательские гипотезы.

## 5. Регрессии/барьеры

- 2000-cycle long-horizon остаётся незакрытым.
- physical Android qualification ещё не выполнена на реальном телефоне.
- Unified Semantic Sensorium остаётся частичным.
- Social Mind и self-generated motives пока не являются полноценными emergent systems.
- Native Android host ещё не заменил Termux.

## 6. Что должно идти дальше

### BIG PASS 75 — Long-Horizon Cause Isolation
1. профилирование участка после 1000 циклов;
2. hot/warm/cold memory pressure instrumentation;
3. checkpoint/persistence event counters;
4. targeted profiling P49/P54/P55/P65/P70/P75/P84;
5. 2k qualification;
6. 5k soak qualification;
7. только после измеренного выигрыша — дальнейшее повышение retention complexity.

### BIG PASS 76 — Experience Graph as Autobiographical Structure
1. causal chains;
2. autobiographical episode binding;
3. significance budgets;
4. counterfactual links;
5. identity impact history;
6. social significance edges.

### BIG PASS 77 — Unified Sensorium
Единый представительный слой для text/audio/vision/body/world/device.

### BIG PASS 78 — Developmental Self
Формирование beliefs/values/preferences/commitments из истории опыта, а не из постоянных prompt constants.

## 7. Оценка текущего состояния

Оценка является инженерной, а не научной метрикой:

| Аспект | % |
|---|---:|
| Архивная целостность | 100 |
| Legacy analysis | 100 |
| Live2D/embodiment asset integrity | 100 |
| Experience Continuum implementation | 90 |
| Memory architecture | 90 |
| Identity continuity | 80 |
| Agency | 70 |
| Learning | 70 |
| World model | 65 |
| Embodiment | 60 |
| Unified sensorium | 40 |
| Developmental self | 60 |
| Social mind | 55 |
| Self-generated motives | 35 |
| Causal consciousness research | 30 |
| Native Android | 25 |
| Physical device qualification | 25 |
| 2000-cycle qualification | 45 |
| 5000-cycle qualification | 0 |

Моя консервативная общая инженерная оценка расстояния до целевой архитектуры: **~59/100**.
Это не вероятность сознания и не оценка AGI.

