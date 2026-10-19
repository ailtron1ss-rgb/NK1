# P2742 — Causal Predictive Intervention Fabric

Дата: 2026-09-20

## Цель

P2742 закрывает архитектурный разрыв между уже существующими `context-conditioned models`, `latent transition`, `active information gain`, `counterfactual credit` и фактическим выбором поведения/обучения.

Канонический контур:

`latent state → context assignment → action-conditioned transition prediction → uncertainty → information value → intervention/action bias → real outcome → model update → counterfactual gap → replay utility → neural learning-rate gate`

## Исследовательская основа

### Online world model + planning

ICML 2025 *Continual Reinforcement Learning by Planning with Online World Models* показывает направление online shallow world model + planning как естественный путь к continual RL без обязательного обучения отдельной task-specific policy. P2742 переносит принцип в компактную 8-D latent model: для каждого действия поддерживаются reward statistics, delta statistics, uncertainty и bounded one-to-three-step planning depth. См. https://proceedings.mlr.press/v267/liu25p.html

### Active inference / information gain

Nature Communications (08 Sep 2026) *Active inference and artificial reasoning* рассматривает выбор действий с учётом expected information gain и value для уменьшения неопределённости структуры world model. P2742 добавляет bounded epistemic pressure: при сильной неопределённости увеличиваются bias к `verify/explore`, но сохраняется прагматический value term и resource penalty. См. https://www.nature.com/articles/s41467-026-77209-5

Работа UAI 2026 формализует active inference как inference-based planning и показывает значение dynamics/observation uncertainty. P2742 использует более простой on-device приближённый вариант без тяжёлого variational message passing. См. https://proceedings.mlr.press/v337/nuijten26a.html

### Fast/meta continual learning

ICLR 2026 *Principled Fast and Meta Knowledge Learners for Continual Reinforcement Learning* разделяет быстрый перенос и медленную интеграцию. P2734 уже реализует этот принцип, а P2742 добавляет отдельный predictive/counterfactual model layer, чтобы meta-решения опирались на модель переходов, а не только на scalar reward/error. См. https://proceedings.iclr.cc/paper_files/paper/2026/hash/2230ffcd5da10015ce0c6ce588fc2936-Abstract-Conference.html

### Replay and sample selection

ACL 2026 OASIS мотивирует adaptive online sample selection и подавление redundancy. P2734 реализует adaptive replay arms, а P2742 добавляет model-surprise / latent-divergence score к реальному replay utility. См. https://aclanthology.org/2026.acl-long.158/

### Cascading eligibility traces

ICLR 2026 *Learning From the Past with Cascading Eligibility Traces* показывает преимущество многомасштабного временного следа для задержанного credit assignment. Проект уже имеет собственный fast/mid/slow cascade; P2742 специально оставляет causal prediction как отдельный signal, чтобы не смешивать model error с одним scalar eligibility trace. См. https://proceedings.iclr.cc/paper_files/paper/2026/hash/e647dad9086b5a4cc136e1d1926cc172-Abstract-Conference.html

### Sparse structural plasticity

CVPR Findings 2026 *Wake the Sleeping Weights* показывает направление sparse adaptation через использование низкоактивных параметров вместо плотной модификации всей сети. Это поддерживает существующую P2724/P2720 sparse structural plasticity ветку; P2742 не дублирует её, а передаёт resource/model uncertainty signal в learning gate. См. https://openaccess.thecvf.com/content/CVPR2026F/html/Ji_Wake_the_Sleeping_Weights_Sparsely-Activated_Continual_Test-Time_Adaptation_for_Medical_CVPRF_2026_paper.html

## Что внедрено

1. `src/organism/cognition/P2742CausalPredictiveInterventionFabric.ts` — online action-conditioned 8-D latent dynamics, context models, reward/transition uncertainty, intervention selection, counterfactual gap and replay utility.
2. `NeuralExperienceBranch.beforeDecision()` — P2742 реально добавляет bounded action bias и epistemic probe pressure.
3. `microTick()` — predictive controller обновляется на continuous cognition ticks.
4. `afterOutcome()` — P2742 получает реальный latent transition и reward/prediction outcome и обновляет свою модель.
5. Learning-rate gate — model calibration, intervention value и mobile pressure изменяют bounded neural learning scale.
6. Replay — causal/model-surprise score участвует в фактическом replay gain.
7. Snapshot/restore — вся P2742 state persistence входит в `NeuralExperienceBranch`.
8. Ablation API — `setCausalPredictiveInterventionEnabled(false)` позволяет отделить contribution P2742 от P2734.

## Verification

`P2742_CAUSAL_PREDICTIVE_INTERVENTION=PASS`

Результат одного matched synthetic run:

- outcomes = 445
- contexts = 6
- context switches = 5
- interventions = 90
- high-information outcomes = 78
- information gain = 0.4039
- transition confidence = 0.4229
- model calibration = 0.4049
- counterfactual gap = 0.0520
- replay utility = 0.2768
- planning depth = 2
- restart = PASS
- max RSS of this test process ≈ 218 MB

В этом прогоне разница траектории full vs P2734-only была небольшой (~0.0005 по текущему edge-mass proxy), тогда как full vs fully disabled control сильно расходилась. Это означает, что основной вклад P2742 пока наблюдается через model/replay/decision pathway, а не через большой прямой сдвиг synaptic mass. Это сохранено как caveat, а не превращено в claim о superior learning.

## Что пока не доказано

- P2742 не доказывает сознание.
- Information-seeking bias не означает субъективную любознательность.
- Synthetic benchmark не заменяет physical Android/Termux measurements.
- Causal predictive layer пока является online statistical predictor, а не полным структурным causal graph.
- Для универсального anti-forgetting эффекта необходима независимая factorial battery с A→B→C→A, interleaving, sparse delayed reward, noise и distribution shift.

## Следующий обязательный слой

1. Independent replay factorial.
2. Multi-context interference matrix.
3. Task-boundary false-positive/false-negative sweep.
4. Stronger causal interventions with held-out counterfactual outcomes.
5. Physical Termux instrumentation for RSS/GC/latency/thermal pressure.
