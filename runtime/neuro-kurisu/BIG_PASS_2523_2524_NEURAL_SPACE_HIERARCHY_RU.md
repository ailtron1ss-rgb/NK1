# BIG PASS P2523–P2524 — NEURAL SPACE CONTRACT + HIERARCHICAL SPARSE MICRO-CIRCUIT

Дата: 2026-09-17
База: 35.6.61 / B2522
Новая инженерная версия: **35.6.62 / P2523–P2524**

## 1. Задача прохода

Следующий шаг после B2522 — не добавлять ещё один независимый cognitive manager, а укрепить единую neural branch как измеримый вычислительный substrate.

В этом проходе реализованы четыре связанные вещи:

1. формальный Neural Space Contract;
2. 8-area hierarchical routing;
3. явное E/I разделение с lateral competition;
4. реальный sparse edge graph с bounded synaptic delays.

Дополнительно добавлено обучение prediction readout и отдельный distribution-shift benchmark, чтобы не выдавать синтетический holdout за настоящее обобщение.

## 2. P2523 — Neural Space Contract

Новый файл:

`src/organism/cognition/NeuralSpaceContract.ts`

Канонические размеры:

- input = 64;
- pressure = 6;
- actions = 7;
- contract version = 1.

Граница нормализует значения и проверяет размерность до neural dynamics.

Цель: убрать скрытые несовместимости между B269/B2515/B2521 и neural branch. Любое дальнейшее расширение latent space должно проходить через явный контракт.

## 3. P2524 — hierarchical neural micro-circuit

Вместо только условного поля `areas` теперь состояние явно содержит:

- `populationKinds` — E/I population labels;
- `areaOf` — принадлежность каждого нейрона к одному из 8 areas;
- `edgeTargets` — 12 bounded outgoing/input edges на нейрон;
- `edgeWeights` — веса этих edges;
- `edgeDelays` — дискретные задержки 1–3 шага;
- `delayHistory` — локальная temporal history;
- `areaPrediction01` — состояние по областям.

При 96 нейронах:

- dense recurrent matrix: 9,216 потенциальных cells;
- sparse active graph: 1,152 edge slots;
- теоретическое сокращение edge storage/iteration graph: **87.5%**.

Это существенно важнее простого увеличения числа нейронов для телефонного runtime.

## 4. E/I и lateral competition

На уровне population:

- 75% E cells;
- 25% I cells;
- I contribution имеет отрицательный recurrent sign;
- локальная активность ограничивается sparse winner-take-most динамикой;
- adaptive thresholds удерживают sparse regime.

Это computational E/I mechanism, а не заявление о биологической идентичности реального мозга.

## 5. Hierarchical routing

Каждое последующее area получает bounded summary предыдущего area.

Схема:

`Area0 -> Area1 -> Area2 -> ... -> Area7`

При этом recurrent edges остаются cross-area и intra-area, поэтому модель не превращена в простой feed-forward pipeline.

## 6. Temporal delay substrate

Каждый sparse edge теперь имеет bounded delay 1–3.

Delay history хранится локально, поэтому динамика может использовать:

`x_j(t-d)`

вместо только `x_j(t)`.

Добавлен online delay adaptation counter. На текущем этапе это **экспериментальный bounded temporal rule**, а не доказательство биологически корректного STDP-delay learning. Следующий шаг должен перейти от heuristic delay proposal к eligibility-trace based delay credit assignment.

## 7. Prediction learning

Prediction теперь имеет отдельный learned readout из neural state.

После outcome выполняется bounded update:

`prediction error × neural activity -> predictionReadout`

Это делает prediction не только вычисленной формулой из pressure/spikes, но и обучаемым параметром ветви.

## 8. Новый benchmark — distribution shift

Файл:

`tests/big-pass-2523-neural-space-distribution-shift.mjs`

Протокол:

- 720 temporal cycles;
- 480 train-distribution cycles;
- 240 shifted-distribution cycles;
- независимая трансформация входной динамики;
- reward target зависит от комбинации input dimensions;
- обучение происходит online;
- shift оценивается отдельно.

Последний PASS:

- train accuracy: **0.898**;
- shifted accuracy: **0.917**;
- shifted samples: **240**;
- delay learning updates: **57,600**;
- neurons: **96**;
- sparse edges: **1,152**;
- dense reference edges: **9,216**;
- graph compression: **87.5%**;
- inhibition state: **0.550**;
- coherence: **0.630**;
- compute budget metric: **0.456**.

Важно: этот benchmark является контролируемым computational test, а не доказательством general intelligence или consciousness. Особенно высокая shifted accuracy не должна интерпретироваться как человеческое обобщение.

## 9. Что перепроверено

PASS:

- `npm run typecheck`;
- `npm run test:b2522:neural-branch`;
- `npm run test:b2523:neural-space`;
- B2521 runtime regression;
- B269 spiking/plasticity regression;
- B365 unified neuro causal regression.

Также проверены persistence/migration пути: старый dense recurrent state может быть преобразован в sparse graph при restore.

## 10. Что ещё НЕ считается решённым

- learned sensory encoder всё ещё не является полноценным self-organizing sensory hierarchy;
- delay learning пока experimental/heuristic;
- slow long-range memory отсутствует как отдельный SSM/liquid subsystem;
- world model и neural substrate ещё не один и тот же learned state;
- external reality grounding не решён;
- physical Android/Termux benchmark не выполнен на конкретном пользовательском устройстве;
- consciousness не доказана.

## 11. Следующий крупный маршрут

### P2525
Learned sensory encoder:
`raw/context -> learned feature fields -> neural contract`

### P2526
Eligibility-trace temporal credit assignment для weights + delays.

### P2527
Adaptive replay scheduler: novelty × causal value × identity relevance × forgetting risk.

### P2528
Liquid/CfC microcircuit experiment против текущего SNN на одинаковом workload.

### P2529
Slow SSM temporal memory для multi-rate organism state.

### P2530
Neural world-model coupling: prediction of latent consequences, not merely scalar reward.

### P2531–P2534
Causal ownership, self-model coupling, endogenous goal formation, active information seeking.

### P2535–P2536
Long-run ablations, restart/transfer tests, memory pressure and real Termux benchmark.

## 12. Архитектурное правило

Не добавлять новые modules только ради количества.

Каждая новая neural capability должна иметь:

1. canonical state;
2. typed contract;
3. causal input/output path;
4. learning rule;
5. ablation/lesion test;
6. persistence test;
7. mobile compute bound;
8. explicit statement of what the test does NOT prove.
