# P2677 — исследование: Actionable World Models, mixture routing и multi-horizon verification

Дата: 2026-09-18
Проект: Neuro Kurisu / Artificial Organism
Цель: превратить накопленные world-model компоненты в замкнутую, проверяемую систему, где прогноз действительно влияет на действие, а результат действия корректирует маршрутизацию и планирование.

## 1. Что изменилось в научном поле

### Active inference / information gain
Nature Communications, 08.09.2026: *Active inference and artificial reasoning* показывает принцип выбора действий по ожидаемой информационной ценности и полезности; информационная ценность связывается с различием предсказательных распределений, а Bayesian Model Reduction рассматривается как способ дешёвого обновления гипотез. Для Neuro Kurisu это подтверждает направление P2675: действие должно иногда выбираться не ради немедленной награды, а ради разрешения неопределённости.
Источник: https://www.nature.com/articles/s41467-026-77209-5

### Actionable world models
Yao et al., 15.09.2026: *World Models for Embodied Intelligence: From Plausible to Controllable to Actionable*. Ключевой критерий world model — не реалистичность внутренней генерации, а измеримое улучшение planning/action/learning/verification/recovery/data selection. Отдельно выделены long-horizon consistency, uncertainty calibration, causal intervention testing, latency, verification/recovery и cross-embodiment transfer.
Источник: https://arxiv.org/abs/2609.16697

### Uncertainty + closed-loop control
Kirchner, Purschke, Knoll, 03.09.2026: обзор world models для Physical AI подчёркивает необходимость совместного моделирования perception, prediction, planning и control под частичной наблюдаемостью и неопределённостью.
Источник: https://link.springer.com/article/10.1007/s44163-026-02122-1

### Test-time mixture of world models
Jang et al., TMoW, ICLR 2026: routing между несколькими world models можно адаптировать во время выполнения, используя prototype-based routing и test-time refinement. Это особенно близко к нашему проекту, потому что у нас уже существуют persistent/counterfactual/sensorimotor/generative модели, но до P2677 они не имели единого обучаемого маршрутизатора.
Источник: https://arxiv.org/abs/2601.22647

### Modular continual memory
Dorovatas et al., 2026: modular memory предлагается как способ сочетать быстрое in-context накопление опыта со стабильными изменениями параметров и уменьшать catastrophic forgetting. Это поддерживает дальнейшее разделение fast/slow learning в Neuro Kurisu.
Источник: https://arxiv.org/abs/2603.01761

## 2. Что было слабым до P2677

1. B2518–B2521 существовали как связанные, но преимущественно последовательно вызываемые компоненты.
2. Не было отдельного слоя, который измерял disagreement между моделями и адаптивно менял доверие к каждой из них.
3. B2519 давал multi-step counterfactual planning, но не имел отдельного verifier-слоя, который проверяет согласованность длинного rollout с текущей неопределённостью и disagreement.
4. Model output мог попасть в финальную utility-сумму без явного учёта ensemble disagreement как сигнала недоверия.
5. Не было отдельной persistence state для learned routing reliability и multi-horizon verification confidence.
6. На мобильном устройстве нельзя бесконтрольно увеличивать rollout horizon: нужен compute-budget gate.

## 3. Что внедрено в P2677

### B2522 Adaptive World Model Mixture Router
Четыре источника:
- persistent self/world transitions;
- long-horizon counterfactual planner;
- sensorimotor imagination;
- learned generative organism loop.

Маршрутизатор:
- оценивает confidence каждого источника;
- учитывает novelty/uncertainty/prediction error/compute budget;
- считает disagreement между моделями;
- нормализует mixture weights;
- обучает source reliability по фактическому исходу;
- сохраняет learned routing state;
- ограничивает contribution при disagreement.

### B2523 Multi-Horizon Counterfactual Verifier
Отдельный verifier:
- выбирает горизонт 2–8 в зависимости от compute budget, uncertainty, model confidence и disagreement;
- выполняет дешёвые multi-horizon value rollouts для всех действий;
- учитывает epistemic pressure для explore/verify;
- измеряет counterfactual agreement;
- обучает verification confidence после реального исхода;
- имеет lesion mechanism для причинного тестирования.

### Новая цепочка
`latent state → B2518/B2519/B2520/B2521 → B2522 adaptive mixture routing → B2523 multi-horizon verification → final utility synthesis → real outcome → B2522 reliability learning + B2523 verification learning → persistence`

Это важнее простого добавления ещё одного класса: два новых слоя образуют обратную связь между качеством world-model ensemble и реальным поведением.

## 4. Почему это подходит именно под телефон

B2522 использует только небольшие векторы action-bias/confidence, а B2523 ограничивает horizon диапазоном 2–8 и масштабирует его compute budget. Это не полноценная тяжёлая симуляция мира. На текущем этапе это намеренно лёгкий управляющий слой над уже существующими learned models.

## 5. Что НЕ утверждается

Это не полноценный физический world model и не доказательство сознания. P2677 создаёт проверяемую инженерную связку model → action → outcome → model update. Для следующего уровня нужны реальные сенсорные потоки Android, более богатые latent dynamics, task-free transfer и длительные on-device тесты.

## 6. Следующие исследования

1. prototype-based routing с несколькими granularities;
2. uncertainty calibration и distribution shift detection;
3. belief-guided search;
4. causal intervention tests для world-model transitions;
5. learned model expansion при недостаточной ёмкости;
6. fast/slow modular memory consolidation;
7. long-horizon recovery и verifier-guided search;
8. factorial ablation: B2522, B2523, P2675 и external grounding по отдельности и совместно.

## 7. Источники

- Nature Communications: https://www.nature.com/articles/s41467-026-77209-5
- arXiv 2609.16697: https://arxiv.org/abs/2609.16697
- Springer Physical AI world-model survey: https://link.springer.com/article/10.1007/s44163-026-02122-1
- TMoW: https://arxiv.org/abs/2601.22647
- Modular Memory: https://arxiv.org/abs/2603.01761
