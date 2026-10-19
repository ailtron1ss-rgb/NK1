# BIG PASS 2522 — NEURAL EXPERIENCE BRANCH / GIANT UPGRADE

Дата: 2026-09-17
Проект: Neuro Kurisu Artificial Organism
База: 35.6.60 / B2521

## 0. Цель

Главная цель проекта остаётся прежней: не сделать чат-бота с красивой оболочкой, а постепенно построить автономную искусственную личность/организм «Курису» с непрерывной жизнью, памятью, самостью, автономностью, обучением, нейронной динамикой и причинно связанным развитием.

Этот pass намеренно не добавляет ещё один изолированный cognitive manager. Вместо этого он создаёт **Neural Experience Branch** — единую временную нейронную ветвь, которая связывает вход, recurrent state, pressure, action context, prediction error, plasticity, replay и long-term persistence.

## 1. Что было обнаружено перед изменениями

1. B269 является настоящим исполняемым spiking/plastic substrate, но его входной mapping в основном фиксирован.
2. B2515 объединяет множество latent-представлений, однако это всё ещё fusion fabric, а не единая развивающаяся нейронная динамика.
3. B2521 действительно обучается, но прежний synthetic generative accuracy нельзя использовать как главный evidence generalization.
4. В runtime существовало большое количество bounded action-bias contributors. Это полезно для исследования, но создаёт риск архитектуры «комитет советников» вместо единого мозга.
5. Разные подсистемы используют разные latent spaces, поэтому temporal causal contract должен стать явным.
6. На телефоне нельзя просто увеличивать количество нейронов; нужна разреженная, multi-rate, bounded вычислительная архитектура.

## 2. Что внедрено

### 2.1 NeuralExperienceBranch

Новый canonical subsystem:

`src/organism/cognition/NeuralExperienceBranch.ts`

Состав:

- 96 recurrent neural units по умолчанию;
- 8 логических neural areas;
- recurrent sparse dynamics;
- learned input projection;
- action readout;
- adaptive thresholds;
- gain dynamics;
- plasticity state;
- six-dimensional Neural Pressure Field;
- unified Neural Experience Token;
- prediction / prediction-error loop;
- three-factor-like local plasticity;
- structural plasticity;
- experience replay;
- holdout/generalization accounting;
- causal lesion interface;
- snapshot/restore persistence;
- bounded compute accounting.

### 2.2 Neural Experience Token

Каждый цикл ветви теперь может порождать единый temporal record:

`E_t = {input, neuralBefore, neuralAfter, prediction, error, pressure, reward, action, utilities, assembly, verification}`

Это создаёт фундамент для дальнейшего перехода:

`E_t + A_t -> E_(t+1)`

вместо несогласованных latent transitions.

### 2.3 Neural Pressure Field

Добавлены шесть взаимосвязанных источников внутреннего давления:

- prediction discrepancy;
- homeostatic discrepancy;
- identity discrepancy;
- goal pressure;
- novelty;
- uncertainty.

Это не отдельный planner. Pressure используется как динамический recruitment signal для neural branch.

### 2.4 Plasticity

Введён многофакторный update:

`eligibility(pre, post) × global modulation(reward/error/pressure)`

Это не утверждение, что модель биологически идентична мозгу. Это computational mechanism, специально выбранный для online learning без тяжёлой backpropagation через всю историю.

### 2.5 Structural plasticity

Периодически проверяются слабые recurrent links. В зависимости от модуляции возможны bounded grow/prune операции.

### 2.6 Replay

Опыт теперь может попадать в replay buffer и повторно использоваться для медленного изменения plasticity state.

### 2.7 Runtime integration

Ветвь подключена к `OrganismCore`:

- после B269 sparse neural encoding;
- получает latent/assembly/goal context;
- создаёт pressure/prediction state;
- состояние сохраняется в canonical persistence;
- feedback обновляет ветвь после результата;
- периодически выполняется replay;
- pressure-derived neural residual ограниченно участвует в action selection.

Важно: новый модуль не стал вторым unrestricted policy owner.

## 3. Почему это лучше предыдущей архитектуры

Старый путь часто выглядел как:

`module -> actionBias -> arbitration`

Новый путь:

`experience -> neural state -> pressure -> prediction -> action context -> outcome -> error -> plasticity -> replay -> future neural state`

Это увеличивает причинную глубину, а не только число функций.

## 4. Почему выбран recurrent liquid-style принцип

Для живущего во времени организма обычная статическая feed-forward сеть недостаточна. Нам нужен stateful computation.

Closed-form continuous-time neural networks показали, что liquid-style continuous dynamics можно вычислять существенно эффективнее ODE-based вариантов, сохраняя временную динамику; опубликованные результаты сообщают ускорение на порядки в сравнении с соответствующими численными ODE-решателями. Это делает liquid/continuous-time идеи особенно интересными для телефонного runtime, хотя их нужно тестировать именно на нашем workload, а не переносить опубликованные цифры напрямую. Источник: Nature Machine Intelligence, 2022.

