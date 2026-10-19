# P2706 — синтез взаимодействия исследовательских направлений

## 1. Главный вывод

Исследования нельзя складывать как независимые «фичи». Для Neuro/Kurisu они образуют цепочку взаимного усиления:

`local eligibility → online credit → stability/plasticity gate → selective replay → predictive/world-model residual → active information gain → causal evidence → developmental update`.

Поэтому следующий шаг должен усиливать **связи между механизмами**, а не создавать ещё один neural owner.

## 2. Карта взаимодействия

| Направление | Что даёт | С чем усиливается | Главный риск |
|---|---|---|---|
| BrainTrace-like linear online credit | delayed credit без хранения всей истории градиента | existing eligibility + predictive residual | неверный credit signal |
| TESS-like local temporal learning | локальность и edge/mobile efficiency | eligibility + sparse recurrence | локальное правило может быть слишком слабым |
| SAFA-like stability/plasticity | защита выученного + окно адаптации | homeostasis + replay | слишком сильная стабильность блокирует обучение |
| Selective replay | повторное закрепление редких/важных событий | credit + long memory | replay bias / overfitting |
| World-model residual | дополнительный сигнал ошибки перехода | online credit | residual не равен causal reward |
| Active information gain | выбор опыта, уменьшающего uncertainty | world model + credit | exploration cost |
| Global workspace | ограничивает конкурирующие сигналы | neural + memory + goal | broadcast нельзя считать consciousness proof |
| Causal ablation | проверяет реальный вклад | все подсистемы | false attribution без matched controls |
| Mobile governor | делает всё это исполнимым | sleep/replay/consolidation | чрезмерная экономия вычислений |

## 3. Наиболее полезная композиция

### Контур A — обучение

1. Событие формирует локальные eligibility traces.
2. Outcome приходит позже.
3. Online-credit слой объединяет outcome error, latent transition residual и verification.
4. Stability/plasticity gate регулирует, насколько сильно изменять устойчивые и пластичные связи.
5. Replay повторно предъявляет редкие и временно разнообразные события.
6. Homeostasis не даёт replay/credit разогнать firing regime.

Это лучше, чем отдельное внедрение каждого метода, потому что механизмы закрывают разные failure modes.

### Контур B — познание

`uncertainty → information gain → action → world consequence → prediction residual → credit → memory → future policy`.

Здесь active information gain перестаёт быть просто action bias и становится источником **обучающего опыта**.

### Контур C — субъектность

`persistent personality + self/identity + workspace + autobiographical memory + longitudinal evidence`.

Workspace должен быть маршрутизатором ограниченного вычислительного ресурса, а не доказательством сознания. Это согласуется с adversarial consciousness literature.

## 4. Что уже реально объединено в P2705/P2706

- bounded eligibility traces;
- homeostatic synaptic scaling;
- plasticity-dependent threshold adaptation;
- temporally diverse replay;
- mobile heap-pressure maintenance;
- P2706 online credit synthesis через уже существующие traces;
- ablation switch `onlineCreditMix01` для baseline-vs-synthesis эксперимента;
- diagnostics: baseline signal, model residual, agreement, trace norm.

P2706 не создаёт второй neural subsystem: он меняет **правило доставки credit в существующий substrate**.

## 5. Первое измерение P2706

На matched 64-cycle run:

- baseline `onlineCreditMix01=0`;
- synthesis `onlineCreditMix01=0.65`;
- weight trajectory L1 difference: `1.51716`;
- final credit baseline EMA: `0.1895`;
- model residual EMA: `0.1515`;
- baseline/synthesis signal agreement: `0.8140`;
- trace norm EMA: `0.0303`.

Это доказывает только то, что новый rule **каузально изменяет trajectory обучения и остаётся численно стабильным**. Это не доказывает, что он лучше baseline по capability.

## 6. Следующий обязательный эксперимент

Не выбирать метод по архитектурной привлекательности. Нужен matched factorial benchmark:

- A: baseline credit;
- B: online credit;
- C: online credit + homeostasis;
- D: online credit + replay;
- E: online credit + homeostasis + replay;
- F: full synthesis + information gain/world model.

Для каждого варианта:
- одинаковые seeds;
- одинаковые события;
- delayed reward;
- unseen holdout;
- restart;
- 80/200/500-cycle runs;
- heap/latency;
- retention/forgetting;
- transfer;
- causal lesion.

Главная метрика — не composite score, а delta относительно baseline по каждой capability.

## 7. Что НЕ объединять физически

Не сливать в один класс:
- world model;
- personality;
- workspace;
- memory owners;
- causal experiment scheduler.

Объединять следует через contracts/event spine/credit signals. Это сохраняет ownership и уменьшает архитектурную инфляцию.

## 8. Научная граница

Синтез нескольких computational mechanisms не означает появления субъективного опыта. Для consciousness-ветки нужны theory-neutral predictions, negative controls, ablations и longitudinal reproducibility.
