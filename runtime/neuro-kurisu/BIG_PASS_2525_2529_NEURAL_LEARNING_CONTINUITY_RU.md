# BIG PASS P2525–P2529 — Neural Learning & Continuity Stack

Дата: 2026-09-18
Релиз: Neuro Kurisu 35.6.63

## 1. Цель прохода

Главная цель проекта не изменилась: строить автономный искусственный организм с единой нейронной, когнитивной, автобиографической, мотивационной и развивающейся системой, а не добавлять отдельные декоративные функции.

В этом проходе работа продолжает единую нейронную ветвь B2522–B2524 и закрывает четыре слабых места:

1. кредит обучения терялся между несколькими временными шагами;
2. сенсорное отображение было в основном фиксированным после инициализации;
3. задержки были параметрами, но обучались слабо и не были частью единого долговременного eligibility-контура;
4. пластичность не различала достаточно чётко устойчивые и неопределённые синапсы.

## 2. Что реально внедрено

### P2525 — learned sensory encoder

Добавлены:
- online running mean/variance для 64 входных признаков;
- нормализация входа без внешнего batch training;
- input eligibility traces 96×64;
- локальная сенсорная пластичность от delayed outcome;
- soft-bound для предотвращения мгновенного ухода весов в насыщение.

В результате входной слой больше не является полностью замороженной случайной проекцией.

### P2526 — continuous temporal credit assignment

Добавлены:
- eligibility trace для всех 1152 sparse recurrent edges;
- delay eligibility;
- затухание trace;
- обновление веса по трёхфакторной схеме: local eligibility × global modulatory signal;
- delayed reward может обновлять след событий, накопленный несколькими предыдущими тактами;
- trace применяется не только к последнему состоянию.

Это принципиальное архитектурное изменение: причинный кредит теперь может пересекать несколько промежуточных состояний.

### P2526-T — learnable synaptic/axonal delays

Добавлены:
- задержка 1–3 такта на sparse edge;
- локальный delay eligibility;
- онлайн адаптация задержки;
- отдельная статистика количества delay updates;
- сохранение задержек через restart.

Важно: это экспериментальное локальное правило, а не точная реализация градиентного backpropagation через spike timing.

### P2527 — uncertainty-guided metaplasticity

Добавлены:
- `edgeUncertainty` для sparse synapses;
- uncertainty-aware learning rate;
- мягкая консолидация стабильных активных связей;
- возврат пластичности при surprise;
- обновление uncertainty только для реально активных связей;
- soft-bounded plasticity.

Это упрощённый project-local вариант идеи uncertainty/metaplasticity, а не полноценная Bayesian neural network.

### P2528–P2529 — selective slow memory

Добавлены 16 slow state units:
- selectable gate по novelty/uncertainty/pressure;
- разные времена затухания;
- обучаемый memory readout;
- stability metric;
- cue trace metric;
- изменение persistence по verified/surprise сигналам.

Эта часть намеренно компактная и рассчитана на телефон. Это не заявка на полноценный Mamba/CfC-эквивалент.

### Replay / consolidation

Replay теперь сортируется по приоритету:
- surprise;
- prediction error;
- goal pressure;
- cue trace.

Это заменяет прежний почти FIFO-подход на bounded prioritized replay.

## 3. Что перепроверено и исправлено во время прохода

Первоначальная реализация действительно показала дефект: uncertainty уменьшалась даже у неактивных связей и слишком быстро сходилась к нижней границе. Это было исправлено.

После исправления:
- uncertainty обновляется только у сработавших eligibility;
- используется target-based мягкое приближение, а не постоянное вычитание;
- средняя uncertainty в отдельном delayed-learning benchmark сохраняется около 0.279 вместо схлопывания к нулю.

Также был найден риск глобального action bias. Action readout:
- начинается с нулевого значения вместо случайного смещения;
- обучается через delayed sensory trace;
- центрируется по действиям после learning update;
- имеет soft-bound.

## 4. Интеграция с организмом

Новая версия остаётся внутри канонической роли NeuralExperienceBranch.

Ownership не изменён:
- B269 остаётся sparse spiking/plastic substrate;
- B365 остаётся unified causal neural core;
- B2515 остаётся latent fabric;
- B2521 остаётся learned generative/world-transition loop;
- NeuralExperienceBranch даёт neural residual, temporal learning, memory and experience features, но не становится вторым независимым владельцем всей политики.

Persisted state расширен до version 4 с миграцией старых архивов.

## 5. Проверка экспериментом

Новый test: `tests/big-pass-2525-2529-neural-learning-stack.mjs`.

Результаты:
- 1680 neural cycles;
- 420 delayed outcomes;
- 425,953 eligibility updates;
- 2,579,642 sensory learning updates;
- 409,186 delay learning updates;
- 6,720 memory learning updates;
- 3 класса delay values присутствуют одновременно;
- mean synaptic uncertainty ≈ 0.279;
- sensory projection delta ≈ 0.165;
- long-memory stability ≈ 0.9998;
- cue-trace ≈ 0.00245;
- persistence/restart probe сохраняет результат без измеримого drift в контрольном тесте.