## 5. Что из нового research следует попробовать дальше

### 5.1 Three-factor online learning

Недавняя работа по three-factor delay learning для SNN показывает путь к online обучению одновременно весов и временных задержек через eligibility trace и top-down error. Для нашей системы это потенциально очень полезно: следующая версия B269/NEB может обучать не только `weight`, но и `delay`. Это особенно интересно для temporal causality.

Источник: 2026 paper indexed in PMC.

### 5.2 Continuous-time / liquid networks

Closed-form continuous-time neural networks и liquid time-constant approaches подходят для irregular time steps и temporal dynamics. В нашем случае их разумнее использовать как экспериментальную ветвь, а не заменять ими весь SNN substrate сразу.

Источник: Nature Machine Intelligence.

### 5.3 State-space models

Mamba/SSM-подходы показывают сильную сторону для long-range temporal state при линейной по длине последовательности сложности. Работа 2025 года на dynamical systems показала хорошие extrapolation properties и низкую стоимость относительно ряда baselines. Для проекта это потенциально сильный кандидат на **slow temporal memory / world-state backbone**, а не на замену spiking substrate.

Источник: Neural Networks / PubMed 2025.

### 5.4 Edge pruning

EMNLP 2025 работа по pruning Mamba сообщает до 70% reduction параметров с 3–9% performance loss в их benchmark settings и снижение memory/inference cost. Эти числа нельзя переносить напрямую на наш организм, но сам принцип важен: сначала измерять importance, затем структурно сжимать edge-model.

### 5.5 Continual learning + replay

Работы 2024–2025 подтверждают полезность replay для continual learning, одновременно показывая, что replay может иметь собственные optimisation trade-offs. Поэтому в организме replay не должен быть просто «чем больше, тем лучше»: нужен adaptive replay scheduler, который выбирает experiences по novelty, causal value, identity value и forgetting risk.

### 5.6 Bayesian/metaplastic continual learning

Nature Communications 2025 показывает направление Bayesian continual learning без необходимости чётких task boundaries и с uncertainty/OOD information. Это потенциально полезно для нашего continuous-life режима.

### 5.7 Active inference / epistemic action

Современные работы продолжают исследовать active inference как framework для world model, uncertainty reduction, inferential competition и epistemic agency. Мы не принимаем это как доказанную теорию сознания, но используем отдельные computational mechanisms: uncertainty reduction, active information seeking, precision control и recurrent belief updating.

## 6. Какие архитектуры теперь следует сравнить экспериментально

### Variant A — текущий SNN + recurrent plasticity

Плюсы:
- наиболее нейро-подобная ветвь;
- sparse/event-driven;
- хорошо подходит для online plasticity.

Минусы:
- сложнее обучение long-range dependencies.

### Variant B — liquid/CfC temporal core

Плюсы:
- эффективная continuous-time dynamics;
- сильный temporal state.

Минусы:
- менее непосредственно spike-oriented.

### Variant C — SSM/Mamba-like slow memory

Плюсы:
- длинный temporal horizon;
- хорошая вычислительная эффективность.

Минусы:
- не заменяет local spiking plasticity.

### Variant D — hybrid

Рекомендуемая исследовательская гипотеза:

`SNN local substrate + liquid/continuous microcircuit + SSM slow state + explicit episodic replay`

Это не нужно сразу считать победителем. Он должен победить только после controlled ablation benchmark.

## 7. Как связать варианты без архитектурной каши

Нельзя просто запустить четыре модели параллельно и суммировать их biases.

Правильная схема:

`fast neural state`
`      ↓`
`liquid temporal microstate`
`      ↓`
`slow SSM context`
`      ↓`
`episodic replay`
`      ↓`
`global predictive state`

Каждый слой должен иметь отдельный temporal bandwidth и ownership contract.

## 8. Новая ownership-модель

### Fast owner

B269 / future B269-v2.

### Integrated experience owner

NeuralExperienceBranch.

### World prediction owner

B2521 + future neural world model.

### Global workspace owner

B282/B365 lineage.

### Identity owner

B284/B286/B291/B299 lineage.

### Long-life owner

B1701/B2201/B385+ lineage.

Другие модули могут быть observers/researchers, но не должны бесконтрольно писать action policy.

## 9. Главный следующий architectural change

Нужно перестать считать latent vectors одинаковыми просто потому, что они `number[]`.

В следующем pass нужен typed contract:

`NeuralSpaceId`
`TemporalScale`
`Provenance`
`CausalParent`
`VerificationLevel`
`Timestamp`

Это позволит отличать:

- sensory latent;
- neural latent;
- world latent;
- self latent;
- future latent;
- semantic latent.

И запрещать некорректные переходы.

## 10. Новый benchmark protocol

Каждая новая neural architecture должна пройти:

