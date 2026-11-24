# P2724 — Autonomous Continual Cognitive Fabric — research & integration record

Дата: 2026-09-20
Historical release: Neuro-Kurisu 35.10.0 / P2724; superseded by P2726 in the same state schema.

## 1. Задача прохода

P2720 дал локально адаптивную lifelong-neuroplasticity: context selectivity, availability/consolidation, sparse updates, adaptive delay policy и action-conditioned residual model. Основной оставшийся разрыв был системным: не существовало единого механизма, который на одном потоке одновременно определяет смену режима, распределяет пластичность, отбирает полезный replay, строит дешёвый lookahead-план, поддерживает counterfactual action model, разрешает редкую structural plasticity и удерживает всё это в mobile-бюджете.

P2724 закрывает этот разрыв одним контроллером `src/organism/cognition/P2724AutonomousContinualFabric.ts`, встроенным в `NeuralExperienceBranch`.

## 2. Что взято из внешних исследований

### Context-selectivity / metaplasticity
Neural Networks 2025/2026: `Context selectivity with dynamic availability enables lifelong continual learning` — context-selective neurons + local availability/consolidation как механизм lifelong learning.

https://www.sciencedirect.com/science/article/pii/S0893608025006082

Интеграция в проект: P2720 уже содержит availability/selectivity; P2724 добавляет контекстные прототипы и межконтекстную interference matrix.

### Online world-model planning
ICML 2025 / PMLR 267: `Continual Reinforcement Learning by Planning with Online World Models` — онлайн неглубокая модель + planning/MPC вместо тяжёлого полного model retraining.

https://proceedings.mlr.press/v267/liu25p.html

Интеграция: action-conditioned model P2720 становится частью дешёвого P2724 lookahead (глубина 1–3 в зависимости от compute budget).

### Expected information gain / active inference
Nature Communications, 8 Sep 2026: `Active inference and artificial reasoning` — выбор действий с учётом expected information gain и model uncertainty.

https://www.nature.com/articles/s41467-026-77209-5

Интеграция: planning value получает отдельный epistemic-компонент, особенно для `explore`/`verify`.

### Replay — только selective, а не indiscriminate
PMLR 330, 2026: `Replay can provably increase forgetting` показывает, что replay не монотонно полезен: плохо выбранные samples могут усиливать forgetting.

https://proceedings.mlr.press/v330/mahdaviyeh26a.html

Интеграция: P2724 использует priority/context/relevance/novelty/uncertainty для компактного coreset replay, а не случайную выборку.

### Plasticity restoration
PMLR 330, 2026: `Enhancing Plasticity for First Session Adaptation Continual Learning` — контролируемое восстановление plasticity с teacher-student stabilization.

https://proceedings.mlr.press/v330/marouf26a.html

Интеграция: structural plasticity и P2720 availability не просто фиксируют сеть, а позволяют ограниченно «разбудить» малоиспользуемые элементы при shift.

### Sleeping / inactive weights
CVPR Findings 2026: `Wake the Sleeping Weights` — использование практически неактивных параметров как дешёвого резерва для адаптации без переписывания активной части модели.

https://openaccess.thecvf.com/content/CVPR2026F/html/Ji_Wake_the_Sleeping_Weights_Sparsely-Activated_Continual_Test-Time_Adaptation_for_Medical_CVPRF_2026_paper.html

Интеграция: sparse `wake/prune` structural decisions на ограниченном числе нейронов за outcome.

### Online eligibility traces / low-memory neural learning
Nature Communications 2026 BrainTrace и открытый репозиторий:

https://www.nature.com/articles/s41467-026-68453-w
https://github.com/chaobrain/braintrace

В проекте не копируется внешний framework. Используются совместимые принципы: online traces, bounded state и отсутствие квадратичного буфера для long-horizon credit.

### Context gating implementation reference
LXDG:

https://github.com/m-j-tilley/LXDG

Использовано как архитектурный reference для context-dependent gating; реализация проекта остаётся native TypeScript/Termux.

## 3. Реально внедрено в P2724

1. Автоматическое выделение контекстов без oracle task labels.
2. Change-point / boundary signal из novelty + prediction error + context mismatch.
3. Межконтекстная interference matrix.
4. Контекстная статистика performance/visits/entropy.
5. Shallow planning 1–3 шага, зависящее от compute budget.
6. Отдельный epistemic-value компонент для explore/verify.
7. Action-conditioned outcome model + counterfactual estimates.
8. Compact prioritized replay coreset на 96 элементов.
9. Фактическое replay-влияние на action readout и prediction readout.
10. Sparse structural plasticity `wake/prune` с редкими rewiring events.
11. Mobile-aware budget, hot residency, replay budget и pressure tracking.
12. Полная persistence/restore нового состояния.
13. Ablation через существующий `experimentalLayerEnabled`.
14. Release-integrated diagnostics и benchmark battery.

## 4. Что сознательно НЕ заявляется

P2724 не доказывает сознание. Он добавляет механизм, пригодный для проверки гипотез о persistent agency, global coordination, self-model и continual learning. Для сознания по-прежнему нужны независимые ablations/контрфактуальные тесты, а не один activation/workspace score.

## 5. Результат текущего прохода

Synthetic integration battery: 188 outcomes (после интеграции continuous `microTick`-path).
- contexts used: 3
- automatic task/context switches: 17
- compact replay: 96/188
- replay usage: 372
- counterfactual confidence: 0.4283
- structural gain: 0.0388
- wake events: 2
- mobile pressure: 0.6502
- experimental-vs-control neural trajectory difference: 45.5276 (L1 weight magnitude proxy) (L1 weight magnitude proxy)

Mobile endurance battery: 1500 cycles / 750 outcomes.
- elapsed: 4.66 s on host runtime
- max heap increase: 24.2 MB
- end heap increase: 37.4 MB
- replay resident: 96
- restart persistence: PASS

Эти числа — показатели текущих synthetic/host batteries, а не обещание аналогичного прироста на физическом Android-устройстве.

## 6. Ограничения и следующий экспериментальный приоритет

1. Context prototype discovery пока heuristic; следующий этап — online Bayesian/non-parametric context allocation.
2. Planning использует shallow residual/reward model, а не полноценную learned latent dynamics model.
3. Counterfactual module оценивает action alternatives, но не имеет богатой intervention graph с внешним environment.
4. Replay quality требует отдельной factorial battery против random replay / no replay / context-only replay.
5. Mobile heap ещё требует проверки на реальном Termux-устройстве: host heap ≠ Android thermal/memory evidence.
6. Следующий крупный research block: learned task-boundary detector + context-conditioned world-model routing + adaptive replay mixture + stronger structural rewiring + 1000/2000-cycle endurance.
