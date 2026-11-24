# P2836 Implementation Report

## 1. Проблема до P2836

До изменения runtime формально выполнял два разных действия: внутренний `WorldEnvironment.step()` создавал transition, после чего embodied action исполнялся. Однако основной `core.feedback()` и значительная часть learning/temporal closure использовали simulation transition до физического действия. Это создавало риск, что simulator outcome будет фактически главнее real device evidence.

## 2. Новая топология

### Prediction branch

`OrganismCore → PlanEngine → WorldEnvironment(project/step) → counterfactuals`

Эта ветка теперь рассматривается как predictive/shadow branch.

### Reality branch

`decision → EmbodiedRecoveryController → EmbodiedActionExecutor → Android/Termux → consequence verification`

### Arbitration

`RealityGroundingController`

выбирает:

- `external`, когда device action действительно выполнен и имеет поддерживаемый reality class;
- `simulation`, когда external outcome unavailable/failed или режим `simulation-only`.

### Learning branch

`grounded reward/consequence → Core.feedback → B365 transition learning → B365 embodied consequence learning → B380 temporal life → ContinuousCognitiveFabric`.

### Audit branch

`before neural diagnostics → learning → after neural diagnostics → NeuralCausalTraceLedger`.

## 3. Почему это лучше

Главное изменение не в количестве строк кода, а в отношении к evidence:

`simulated transition` больше нельзя автоматически интерпретировать как `real-world outcome`.

Это соответствует общей тенденции embodied AI: world model должен предсказывать и планировать, а physical/real interaction должна давать отдельную grounded evidence stream. V-JEPA 2 строит world model для understanding/prediction/planning и демонстрирует переход от self-supervised video learning к robot interaction. См. `research/2026-09-20/P2836/RESEARCH_SOURCES_2026-09-20.md`.

## 4. Neural causal ledger

Ledger измеряет изменения:

- prediction error;
- plasticity;
- recurrent coherence;
- neural confidence;
- grounding reliability;
- learning update count;
- replay update count.

Но итоговая запись помечена `ablationRequired=true`. Это сознательная защита от ложного вывода `correlation = causation`.

## 5. Fast/slow replay thermostat

Новый P2820 слой вводит четыре состояния:

- `surpriseMemory01` — долгоживущая оценка неожиданности;
- `fastMemoryMass01` — текущая потребность в быстрой адаптации;
- `slowTeacherDrift01` — изменение slow teacher policy;
- `replayThermostat01` — bounded регулятор replay/distillation.

Он влияет на replay budget и distillation scale, но не ломает старый P2820 API.

## 6. Mobile rationale

Мы сознательно не добавляли большой video foundation model прямо в Termux runtime. На среднем телефоне это увеличило бы latency/memory footprint и сделало бы hotpath менее предсказуемым. Вместо этого P2836 использует архитектурную идею fast/slow memory и surprise-driven allocation в компактном stateful controller.

## 7. Remaining work

1. Настоящее Android-device certification.
2. Независимая проверка эффектов `respond`/TTS.
3. Vision-semantic bridge с реальным camera encoder.
4. Neural lesion/ablation matrix.
5. Long-horizon real-world benchmark.


### Примечание по reward
`reward01` внешнего контура намеренно является консервативным grounded execution/evidence сигналом, а не утверждением о task-success. Receipt-only действие не получает высокий learning reward без независимого подтверждения consequence.