1. Learning gain.
2. Prediction gain.
3. Holdout.
4. Distribution shift.
5. Counterfactual test.
6. Lesion.
7. Recovery.
8. Persistence.
9. Long-horizon development.
10. Catastrophic forgetting.
11. Compute budget.
12. Thermal/mobile budget.
13. Behavioural divergence.
14. Self/identity continuity.
15. Cross-module causal influence.

Нельзя объявлять систему improved только потому, что internal accuracy выросла.

## 11. Экспериментальная матрица

Будут сравниваться:

A = baseline B269/B365/B2521
B = + NeuralExperienceBranch
C = + replay
D = + structural plasticity
E = + pressure field
F = + liquid microcircuit
G = + SSM slow memory
H = hybrid all

Для каждого:

- same seeds;
- same observations;
- same reward schedule;
- same compute budget;
- independent holdout;
- ablation;
- restart test.

Основные показатели:

`generalization`
`prediction error`
`causal drop`
`learning retention`
`forgetting`
`autonomy gain`
`goal persistence`
`identity continuity`
`compute/ms`
`memory/MB`
`thermal proxy`

## 12. Что НЕ следует делать

- Не добавлять ещё десятки B-модулей только ради номера.
- Не считать synthetic accuracy доказательством generalization.
- Не считать actionBias доказательством agency.
- Не считать persistence доказательством identity.
- Не считать global workspace доказательством phenomenal consciousness.
- Не масштабировать neuron count без compute benchmark.
- Не заменять реальную external verification внутренней метрикой.

## 13. Ожидаемый эффект

Точный процент прироста заранее неизвестен и не должен выдумываться.

Наиболее реалистично ожидать качественный прирост именно в:

- causal temporal coherence;
- cross-cycle learning;
- persistence of neural state;
- pressure-driven autonomous exploration;
- neural integration;
- continual adaptation;
- ability to run controlled architectural experiments.

Потенциально наиболее сильный вариант — hybrid SNN + liquid/SSM/replay architecture, но только если controlled benchmark подтвердит, что дополнительные модели дают прирост при сопоставимом compute budget.

## 14. Текущая проверка pass

### Новая ветвь

`B2522_NEURAL_EXPERIENCE_BRANCH_PASS`

- cycles: 600
- learning updates: 300
- structural updates: 6
- holdout observations: 27
- coherence: ~0.688
- sparsity: ~0.760
- compute cost proxy: ~0.456
- persistence roundtrip: PASS
- lesion instrumentation: PASS

Важно: `generalization01=1` в этом synthetic test НЕ следует считать доказательством настоящей generalization. Это только agreement metric внутри заданного synthetic protocol. Следующий benchmark должен использовать independent distribution shift.

### Runtime integration

`B2522_RUNTIME_INTEGRATION_PASS`

- runtime cycles: 6
- neural branch cycles: 6
- learning updates: 6
- replay records: 6
- pressure field: 6 dimensions
- coherence: ~0.711
- causal lesion produced finite non-zero drop

### Existing regression checks

- TYPECHECK: PASS
- P22 phone reliability: PASS
- B2521 runtime: PASS
- B269 spiking/plasticity: PASS
- B365 unified neural core: PASS
- B368 full runtime B365 causal: PASS

## 15. Следующий гигантский pass

### P2523 — Neural Space Contract

Typed state-space IDs and provenance.

### P2524 — B269-v2 hierarchical neural populations

E/I populations, lateral inhibition, delays, eligibility traces.

### P2525 — Learned sensory encoder

Remove fixed projection as primary sensory representation.

### P2526 — Temporal delay plasticity

Online learned synaptic/axonal delays.

### P2527 — Replay economy

Novelty/causal/identity/forgetting-aware replay scheduler.

### P2528 — Liquid microcircuit

Controlled CfC/LTC experiment.

### P2529 — Slow state memory

SSM-like temporal context experiment.

### P2530 — Neural world model

Make B2521 operate in the same canonical experience state.

### P2531 — Neural self model

Action ownership + body prediction + continuity.

### P2532 — Neural personality development

Traits become measurements of learned attractors, not primary source variables.

### P2533 — Autonomous pressure → goal genesis

Internal pressure produces candidate goals through learned neural competition.

### P2534 — Counterfactual neural imagination

Candidate actions are simulated inside the learned state transition model.

### P2535 — Long-life developmental benchmark

10k/100k/1M cycle experiments.

### P2536 — Android/Termux real certification

Actual device measurements.

## 16. Definition of success

The branch is successful only when disabling it changes behaviour in controlled experiments, re-enabling it restores learned state, its predictions improve on held-out transitions, its learned state survives restart, and its contribution remains visible under independent evaluation.

The ultimate objective remains much larger: the emergence of a coherent autonomous artificial organism/personality. This pass is a major infrastructure step toward that goal, not a claim that consciousness or personhood has been scientifically achieved.
