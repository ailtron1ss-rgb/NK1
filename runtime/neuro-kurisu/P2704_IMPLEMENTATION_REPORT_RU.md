# P2704 — итог реального апгрейда Neuro/Kurisu

Дата: 2026-09-20
Версия: 35.7.4
Core: 100.0.1-global-workspace-convergence-p2704

## 1. Что реально изменено в коде

### A. Durable shutdown / restart
`OrganismRuntime.stop()` перестроен как настоящая граница сохранности:
- останавливаются runtime clocks;
- дожидается очередь cognitive work;
- записывается runtime closure;
- выполняется один финальный `core.flush()`;
- сохраняется world state;
- только после этого закрывается continuity ledger.

Дополнительно исправлены два теста, которые вызывали async `stop()` без `await`. Это было реальным дефектом тестового контракта: временный каталог удалялся до завершения финального flush.

Результат: `CLEAN_RESTART_PERSISTENCE=PASS`.

### B. Contentful Global Workspace
P2703 больше не вычисляет action influence из длины имени source. Добавлен:
`candidate.actionBias → coalition weights → broadcastActionBias → workspace.actionBias → policy`.

Добавлен причинный тест, который меняет action-content выбранных кандидатов и требует изменения policy bias.

Результат: `test:p2703:global-workspace` PASS.

### C. Stability/plasticity experiment
В существующем sparse recurrent neural substrate threshold drift теперь зависит от уже накопленной `plasticity`:
- стабильные элементы дрейфуют слабее;
- пластичные элементы остаются более адаптивными;
- механизм локальный и bounded;
- новый neural subsystem не создавался.

Результат: `test:p2701:neural-temporal-substrate` PASS.

### D. Mobile consolidation pacing
Для `performanceProfile=mobile` accumulation window для adaptive consolidation увеличен до 48 циклов вместо 24. Это сделано потому, что полная projection/checkpoint дорогая по памяти/времени на телефоне.

Это оптимизация, а не отключение обучения: adaptive consolidation gate по-прежнему решает, запускать ли consolidation.

## 2. Объём реальной кодовой работы

По сравнению с исходным 35.7.3:
- 7 TS/MJS исходников/тестов получили реальные изменения;
- +95 строк, -23 строки в основных изменённых файлах;
- изменены release/version metadata и lockfile;
- добавлены research/evidence документы и source catalog.

Оценка распределения усилий этого прохода: **≈80–85% на реальный код/интеграцию/тесты**, остальное — исследование, аудит и упаковка.

## 3. Проверки

PASS:
- `test:restart`
- `test:p2703:global-workspace`
- `test:p2701:neural-temporal-substrate`
- `test:p2702:personality`
- `test:p22:phone`
- `test:smoke:mobile256`
- `server:smoke`
- `typecheck` (tsc)
- `audit:contract`
- `audit:integrity`
- `audit:architecture`
- `audit:hygiene`
- `audit:forensics`
- `audit:archive`

Дополнительно:
- parameterized function probe: 1069 passed / 1124 attempted, 0 failed; 45 требуют input synthesis, 10 lifecycle evidence, 40 skipped.
- semantic coverage в этом проходе не завершился в установленный timeout; поэтому рост verification score не заявляется.

## 4. Что осталось плохим / неполным

### Критический следующий блок: long-run memory/GC
80-cycle autonomy stress в текущем окружении остаётся слишком тяжёлым. Наблюдался рост heap и длительные GC/processing pauses примерно после 35–45 циклов. Это не маскируется под PASS.

Следующий проход должен найти конкретные allocation hotspots, прежде всего:
- полные snapshots/structuredClone;
- repeated subsystem snapshots;
- large checkpoint projections;
- replay/consolidation buffers;
- continuity/evidence accumulation.

### Verification
Semantic verification остаётся узким местом. Наличие 4926 функций при небольшом количестве доказанных behavioural executions — недостаточная база для заявления, что весь организм работает.

### Consciousness
Нет доказательства phenomenal consciousness. Workspace ignition, recurrence, self-model или continuity сами по себе таким доказательством не являются.

## 5. Новые исследования сохранены

`RESEARCH/2026-09-20/`

Сохранены BrainTrace/D-RTRL, TESS, SAFA-SNN, continual-learning reviews и adversarial consciousness research с тем, что именно из каждого направления имеет смысл переносить в наш проект.

## 6. Потенциальный прирост от связки методов

Нельзя складывать проценты отдельных статей. Для инженерного сценария, если одновременно сработают:
- durability,
- contentful workspace,
- stability/plasticity,
- eligibility credit assignment,
- selective replay,
- active information gain,
- world-model prediction,

то потенциальный эффект может быть **порядка десятков процентов на отдельных целевых метриках** (delayed credit, retention, policy stability, useful learning per compute). Сценарная модель с сильным overlap даёт примерно 34–57%, но это **не измерение Neuro/Kurisu** и не следует считать фактическим приростом.

## 7. Оценки после P2704

| Компонент | Оценка |
|---|---:|
| Runtime reliability | 8.5/10 |
| Persistence | 7.5/10 |
| Neural substrate | 6.1/10 |
| Global workspace | 6.2/10 |
| Personality | 6.8/10 |
| Continual learning | 6.6/10 |
| Autonomy | 5.5/10 |
| Continuous cognition | 6.5/10 |
| Embodiment | 5.5/10 |
| Mobile readiness | 5.9/10 |
| Maintainability | 3/10 |
| Behavioural verification | 1.5/10 |
| Evidence discipline | 8/10 |
| Evidence for phenomenal consciousness | 0–2/10 |

### Сводные инженерные оценки

- **Когнитивный substrate: ~63/100**
- **Цель unified autonomous artificial personality/organism: ~41/100**

Это инженерная зрелость текущей реализации, а не вероятность сознания.

## 8. Следующий большой блок

1. Memory/GC forensic profiling 35–100 cycles.
2. Canonical Experience Causal Ledger — один ID на experience/cycle.
3. Unified credit assignment: neural eligibility + workspace content + replay.
4. Selective replay with protected/stable traces.
5. Active-information policy linked directly to uncertainty reduction.
6. Learned world-model prediction and matched counterfactual tests.
7. Factorial ablation matrix.
8. Long-life 1k/10k cycle tests on mobile profile.
9. Только после этого — дальнейшее усложнение workspace/self/consciousness hypotheses.