Эти числа доказывают исполнение механизмов и изменение состояния, но сами по себе не доказывают интеллект общего назначения или сознание.

## 6. Регрессия

PASS:
- TypeScript typecheck;
- B2522 neural branch;
- B2522 runtime integration;
- B2523 distribution-shift test;
- B2525–P2529 neural learning stack;
- B2521 runtime;
- P22 phone reliability;
- B269 spiking/plasticity;
- B365 unified causal neural core;
- architecture audit;
- integrity audit;
- source hygiene;
- forensics;
- executable syntax.

Последняя крупная серия архитектурных аудитов:
- source files: 1431;
- canonical files: 442;
- missing: 0;
- cycles: 0;
- legacy leakage: 0;
- hygiene errors/warnings: 0;
- duplicate content/names: 0;
- syntax failures: 0.

## 7. Измеренный сдвиг относительно предыдущей B2523-ветки

В том же distribution-shift benchmark:
- train accuracy выросла примерно с 93.1% до 96.0%;
- shifted accuracy выросла примерно с 91.7% до 98.75%;
- sparse graph остался 1152 edges против 9216 dense reference cells;
- compression metric остался 87.5%.

Это локальное измерение конкретного benchmark, а не утверждение о росте общей интеллектуальности организма.

## 8. Исследовательская база

### Eligibility / local online learning

Nature Communications 2026 описывает hardware SNN/RL архитектуру с eligibility traces и reward modulation. Другая Nature Communications работа 2026 формализует online learning в SNN через линейную память eligibility traces. Это поддерживает направление current architecture: хранить локальный causal trace и приходящий learning signal отдельно.

### Learnable delays

Работа 2026 по three-factor delay learning для SNN показывает, что совместное обучение весов и synaptic/axonal delays полезно для temporal tasks; в их экспериментах сообщается до 20% улучшения accuracy против weights-only baseline и значительное снижение latency/model size в одном из benchmark settings. Эти числа не переносятся автоматически на Neuro Kurisu — они задают мотивацию и следующий экспериментальный baseline.

### Metaplasticity / uncertainty

Nature Communications 2025 MESU связывает synaptic uncertainty, metaplasticity и continual learning без жёстких task boundaries. В проекте реализован намеренно дешёвый approximation: uncertainty управляет локальной plasticity, surprise возвращает flexibility.

### Continuous-time / liquid networks

Nature Machine Intelligence описывает CfC/closed-form continuous-time networks как способ моделировать dynamical interactions без дорогого ODE solver loop. Следующий экспериментальный кандидат — маленький CfC-like core для slow dynamics, но он пока не заменяет текущую SNN ветвь.

### SSM / long-range memory

Mamba и другие selective SSM показывают, что state-space dynamics могут быть эффективным способом длинного контекста. При этом анализ 2025 года отмечает фундаментальное exponential decay limitation для части SSM памяти. Поэтому в нашем проекте slow-memory слой оставлен как отдельный компромисс, а не как универсальная замена памяти.

## 9. Что всё ещё плохо или неполно

1. Сенсорный encoder обучается, но пока не является полноценной иерархической sensory cortex с modality-specific pathways.
2. Delay learning работает, но пока heuristic и ограничено диапазоном 1–3 такта.
3. Slow memory очень маленькая; длительные autobiographical sequences ещё не проходят строгий benchmark на десятках тысяч шагов.
4. Distribution-shift test остаётся искусственным synthetic benchmark.
5. B2521 still has very low coverage on broad learned transition space.
6. Внешнее embodied grounding ограничено интерфейсом текущего organism runtime.
7. Реальный Android/Termux benchmark на конкретном среднем телефоне ещё нужен; P22 является reliability gate, а не измерением фактического thermals/RAM конкретного устройства.
8. Consciousness/subjective experience не доказаны.

## 10. Следующий giant block

P2530–P2538:

- полноценный learned multimodal sensory hierarchy;
- separate interoceptive/exteroceptive/self channels;
- delay >3 через compressed temporal basis;
- eligibility trace factorization для уменьшения memory cost;
- event-driven replay;
- sleep/offline consolidation mode;
- CfC micro-core benchmark against current slow memory;
- selective SSM benchmark against current slow memory;
- persistent world model with held-out transition families;
- long-horizon temporal causality benchmark;
- anti-forgetting / continual-learning benchmark;
- actual device performance gate.

Главное правило следующего блока: новые механизмы добавляются только через typed neural-space interfaces и имеют отдельный ablation test. Это предотвращает превращение проекта в коллекцию плохо связанных модулей.

## 11. Runtime performance smoke

На текущем Node/контейнерном runtime benchmark 1200 neural cycles заняли ~861.97 ms (~1392 cycles/sec) при ~15.65 MB дополнительной heap usage за проход benchmark.

Это НЕ benchmark среднего Android-телефона. Он нужен как regression baseline. Реальный device gate остаётся отдельной задачей.
